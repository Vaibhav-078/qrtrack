// server.js
import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import webpush from "web-push";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ====== CONFIG ======
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const CALLMEBOT_KEY = process.env.CALLMEBOT_KEY;

// ====== DB CONNECT ======
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ====== MODELS ======
const ticketSchema = new mongoose.Schema(
  {
    businessId: { type: String, required: true },
    queueId: { type: String, required: true },
    name: String,
    issue: String, // service / reason
    status: {
      type: String,
      enum: ["waiting", "next", "serving", "completed", "cancelled"],
      default: "waiting",
    },
    notifyPush: { type: Boolean, default: false },
    pushSubscription: { type: Object, default: null },
    notifyWhatsapp: { type: Boolean, default: false },
    whatsappNumber: { type: String, default: null },
  },
  { timestamps: true }
);

const Ticket = mongoose.model("Ticket", ticketSchema);

// ====== WEB PUSH CONFIG ======
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:you@example.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} else {
  console.warn("⚠️ VAPID keys missing – push notifications disabled");
}

// ====== MIDDLEWARE ======
app.use(express.json());

// Static files – frontend (HTML/CSS/JS same folder se serve honge)
app.use(express.static(__dirname));

// ====== HELPERS ======
async function sendWhatsApp(number, text) {
  if (!CALLMEBOT_KEY) {
    console.log("⚠️ CALLMEBOT_KEY missing, skipping WhatsApp");
    return;
  }

  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
    number
  )}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(
    CALLMEBOT_KEY
  )}`;

  try {
    const res = await fetch(url);
    const body = await res.text();
    console.log("📲 CallMeBot response:", body);
  } catch (err) {
    console.error("❌ CallMeBot error:", err);
  }
}

async function sendPushNotification(subscription, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log("⚠️ Push disabled (no VAPID keys)");
    return;
  }
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    console.log("🔔 Push notification sent");
  } catch (err) {
    console.error("❌ Push error:", err);
  }
}

// ====== ROUTES ======

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// CREATE TICKET (public + counter)
app.post("/api/tickets", async (req, res) => {
  try {
    const {
      businessId,
      queueId,
      name,
      issue,
      notifyPush,
      pushSubscription,
      notifyWhatsapp,
      whatsappNumber,
    } = req.body;

    if (!businessId || !queueId || !name) {
      return res
        .status(400)
        .json({ error: "businessId, queueId and name are required" });
    }

    const ticket = await Ticket.create({
      businessId,
      queueId,
      name,
      issue,
      notifyPush: !!notifyPush && !!pushSubscription,
      pushSubscription: notifyPush ? pushSubscription : null,
      notifyWhatsapp: !!notifyWhatsapp && !!whatsappNumber,
      whatsappNumber: notifyWhatsapp ? whatsappNumber : null,
    });

    res.status(201).json(ticket);
  } catch (err) {
    console.error("❌ create ticket error:", err);
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

// LIST TICKETS (admin + display)
app.get("/api/tickets", async (req, res) => {
  try {
    const { businessId, queueId, status } = req.query;

    if (!businessId || !queueId) {
      return res
        .status(400)
        .json({ error: "businessId and queueId are required" });
    }

    const query = { businessId, queueId };
    if (status) query.status = status;

    const tickets = await Ticket.find(query).sort({ createdAt: 1 }).lean();

    res.json(tickets);
  } catch (err) {
    console.error("❌ get tickets error:", err);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// UPDATE STATUS (Next / Serving / Done / Cancel)
app.patch("/api/tickets/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status required" });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "ticket not found" });

    const oldStatus = ticket.status;
    ticket.status = status;
    await ticket.save();

    // Only when ticket becomes NEXT
    if (oldStatus !== "next" && status === "next") {
      const label = ticket._id.toString().slice(-5);

      // Push
      if (ticket.notifyPush && ticket.pushSubscription) {
        await sendPushNotification(ticket.pushSubscription, {
          title: "Your ticket is next 🎟️",
          body: `Please get ready, your turn is coming (Ticket ${label}).`,
          ticketId: ticket._id.toString(),
        });
      }

      // WhatsApp (optional)
      if (ticket.notifyWhatsapp && ticket.whatsappNumber) {
        const msg = `🎫 QRtrack Alert\nYour ticket is NEXT. Please proceed to the counter. (Ticket ${label})`;
        await sendWhatsApp(ticket.whatsappNumber, msg);
      }
    }

    res.json(ticket);
  } catch (err) {
    console.error("❌ update status error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
