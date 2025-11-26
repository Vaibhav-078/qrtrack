// js/auth.js
// Handles login & signup for businesses using the localStorage "db".

import {
  createBusiness,
  findBusinessByEmail,
  setCurrentBusinessId
} from "./db-mock.js";

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

// Signup form
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;

    if (!name || !email || !password) {
      showToast("Please fill all fields", "error");
      return;
    }

    try {
      const business = createBusiness({ name, email, password });
      setCurrentBusinessId(business.id);
      showToast("Business registered successfully");
      const url = `admin.html?biz=${encodeURIComponent(business.id)}`;
      window.location.href = url;
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

// Login form
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    const business = findBusinessByEmail(email);
    if (!business || business.password !== password) {
      showToast("Invalid email or password", "error");
      return;
    }

    setCurrentBusinessId(business.id);
    showToast("Login successful");
    const url = `admin.html?biz=${encodeURIComponent(business.id)}`;
    window.location.href = url;
  });
}
