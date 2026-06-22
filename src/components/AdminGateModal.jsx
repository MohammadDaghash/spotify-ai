import { useState } from "react";

import {
  getAdminUser,
  isAdmin,
  loginAdmin,
} from "../utils/adminAuth.js";

function AdminGateModal({
  actionLabel,
  isOpen,
  message = "Admin login required for editing recommendations.",
  onClose,
  onApproved,
  title = "Admin login required",
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail("");
    setError("");
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  const approve = (user) => {
    resetForm();
    onApproved?.(user);
  };

  const handleAdminLogin = (event) => {
    event?.preventDefault();

    const result = loginAdmin(email);

    if (!result.ok) {
      setError("That email is not allowed to use admin editing actions.");
      return;
    }

    approve(result.user);
  };

  const alreadyAdmin = isAdmin();

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xl flex items-center justify-center px-4">
      <div className="fade-in w-full max-w-md rounded-lg bg-[#181818] border border-white/10 p-6 text-white shadow-2xl">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#1db954]">
          Admin controls
        </p>
        <h2 className="page-title text-2xl font-bold">{title}</h2>

        <p className="text-sm text-gray-400 mt-3 leading-relaxed">
          {message}
        </p>

        {actionLabel && (
          <p className="text-sm text-gray-300 mt-3">
            Action: {actionLabel}
          </p>
        )}

        {alreadyAdmin ? (
          <button
            onClick={() => approve(getAdminUser())}
            className="mt-5 w-full rounded-full bg-white text-black font-semibold py-2"
            type="button"
          >
            Continue as admin
          </button>
        ) : (
          <form onSubmit={handleAdminLogin}>
            <label className="block text-sm text-gray-300 mt-5 mb-2">
              Admin email
            </label>
            <input
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              className="w-full rounded-lg bg-[#101010] border border-white/10 px-3 py-2 outline-none focus:border-[#1db954]"
              placeholder="admin@example.com"
              type="email"
            />

            {error && <p className="text-sm text-red-400 mt-2">{error}</p>}

            <button
              className="mt-5 w-full rounded-full bg-white text-black font-semibold py-2"
              type="submit"
            >
              Admin Login
            </button>
          </form>
        )}

        <button
          onClick={handleClose}
          className="mt-3 w-full rounded-full bg-[#2a2a2a] text-white font-semibold py-2"
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default AdminGateModal;
