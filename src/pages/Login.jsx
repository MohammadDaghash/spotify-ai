import React, { useEffect } from "react";
import { redirectToSpotifyLogin } from "../services/spotifyAuth";

function Login() {
  const handleLogin = () => {
    redirectToSpotifyLogin();
  };

  return (
    <div className="h-screen bg-black text-white flex items-center justify-center">
      <div className="bg-[#121212] p-8 rounded-lg w-[420px]">
        <h1 className="text-2xl font-bold mb-2">Spotify AI</h1>
        <p className="text-gray-400 mb-6">
          Login with Spotify to access recommendations & charts.
        </p>

        <button
          onClick={handleLogin}
          className="w-full bg-white text-black font-semibold py-2 rounded-full hover:scale-[1.02] transition"
        >
          Continue with Spotify
        </button>
      </div>
    </div>
  );
}

export default Login;
