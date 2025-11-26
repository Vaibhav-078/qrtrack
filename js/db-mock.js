// js/db-mock.js
// Simple "fake database" using localStorage so we can add Firebase later easily.

function loadBusinesses() {
  const raw = localStorage.getItem("qrtrack_businesses");
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveBusinesses(list) {
  localStorage.setItem("qrtrack_businesses", JSON.stringify(list));
}

export function createBusiness({ name, email, password }) {
  const businesses = loadBusinesses();
  const existing = businesses.find((b) => b.email === email);
  if (existing) {
    throw new Error("Business with this email already exists");
  }
  const id = "biz_" + Date.now().toString(36);
  const business = { id, name, email, password };
  businesses.push(business);
  saveBusinesses(businesses);
  return business;
}

export function findBusinessByEmail(email) {
  const businesses = loadBusinesses();
  return businesses.find((b) => b.email === email) || null;
}

export function findBusinessById(id) {
  const businesses = loadBusinesses();
  return businesses.find((b) => b.id === id) || null;
}

// Auth helpers using sessionStorage
export function setCurrentBusinessId(id) {
  sessionStorage.setItem("qrtrack_current_business_id", id);
}

export function getCurrentBusinessId() {
  return sessionStorage.getItem("qrtrack_current_business_id");
}

export function clearCurrentBusinessId() {
  sessionStorage.removeItem("qrtrack_current_business_id");
}

// Tickets
function loadTicketsForBusiness(businessId) {
  const raw = localStorage.getItem("qrtrack_tickets_" + businessId);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveTicketsForBusiness(businessId, tickets) {
  localStorage.setItem("qrtrack_tickets_" + businessId, JSON.stringify(tickets));
}

export function createTicket({ businessId, customerName, serviceType }) {
  const tickets = loadTicketsForBusiness(businessId);
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const ticketNumber =
    "T-" + dateStr.replace(/-/g, "") + "-" + (tickets.length + 1).toString().padStart(3, "0");

  const ticket = {
    id: "t_" + now.getTime().toString(36),
    ticketNumber,
    businessId,
    customerName,
    serviceType,
    status: "waiting",
    createdAt: now.toISOString(),
    calledAt: null,
    completedAt: null
  };

  tickets.push(ticket);
  saveTicketsForBusiness(businessId, tickets);
  return ticket;
}

export function updateTicketStatus(businessId, ticketId, newStatus) {
  const tickets = loadTicketsForBusiness(businessId);
  const idx = tickets.findIndex((t) => t.id === ticketId);
  if (idx === -1) return null;
  const t = tickets[idx];
  t.status = newStatus;
  const nowIso = new Date().toISOString();
  if (newStatus === "serving") t.calledAt = nowIso;
  if (newStatus === "completed") t.completedAt = nowIso;
  tickets[idx] = t;
  saveTicketsForBusiness(businessId, tickets);
  return t;
}

export function getTodayTickets(businessId) {
  const tickets = loadTicketsForBusiness(businessId);
  const todayStr = new Date().toISOString().slice(0, 10);
  return tickets.filter((t) => t.createdAt.slice(0, 10) === todayStr);
}
