import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  getSpotifyRedirectUri,
  redirectToSpotifyLogin,
} from "../services/spotifyAuth";
import {
  readSpotifyHistoryFiles,
  saveLocalSpotifyHistory,
} from "../utils/localSpotifyHistory.js";

function Login() {
  const navigate = useNavigate();
  const [importStatus, setImportStatus] = useState("");
  const [importError, setImportError] = useState("");
  const [spotifyLoginError, setSpotifyLoginError] = useState("");
  const requiredRedirectUri = getSpotifyRedirectUri();

  const handleLogin = async () => {
    try {
      setSpotifyLoginError("");
      await redirectToSpotifyLogin();
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

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-10">
      <div className="bg-[#121212] p-8 rounded-lg w-full max-w-3xl border border-white/10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">Use your own data</h1>
            <p className="text-gray-400 mb-6 max-w-xl">
              Sign in with Spotify for live data, or import your downloaded
              Spotify listening-history JSON files for full-history analytics.
            </p>
          </div>

          <Link
            to="/dashboard"
            className="text-sm text-gray-300 hover:text-white underline"
          >
            Back to demo
          </Link>
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
