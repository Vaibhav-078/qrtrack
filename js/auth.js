// js/auth.js
// Handles login & signup for businesses using the real backend API (MongoDB).

const toast = document.getElementById("toast");
let toastTimeout;

function showToast(message, type = "success") {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden", "toast-success", "toast-error");
  toast.classList.add(type === "error" ? "toast-error" : "toast-success");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}

// Tabs
const tabLogin = document.getElementById("tabLogin");
const tabSignup = document.getElementById("tabSignup");
const loginPane = document.getElementById("loginPane");
const signupPane = document.getElementById("signupPane");

if (tabLogin && tabSignup && loginPane && signupPane) {
  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
    loginPane.classList.remove("hidden");
    signupPane.classList.add("hidden");
  });
  tabSignup.addEventListener("click", () => {
    tabSignup.classList.add("active");
    tabLogin.classList.remove("active");
    signupPane.classList.remove("hidden");
    loginPane.classList.add("hidden");
  });
}

// Helper: call backend
async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    // ignore
  }

  if (!res.ok) {
    const msg = (data && data.error) || "Request failed";
    throw new Error(msg);
  }
  return data;
}

/* ========== SIGNUP ========== */

const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;

    if (!name || !email || !password) {
      showToast("Please fill all fields", "error");
      return;
    }

    try {
      // yaha backend pe business create hoga (MongoDB me)
      const data = await apiPost("/api/register", {
        businessName: name,
        email,
        password,
      });

      const bizId = data.businessId;
      const bizName = data.businessName || name;

      // optional: localStorage me store kar sakte ho
      localStorage.setItem(
        "qrtrack_current_business",
        JSON.stringify({ bizId, bizName, email })
      );

      showToast("Business registered successfully");

      // admin ko redirect
      const url = `admin.html?biz=${encodeURIComponent(
        bizId
      )}&queue=${encodeURIComponent(
        "defaultQueue"
      )}&name=${encodeURIComponent(bizName)}`;
      window.location.href = url;
    } catch (err) {
      console.error(err);
      showToast(err.message || "Registration failed", "error");
    }
  });
}

/* ========== LOGIN ========== */

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
      showToast("Please enter email and password", "error");
      return;
    }

    try {
      const data = await apiPost("/api/login", { email, password });

      const bizId = data.businessId;
      const bizName = data.businessName || "QRtrack";

      localStorage.setItem(
        "qrtrack_current_business",
        JSON.stringify({ bizId, bizName, email })
      );

      showToast("Login successful");

      const url = `admin.html?biz=${encodeURIComponent(
        bizId
      )}&queue=${encodeURIComponent(
        "defaultQueue"
      )}&name=${encodeURIComponent(bizName)}`;
      window.location.href = url;
    } catch (err) {
      console.error(err);
      showToast(err.message || "Invalid email or password", "error");
    }
  });
}
