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

// ENV se values lo
const MONGO_URI = (process.env.MONGO_URI || "").trim();
const VAPID_PUBLIC_KEY = (process.env.VAPID_PUBLIC_KEY || "").trim();
const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || "").trim();
const CALLMEBOT_KEY = (process.env.CALLMEBOT_KEY || "").trim();

// Debug logs
console.log("SERVER VAPID PUBLIC starts with:", VAPID_PUBLIC_KEY.slice(0, 25));
console.log("SERVER VAPID PUBLIC length:", VAPID_PUBLIC_KEY.length);

// ====== DB CONNECT ======
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ====== SCHEMAS & MODELS ======

// --- Business Schema (for login / signup) ---
const businessSchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // simple text for now
  },
  { timestamps: true }
);

const Business = mongoose.model("Business", businessSchema);

// --- Ticket Schema (queue tickets) ---
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
  try {
    webpush.setVapidDetails(
      "mailto:you@example.com",
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    console.log("✅ Push enabled (VAPID OK)");
  } catch (err) {
    console.error("❌ VAPID config error:", err);
  }
} else {
  console.warn("⚠️ VAPID keys missing – push disabled");
}

// ====== MIDDLEWARE ======
app.use(express.json());

// Static files – frontend yahi se serve honge
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

  console.log("🛰 Trying to send push to subscription:", subscription);

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    console.log("✅ Push notification sent");
  } catch (err) {
    console.error(
      "❌ Push error:",
      err.statusCode || "",
      err.body ? err.body.toString() : err
    );
  }
}

// ====== ROUTES ======

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

/* ======================================
   AUTH ROUTES  (/api/register, /api/login)
   ====================================== */

// Register business (signup)
app.post("/api/register", async (req, res) => {
  try {
    const { businessName, email, password } = req.body;

    if (!businessName || !email || !password) {
      return res
        .status(400)
        .json({ error: "businessName, email and password are required" });
    }

    // check duplicate email
    const existing = await Business.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const biz = await Business.create({ businessName, email, password });

    console.log("🏢 New business registered:", biz._id.toString(), email);

    return res.status(201).json({
      success: true,
      businessId: biz._id.toString(),
      businessName: biz.businessName,
    });
  } catch (err) {
    console.error("❌ register error:", err);

    // duplicate key handle
    if (err.code === 11000) {
      return res.status(400).json({ error: "Email already registered" });
    }

    return res.status(500).json({ error: "Failed to register business" });
  }
});

// Login business
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "email and password are required" });
    }

    const biz = await Business.findOne({ email });
    if (!biz || biz.password !== password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    console.log("✅ Business login:", biz._id.toString(), email);

    return res.json({
      success: true,
      businessId: biz._id.toString(),
      businessName: biz.businessName,
    });
  } catch (err) {
    console.error("❌ login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

/* ============================
   TICKET ROUTES (queue system)
   ============================ */

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

    console.log("🎫 Ticket created:", ticket._id.toString(), name);

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

    console.log(
      `🔄 Status change: ${ticket._id.toString()} (${ticket.name}) ${oldStatus} -> ${status}`
    );

    // Only when ticket becomes NEXT
    if (oldStatus !== "next" && status === "next") {
      console.log("👉 Ticket became NEXT, will notify user");

      const label = ticket._id.toString().slice(-5);

      // Push
      if (ticket.notifyPush && ticket.pushSubscription) {
        console.log("🛰 notifyPush = true, pushSubscription present");
        await sendPushNotification(ticket.pushSubscription, {
          title: "Your ticket is next 🎟️",
          body: `Please get ready, your turn is coming (Ticket ${label}).`,
          ticketId: ticket._id.toString(),
        });
      } else {
        console.log(
          "⚠️ Skipping push: notifyPush=",
          ticket.notifyPush,
          "pushSubscription=",
          ticket.pushSubscription
        );
      }

      // WhatsApp (optional)
      if (ticket.notifyWhatsapp && ticket.whatsappNumber) {
        console.log("📲 Sending WhatsApp to", ticket.whatsappNumber);
        const msg = `🎫 QRtrack Alert\nYour ticket is NEXT. Please proceed to the counter. (Ticket ${label})`;
        await sendWhatsApp(ticket.whatsappNumber, msg);
      } else {
        console.log("ℹ️ No WhatsApp notification for this ticket");
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
