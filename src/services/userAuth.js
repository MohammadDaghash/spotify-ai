export const USER_SESSION_CHANGED_EVENT = "spotify_ai_user_session_changed";

const LOCAL_USER_SESSION_KEY = "spotify_ai_local_user_session";
let supabaseClientPromise = null;

function getViteEnv() {
  return import.meta.env || {};
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getDefaultStorage() {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function notifyUserSessionChanged() {
  if (
    typeof window === "undefined" ||
    typeof window.dispatchEvent !== "function"
  ) {
    return;
  }

  window.dispatchEvent(new Event(USER_SESSION_CHANGED_EVENT));
}

export function getUserAuthConfig(env = getViteEnv()) {
  const url = String(env.VITE_SUPABASE_URL || "").trim();
  const anonKey = String(
    env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  ).trim();

  return {
    configured: Boolean(url && anonKey),
    url,
    anonKey,
  };
}

export function getUserAuthAvailability(env = getViteEnv()) {
  const config = getUserAuthConfig(env);
  const localFallback =
    env.DEV === true || env.VITE_ENABLE_LOCAL_USER_AUTH === "true";

  return {
    ...config,
    localFallback,
    available: config.configured || localFallback,
  };
}

export async function getSupabaseClient({ env = getViteEnv() } = {}) {
  const config = getUserAuthConfig(env);

  if (!config.configured) return null;

  if (!supabaseClientPromise) {
    supabaseClientPromise = import("@supabase/supabase-js").then(
      ({ createClient }) =>
        createClient(config.url, config.anonKey, {
          auth: {
            autoRefreshToken: true,
            detectSessionInUrl: true,
            persistSession: true,
          },
        }),
    );
  }

  return supabaseClientPromise;
}

export function mapSupabaseSessionToUser(session) {
  const user = session?.user;

  if (!user?.id || !user?.email) return null;

  return {
    id: user.id,
    email: normalizeEmail(user.email),
    provider: "supabase",
  };
}

export function readLocalUserSession({ storage = getDefaultStorage() } = {}) {
  if (!storage) return null;

  try {
    const session = JSON.parse(
      storage.getItem(LOCAL_USER_SESSION_KEY) || "null",
    );

    if (!session?.id || !session?.email) return null;

    return {
      id: session.id,
      email: normalizeEmail(session.email),
      provider: session.provider || "local-dev",
    };
  } catch {
    storage.removeItem(LOCAL_USER_SESSION_KEY);
    return null;
  }
}

export function clearLocalUserSession({ storage = getDefaultStorage() } = {}) {
  storage?.removeItem(LOCAL_USER_SESSION_KEY);
  notifyUserSessionChanged();
}

function saveLocalUserSession({ email, storage = getDefaultStorage() } = {}) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !storage) return null;

  const user = {
    id: `local:${normalizedEmail}`,
    email: normalizedEmail,
    provider: "local-dev",
  };

  storage.setItem(LOCAL_USER_SESSION_KEY, JSON.stringify(user));
  notifyUserSessionChanged();

  return user;
}

export async function getCurrentUser({
  env = getViteEnv(),
  storage = getDefaultStorage(),
  supabaseClient,
} = {}) {
  const client = supabaseClient || (await getSupabaseClient({ env }));

  if (client) {
    const { data, error } = await client.auth.getSession();

    if (error) throw error;

    return mapSupabaseSessionToUser(data?.session);
  }

  return readLocalUserSession({ storage });
}

function validateEmailPassword(email, password) {
  if (!normalizeEmail(email)) {
    return "Email is required.";
  }

  if (String(password || "").length < 6) {
    return "Password must be at least 6 characters.";
  }

  return "";
}

export async function signUpUser({
  email,
  password,
  env = getViteEnv(),
  storage = getDefaultStorage(),
  supabaseClient,
} = {}) {
  const validationError = validateEmailPassword(email, password);

  if (validationError) return { ok: false, error: validationError };

  const client = supabaseClient || (await getSupabaseClient({ env }));

  if (client) {
    const { data, error } = await client.auth.signUp({
      email: normalizeEmail(email),
      password,
    });

    if (error) return { ok: false, error: error.message };

    notifyUserSessionChanged();

    return {
      ok: true,
      user: mapSupabaseSessionToUser(data?.session) ||
        (data?.user
          ? {
              id: data.user.id,
              email: normalizeEmail(data.user.email),
              provider: "supabase",
            }
          : null),
      needsEmailConfirmation: Boolean(data?.user && !data?.session),
    };
  }

  if (!getUserAuthAvailability(env).localFallback) {
    return {
      ok: false,
      error:
        "Personal accounts require Supabase setup. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    };
  }

  return {
    ok: true,
    user: saveLocalUserSession({ email, storage }),
    localFallback: true,
  };
}

export async function signInUser({
  email,
  password,
  env = getViteEnv(),
  storage = getDefaultStorage(),
  supabaseClient,
} = {}) {
  const validationError = validateEmailPassword(email, password);

  if (validationError) return { ok: false, error: validationError };

  const client = supabaseClient || (await getSupabaseClient({ env }));

  if (client) {
    const { data, error } = await client.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (error) return { ok: false, error: error.message };

    notifyUserSessionChanged();

    return {
      ok: true,
      user: mapSupabaseSessionToUser(data?.session),
    };
  }

  if (!getUserAuthAvailability(env).localFallback) {
    return {
      ok: false,
      error:
        "Personal accounts require Supabase setup. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    };
  }

  return {
    ok: true,
    user: saveLocalUserSession({ email, storage }),
    localFallback: true,
  };
}

export async function signOutUser({
  env = getViteEnv(),
  storage = getDefaultStorage(),
  supabaseClient,
} = {}) {
  const client = supabaseClient || (await getSupabaseClient({ env }));

  if (client) {
    const { error } = await client.auth.signOut();

    if (error) return { ok: false, error: error.message };
  }

  clearLocalUserSession({ storage });

  return { ok: true };
}
