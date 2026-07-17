import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  getCurrentUser,
  getUserAuthAvailability,
  signInUser,
  signOutUser,
  signUpUser,
  USER_SESSION_CHANGED_EVENT,
} from "../services/userAuth.js";
import {
  getSpotifyRedirectUri,
  redirectToSpotifyLogin,
} from "../services/spotifyAuth";
import {
  readSpotifyHistoryFiles,
  returnToPublicDemoMode,
  saveLocalSpotifyHistory,
} from "../utils/localSpotifyHistory.js";

function readInitialSpotifyLoginError(search) {
  const params = new URLSearchParams(search);
  const callbackError =
    params.get("spotify_error") ||
    sessionStorage.getItem("spotify_auth_error") ||
    "";

  if (callbackError) {
    sessionStorage.removeItem("spotify_auth_error");
  }

  return callbackError;
}

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [importStatus, setImportStatus] = useState("");
  const [importError, setImportError] = useState("");
  const [spotifyLoginError, setSpotifyLoginError] = useState(() =>
    readInitialSpotifyLoginError(location.search),
  );
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountUser, setAccountUser] = useState(null);
  const requiredRedirectUri = getSpotifyRedirectUri();
  const accountAvailability = getUserAuthAvailability();

  useEffect(() => {
    let isMounted = true;

    async function loadAccountUser() {
      try {
        const user = await getCurrentUser();

        if (isMounted) {
          setAccountUser(user);
        }
      } catch {
        if (isMounted) {
          setAccountUser(null);
        }
      }
    }

    loadAccountUser();

    window.addEventListener(USER_SESSION_CHANGED_EVENT, loadAccountUser);
    window.addEventListener("focus", loadAccountUser);

    return () => {
      isMounted = false;
      window.removeEventListener(USER_SESSION_CHANGED_EVENT, loadAccountUser);
      window.removeEventListener("focus", loadAccountUser);
    };
  }, []);

  const handleLogin = async () => {
    try {
      setSpotifyLoginError("");
      await redirectToSpotifyLogin({
        authMode: "private",
        returnPath: "/dashboard",
      });
    } catch (error) {
      setSpotifyLoginError(
        error.message ||
          "Spotify login is not configured correctly for this deployment.",
      );
    }
  };

  const handleHistoryUpload = async (event) => {
    const files = event.target.files || [];

    if (files.length === 0) return;

    try {
      setImportStatus("Reading Spotify history files...");
      setImportError("");

      const entries = await readSpotifyHistoryFiles(files);

      if (entries.length === 0) {
        throw new Error(
          "No playable Spotify track rows were found in those files.",
        );
      }

      saveLocalSpotifyHistory(entries);
      setImportStatus(
        `Imported ${entries.length.toLocaleString()} safe listening rows into this browser.`,
      );
    } catch (error) {
      setImportStatus("");
      setImportError(error.message || "Could not import those files.");
    } finally {
      event.target.value = "";
    }
  };

  const handleBackToDemo = () => {
    returnToPublicDemoMode();
    navigate("/dashboard");
  };

  const handleAccountSubmit = async (mode) => {
    try {
      setAccountStatus("");
      setAccountError("");

      const action = mode === "signup" ? signUpUser : signInUser;
      const result = await action({
        email: accountEmail,
        password: accountPassword,
      });

      if (!result.ok) {
        throw new Error(result.error || "Account action failed.");
      }

      setAccountUser(result.user);
      setAccountPassword("");
      setAccountStatus(
        result.needsEmailConfirmation
          ? "Account created. Check your email to confirm your Supabase account."
          : result.localFallback
            ? "Local development account active in this browser."
            : "Personal account is active. Future feedback can be stored privately for this user.",
      );
    } catch (error) {
      setAccountError(error.message || "Could not update account session.");
    }
  };

  const handleAccountLogout = async () => {
    const result = await signOutUser();

    if (result.ok) {
      setAccountUser(null);
      setAccountStatus("Personal account signed out.");
      setAccountError("");
    } else {
      setAccountError(result.error || "Could not sign out.");
    }
  };

  return (
    <div className="app-shell min-h-screen bg-black text-white flex items-center justify-center px-4 py-10">
      <div className="fade-in bg-[#121212] p-8 rounded-lg w-full max-w-3xl border border-white/10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-[#1db954]">
              Personal mode
            </p>
            <h1 className="page-title text-4xl font-bold mb-3">
              Use your own data
            </h1>
            <p className="page-subtitle mb-6 max-w-xl">
              Sign in with Spotify for live data, or import your downloaded
              Spotify listening-history JSON files for full-history analytics.
            </p>
          </div>

          <button
            onClick={handleBackToDemo}
            className="text-sm text-gray-300 hover:text-white underline"
            type="button"
          >
            Back to demo
          </button>
        </div>

        <button
          onClick={handleLogin}
          className="w-full bg-white text-black font-semibold py-2 rounded-full hover:scale-[1.02] transition"
        >
          Continue with Spotify
        </button>

        {spotifyLoginError && (
          <div className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 p-4">
            <p className="text-sm font-semibold text-red-300">
              Spotify login is not ready
            </p>
            <p className="text-sm text-gray-300 mt-1">{spotifyLoginError}</p>
          </div>
        )}

        <div className="mt-4 rounded-lg border border-white/10 bg-[#181818] p-4">
          <p className="text-sm text-gray-300">
            Spotify Developer Dashboard must include this exact redirect URI:
          </p>
          <code className="mt-2 block break-all rounded bg-black px-3 py-2 text-sm text-[#1db954]">
            {requiredRedirectUri || "https://spotify-ai-sooty.vercel.app/callback"}
          </code>
        </div>

        <section className="mt-6 rounded-lg border border-white/10 bg-[#181818] p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#1db954]">
                Personal account
              </p>
              <h2 className="text-xl font-bold">Sign in / sign up</h2>
              <p className="mt-2 text-sm text-gray-400">
                This separates your private recommendation feedback from the
                public demo data. Spotify login still controls Spotify data
                access.
              </p>
            </div>

            <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-gray-300">
              {accountAvailability.configured
                ? "Supabase ready"
                : accountAvailability.localFallback
                  ? "Local dev mode"
                  : "Supabase required"}
            </span>
          </div>

          {accountUser ? (
            <div className="mt-4 rounded-lg border border-[#1db954]/30 bg-[#1db954]/10 p-4">
              <p className="text-sm font-semibold text-[#1db954]">
                Signed in as {accountUser.email}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Provider: {accountUser.provider}
              </p>
              <button
                className="mt-4 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                onClick={handleAccountLogout}
                type="button"
              >
                Sign out account
              </button>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
              <input
                aria-label="Account email"
                className="rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white"
                onChange={(event) => setAccountEmail(event.target.value)}
                placeholder="Email"
                type="email"
                value={accountEmail}
              />
              <input
                aria-label="Account password"
                className="rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white"
                onChange={(event) => setAccountPassword(event.target.value)}
                placeholder="Password"
                type="password"
                value={accountPassword}
              />
              <button
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
                onClick={() => handleAccountSubmit("signin")}
                type="button"
              >
                Sign in
              </button>
              <button
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                onClick={() => handleAccountSubmit("signup")}
                type="button"
              >
                Sign up
              </button>
            </div>
          )}

          {!accountAvailability.available && (
            <p className="mt-4 rounded-lg border border-yellow-300/30 bg-yellow-950/30 p-3 text-sm text-yellow-100">
              Supabase is not configured yet. Add VITE_SUPABASE_URL and
              VITE_SUPABASE_ANON_KEY to enable real personal accounts.
            </p>
          )}

          {accountStatus && (
            <p className="mt-4 text-sm text-green-400">{accountStatus}</p>
          )}

          {accountError && (
            <p className="mt-4 text-sm text-red-400">{accountError}</p>
          )}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <section className="bg-[#181818] rounded-lg p-5 border border-white/10">
            <h2 className="font-bold mb-3">Request your history</h2>
            <ol className="text-sm text-gray-400 space-y-3 list-decimal list-inside">
              <li>
                Open Spotify&apos;s{" "}
                <a
                  href="https://www.spotify.com/account/privacy/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#1db954] hover:underline"
                >
                  Account Privacy page
                </a>
                .
              </li>
              <li>Find Download your data.</li>
              <li>Request Extended streaming history.</li>
              <li>When Spotify emails the ZIP, upload the JSON files here.</li>
            </ol>

            <a
              href="https://support.spotify.com/us/article/understanding-your-data/"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-gray-500 hover:text-gray-300 inline-block mt-4"
            >
              Spotify data fields explained
            </a>
          </section>

          <section className="bg-[#181818] rounded-lg p-5 border border-white/10">
            <h2 className="font-bold mb-3">Import locally</h2>
            <p className="text-sm text-gray-400 mb-4">
              This first version keeps uploaded files in your browser only. It
              removes private export fields before analytics use.
            </p>

            <label className="block">
              <span className="sr-only">Upload Spotify JSON files</span>
              <input
                type="file"
                multiple
                accept=".json,application/json"
                onChange={handleHistoryUpload}
                className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-full file:border-0 file:bg-[#1db954] file:px-4 file:py-2 file:font-semibold file:text-black hover:file:bg-[#22c55e]"
              />
            </label>

            {importStatus && (
              <p className="text-sm text-green-400 mt-4">{importStatus}</p>
            )}

            {importError && (
              <p className="text-sm text-red-400 mt-4">{importError}</p>
            )}

            {importStatus && !importError && (
              <button
                onClick={() => navigate("/dashboard")}
                className="mt-4 w-full rounded-full bg-white text-black font-semibold py-2"
              >
                View my dashboard
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default Login;
