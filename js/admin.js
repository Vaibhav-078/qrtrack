// js/admin.js

// -------- URL PARAMS --------
const urlParams = new URLSearchParams(window.location.search);
const businessId = urlParams.get("biz") || "defaultBiz";
const queueId = urlParams.get("queue") || "defaultQueue";
const businessName = urlParams.get("name") || "QRtrack";
const businessEmail = urlParams.get("email") || "";

// -------- DOM REFS --------
const nameEl = document.getElementById("businessName");
const emailEl = document.getElementById("businessEmail");
const publicInput = document.getElementById("publicUrl");
const copyBtn = document.getElementById("copyUrlBtn");
const qrEl = document.getElementById("adminQr");
const ticketsTableBody = document.getElementById("ticketsTable");
const statWaiting = document.getElementById("statWaiting");
const statServing = document.getElementById("statServing");
const statCompleted = document.getElementById("statCompleted");
const statCancelled = document.getElementById("statCancelled");
const openPublicLink = document.getElementById("openPublic");
const openDisplayLink = document.getElementById("openDisplay");
const logoutBtn = document.getElementById("logoutBtn");

const counterNameInput = document.getElementById("counterName");
const serviceTypeSelect = document.getElementById("serviceType");
const generateCounterBtn = document.getElementById("generateCounterTicket");
const newTicketDisplay = document.getElementById("newTicketDisplay");

// Header text
if (nameEl) nameEl.textContent = `${businessName} - Admin`;
if (emailEl) emailEl.textContent = businessEmail || "";

// ⚠️ Yahi origin use hoga – Node server ka
const origin = window.location.origin;

// Public / Display URLs
const publicUrl = `${origin}/public.html?biz=${encodeURIComponent(
  businessId
)}&queue=${encodeURIComponent(queueId)}&name=${encodeURIComponent(
  businessName
)}`;
const displayUrl = `${origin}/display.html?biz=${encodeURIComponent(
  businessId
)}&queue=${encodeURIComponent(queueId)}&name=${encodeURIComponent(
  businessName
)}`;

if (publicInput) publicInput.value = publicUrl;
if (openPublicLink) openPublicLink.href = publicUrl;
if (openDisplayLink) openDisplayLink.href = displayUrl;

// QR on admin
if (qrEl && typeof QRCode !== "undefined") {
  qrEl.innerHTML = "";
  new QRCode(qrEl, {
    text: publicUrl,
    width: 160,
    height: 160,
  });
}

// Copy URL button
if (copyBtn && publicInput) {
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(publicInput.value);
      showToast("Public URL copied");
    } catch (e) {
      console.error(e);
      showToast("Unable to copy URL");
    }
  });
}

// Toast helper
function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove("hidden");
  toast.classList.add("toast-success");
  setTimeout(() => {
    toast.classList.add("hidden");
    toast.classList.remove("toast-success");
  }, 2200);
}

// -------- FETCH TICKETS --------
async function fetchTickets() {
  try {
    const query = new URLSearchParams({ businessId, queueId });
    const res = await fetch(`/api/tickets?${query.toString()}`);
    const data = await res.json();

    console.log("Tickets response:", res.status, data);

    if (!res.ok) {
      throw new Error(data.error || "Failed to load tickets");
    }

    renderTickets(data);
    updateStats(data);
  } catch (err) {
    console.error("fetchTickets error:", err);
    showToast("Error loading tickets");
  }
}

function updateStats(tickets) {
  const counts = {
    waiting: 0,
    next: 0,
    serving: 0,
    completed: 0,
    cancelled: 0,
  };

  tickets.forEach((t) => {
    if (counts[t.status] !== undefined) counts[t.status]++;
  });

  if (statWaiting) statWaiting.textContent = counts.waiting;
  if (statServing) statServing.textContent = counts.next + counts.serving;
  if (statCompleted) statCompleted.textContent = counts.completed;
  if (statCancelled) statCancelled.textContent = counts.cancelled;
}

function renderTickets(tickets) {
  if (!ticketsTableBody) return;
  ticketsTableBody.innerHTML = "";

  if (!tickets.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "No tickets yet.";
    td.style.textAlign = "center";
    tr.appendChild(td);
    ticketsTableBody.appendChild(tr);
    return;
  }

  tickets.forEach((t, index) => {
    const tr = document.createElement("tr");
    const created = t.createdAt
      ? new Date(t.createdAt).toLocaleTimeString()
      : "-";
    const service = t.issue || t.service || "—";

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${t.name || "-"}</td>
      <td>${service}</td>
      <td>${t.status}</td>
      <td>${created}</td>
      <td>
        <button data-action="next" data-id="${t._id}">Next</button>
        <button data-action="serving" data-id="${t._id}">Serving</button>
        <button data-action="completed" data-id="${t._id}">Done</button>
        <button data-action="cancelled" data-id="${t._id}">Cancel</button>
      </td>
    `;

    ticketsTableBody.appendChild(tr);
  });

  ticketsTableBody.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-id");
      const action = e.target.getAttribute("data-action");
      let status;

      if (action === "next") status = "next";
      else if (action === "serving") status = "serving";
      else if (action === "completed") status = "completed";
      else if (action === "cancelled") status = "cancelled";

      if (!status) return;
      await updateTicketStatus(id, status);
      await fetchTickets();
    });
  });
}

// -------- UPDATE STATUS --------
async function updateTicketStatus(ticketId, status) {
  try {
    const res = await fetch(`/api/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to update status");
    }

    if (status === "next") {
      showToast("User notified: ticket is NEXT");
    } else {
      showToast(`Ticket marked as ${status}`);
    }
  } catch (err) {
    console.error("updateTicketStatus error:", err);
    showToast("Error updating ticket");
  }
}

// -------- COUNTER: CREATE TICKET --------
if (generateCounterBtn) {
  generateCounterBtn.addEventListener("click", async () => {
    const name = counterNameInput.value.trim();
    const service = serviceTypeSelect.value || "General";

    if (!name) {
      showToast("Enter customer name");
      return;
    }

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          queueId,
          name,
          issue: service,
          notifyPush: false,
          notifyWhatsapp: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create ticket");
      }

      const label = data._id ? data._id.toString().slice(-5) : "";
      if (newTicketDisplay) {
        newTicketDisplay.textContent = `New ticket: ${label}`;
      }

      counterNameInput.value = "";
      await fetchTickets();
      showToast("Ticket generated at counter");
    } catch (err) {
      console.error("counter create error:", err);
      showToast("Error generating ticket");
    }
  });
}

// -------- LOGOUT --------
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

// -------- INIT --------
fetchTickets();
setInterval(fetchTickets, 5000);
