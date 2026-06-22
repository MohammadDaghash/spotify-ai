export const ADMIN_EMAIL = "mohammad.da1212@gmail.com";

const ADMIN_SESSION_KEY = "spotify_ai_admin_session";
const LEGACY_ADMIN_SESSION_KEY = "spotify_ai_demo_admin_email";
export const ADMIN_SESSION_CHANGED_EVENT = "spotify_ai_admin_session_changed";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getStoredSession() {
  if (typeof localStorage === "undefined") return null;

  try {
    const storedSession = JSON.parse(
      localStorage.getItem(ADMIN_SESSION_KEY) || "null",
    );

    if (storedSession) return storedSession;
  } catch {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }

  const legacyEmail = localStorage.getItem(LEGACY_ADMIN_SESSION_KEY);

  if (normalizeEmail(legacyEmail) === ADMIN_EMAIL) {
    return {
      email: ADMIN_EMAIL,
      role: "admin",
      loggedInAt: "",
    };
  }

  return null;
}

function notifyAdminSessionChanged() {
  if (
    typeof window === "undefined" ||
    typeof window.dispatchEvent !== "function"
  ) {
    return;
  }

  window.dispatchEvent(new Event(ADMIN_SESSION_CHANGED_EVENT));
}

export function getAdminUser() {
  const session = getStoredSession();

  if (normalizeEmail(session?.email) !== ADMIN_EMAIL) {
    return null;
  }

  return {
    email: ADMIN_EMAIL,
    role: "admin",
    loggedInAt: session.loggedInAt || "",
  };
}

export function isAdmin() {
  return Boolean(getAdminUser());
}

export function loginAdmin(email) {
  if (normalizeEmail(email) !== ADMIN_EMAIL) {
    return {
      ok: false,
      error: "Admin login required for editing recommendations.",
    };
  }

  const user = {
    email: ADMIN_EMAIL,
    role: "admin",
    loggedInAt: new Date().toISOString(),
  };

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(user));
    localStorage.removeItem(LEGACY_ADMIN_SESSION_KEY);
  }

  notifyAdminSessionChanged();

  return {
    ok: true,
    user,
  };
}

export function logoutAdmin() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(LEGACY_ADMIN_SESSION_KEY);
  }

  notifyAdminSessionChanged();
}
