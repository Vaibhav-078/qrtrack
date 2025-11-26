// js/display.js

const urlParams = new URLSearchParams(window.location.search);
const businessId = urlParams.get("biz") || "defaultBiz";
const queueId = urlParams.get("queue") || "defaultQueue";
const businessName = urlParams.get("name") || "QRtrack";

const nowServingEl = document.getElementById("nowServingList");
const recentEl = document.getElementById("recentlyCompletedList");
const timeEl = document.getElementById("displayTime");
const displayBusinessNameEl = document.getElementById("displayBusinessName");
const displaySubheadingEl = document.getElementById("displaySubheading");

if (displayBusinessNameEl) displayBusinessNameEl.textContent = businessName;
if (displaySubheadingEl)
  displaySubheadingEl.textContent = "Now Serving";

// clock
setInterval(() => {
  if (timeEl) {
    timeEl.textContent = new Date().toLocaleString();
  }
}, 1000);

async function fetchTicketsForDisplay() {
  try {
    const query = new URLSearchParams({
      businessId,
      queueId,
    });

    const res = await fetch(`/api/tickets?${query.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch tickets");
    const tickets = await res.json();

    const nowServing = tickets.filter(
      (t) => t.status === "serving" || t.status === "next"
    );
    const completed = tickets
      .filter((t) => t.status === "completed")
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 5);

    renderNowServing(nowServing);
    renderCompleted(completed);
  } catch (err) {
    console.error(err);
  }
}

function renderNowServing(list) {
  if (!nowServingEl) return;
  nowServingEl.innerHTML = "";

  if (!list.length) {
    nowServingEl.textContent = "-";
    return;
  }

  list.forEach((t) => {
    const div = document.createElement("div");
    div.className = "now-serving-item";
    const label = t._id ? t._id.toString().slice(-5) : "";
    div.textContent = t.name
      ? `${t.name} (${label})`
      : `Ticket ${label}`;
    nowServingEl.appendChild(div);
  });
}

function renderCompleted(list) {
  if (!recentEl) return;
  recentEl.innerHTML = "";

  if (!list.length) {
    recentEl.textContent = "No completed tickets yet.";
    return;
  }

  list.forEach((t) => {
    const row = document.createElement("div");
    row.className = "recent-item";
    const label = t._id ? t._id.toString().slice(-5) : "";
    const time = t.updatedAt
      ? new Date(t.updatedAt).toLocaleTimeString()
      : "";
    row.textContent = `${t.name || "Ticket"} (${label}) – ${time}`;
    recentEl.appendChild(row);
  });
}

// QR code for public page
function setupQr() {
  const qrContainer = document.getElementById("displayQr");
  if (!qrContainer || typeof QRCode === "undefined") return;

  const origin = window.location.origin;
  const publicUrl = `${origin}/public.html?biz=${encodeURIComponent(
    businessId
  )}&queue=${encodeURIComponent(queueId)}&name=${encodeURIComponent(
    businessName
  )}`;

  qrContainer.innerHTML = "";
  new QRCode(qrContainer, {
    text: publicUrl,
    width: 220,
    height: 220,
  });
}

setupQr();
fetchTicketsForDisplay();
setInterval(fetchTicketsForDisplay, 5000);
