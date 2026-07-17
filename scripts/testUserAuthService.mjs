import assert from "node:assert/strict";

import {
  USER_SESSION_CHANGED_EVENT,
  clearLocalUserSession,
  getUserAuthAvailability,
  getUserAuthConfig,
  mapSupabaseSessionToUser,
  readLocalUserSession,
  signInUser,
  signOutUser,
  signUpUser,
} from "../src/services/userAuth.js";

function createStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

const storage = createStorage();
let dispatchedEventName = "";

globalThis.window = {
  dispatchEvent(event) {
    dispatchedEventName = event.type;
  },
};

assert.deepEqual(
  getUserAuthConfig({
    VITE_SUPABASE_URL: "https://project.supabase.co",
    VITE_SUPABASE_ANON_KEY: "anon-key",
  }),
  {
    configured: true,
    url: "https://project.supabase.co",
    anonKey: "anon-key",
  },
);

assert.deepEqual(getUserAuthConfig({}), {
  configured: false,
  url: "",
  anonKey: "",
});

assert.equal(
  getUserAuthAvailability({
    DEV: false,
    VITE_SUPABASE_URL: "",
    VITE_SUPABASE_ANON_KEY: "",
  }).available,
  false,
);
assert.equal(
  getUserAuthAvailability({
    DEV: true,
    VITE_SUPABASE_URL: "",
    VITE_SUPABASE_ANON_KEY: "",
  }).localFallback,
  true,
);

const mappedUser = mapSupabaseSessionToUser({
  user: {
    id: "user-id",
    email: "User@Example.com",
  },
});

assert.deepEqual(mappedUser, {
  id: "user-id",
  email: "user@example.com",
  provider: "supabase",
});

const localSignIn = await signInUser({
  email: " Local@Example.com ",
  password: "password123",
  env: { DEV: true },
  storage,
});

assert.equal(localSignIn.ok, true);
assert.equal(localSignIn.user.email, "local@example.com");
assert.equal(localSignIn.user.provider, "local-dev");
assert.equal(readLocalUserSession({ storage }).email, "local@example.com");
assert.equal(dispatchedEventName, USER_SESSION_CHANGED_EVENT);

clearLocalUserSession({ storage });
assert.equal(readLocalUserSession({ storage }), null);

const fakeSupabaseClient = {
  auth: {
    async signUp({ email }) {
      return {
        data: {
          session: {
            user: {
              id: "supabase-user",
              email,
            },
          },
        },
        error: null,
      };
    },
    async signInWithPassword({ email }) {
      return {
        data: {
          session: {
            user: {
              id: "supabase-user",
              email,
            },
          },
        },
        error: null,
      };
    },
    async signOut() {
      return { error: null };
    },
  },
};

const signedUp = await signUpUser({
  email: "supabase@example.com",
  password: "password123",
  supabaseClient: fakeSupabaseClient,
});

assert.equal(signedUp.ok, true);
assert.equal(signedUp.user.provider, "supabase");

const signedIn = await signInUser({
  email: "supabase@example.com",
  password: "password123",
  supabaseClient: fakeSupabaseClient,
});

assert.equal(signedIn.ok, true);
assert.equal(signedIn.user.id, "supabase-user");

const signedOut = await signOutUser({
  supabaseClient: fakeSupabaseClient,
  storage,
});

assert.equal(signedOut.ok, true);

console.log("User auth service tests passed");
