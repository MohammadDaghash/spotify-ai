import assert from "node:assert/strict";

const store = new Map();

globalThis.localStorage = {
  getItem(key) {
    return store.has(key) ? store.get(key) : null;
  },
  setItem(key, value) {
    store.set(key, String(value));
  },
  removeItem(key) {
    store.delete(key);
  },
};

globalThis.window = {
  dispatchEvent() {},
};

const {
  getAdminUser,
  isAdmin,
  loginAdmin,
  logoutAdmin,
} = await import("../src/utils/adminAuth.js");

logoutAdmin();

assert.equal(isAdmin(), false);
assert.equal(getAdminUser(), null);

const deniedLogin = loginAdmin("viewer@example.com");

assert.equal(deniedLogin.ok, false);
assert.equal(isAdmin(), false);

const approvedLogin = loginAdmin("  MOHAMMAD.DA1212@GMAIL.COM ");

assert.equal(approvedLogin.ok, true);
assert.equal(isAdmin(), true);
assert.equal(getAdminUser().email, "mohammad.da1212@gmail.com");
assert.equal(getAdminUser().role, "admin");

logoutAdmin();

assert.equal(isAdmin(), false);
assert.equal(getAdminUser(), null);

console.log("Admin auth tests passed");
