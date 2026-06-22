import {
  ADMIN_EMAIL,
  getAdminUser,
  isAdmin,
  loginAdmin,
  logoutAdmin,
} from "./adminAuth.js";

export const DEMO_ADMIN_EMAIL = ADMIN_EMAIL;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isDemoAdminEmail(email) {
  return normalizeEmail(email) === ADMIN_EMAIL;
}

export function getDemoAdminEmail() {
  return getAdminUser()?.email || "";
}

export function isDemoAdminSession() {
  return isAdmin();
}

export function saveDemoAdminSession(email) {
  return loginAdmin(email).ok;
}

export function clearDemoAdminSession() {
  logoutAdmin();
}
