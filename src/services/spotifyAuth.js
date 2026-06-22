const env = import.meta.env || {};
const CLIENT_ID = env.VITE_SPOTIFY_CLIENT_ID;
const CONFIGURED_REDIRECT_URI = env.VITE_SPOTIFY_REDIRECT_URI;
const SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-library-read",
  "user-follow-read",
  "user-top-read",
  "user-read-recently-played",
  "user-read-currently-playing",
  "playlist-modify-private",

  // REQUIRED FOR PLAY
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

function isLoopbackOrigin(origin) {
  return /^https?:\/\/(?:127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(
    String(origin || ""),
  );
}

export function getSpotifyRedirectUri({
  configuredRedirectUri = CONFIGURED_REDIRECT_URI,
  origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "",
} = {}) {
  const runtimeRedirectUri = origin ? `${origin}/callback` : "";
  const configuredValue = String(configuredRedirectUri || "").trim();

  if (!runtimeRedirectUri) {
    return configuredValue;
  }

  if (!configuredValue) {
    return runtimeRedirectUri;
  }

  try {
    const configuredUrl = new URL(configuredValue);
    const runtimeUrl = new URL(runtimeRedirectUri);

    if (configuredUrl.origin === runtimeUrl.origin) {
      return `${runtimeUrl.origin}/callback`;
    }

    if (isLoopbackOrigin(runtimeUrl.origin)) {
      return runtimeRedirectUri;
    }

    return runtimeRedirectUri;
  } catch {
    return runtimeRedirectUri;
  }
}

export function getSpotifyAuthConfigError({
  clientId = CLIENT_ID,
  redirectUri = getSpotifyRedirectUri(),
} = {}) {
  if (!clientId) {
    return "Spotify Client ID is not configured.";
  }

  if (!redirectUri) {
    return "Spotify redirect URI is not configured.";
  }

  return "";
}

export function generateCodeVerifier(length = 128) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let verifier = "";

  for (let i = 0; i < length; i++) {
    verifier += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return verifier;
}

export async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function buildSpotifyAuthorizeUrl({
  clientId = CLIENT_ID,
  redirectUri = getSpotifyRedirectUri(),
  codeChallenge,
  scopes = SCOPES,
}) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  return new URL(`https://accounts.spotify.com/authorize?${params.toString()}`);
}

export async function redirectToSpotifyLogin() {
  const redirectUri = getSpotifyRedirectUri();
  const configError = getSpotifyAuthConfigError({
    clientId: CLIENT_ID,
    redirectUri,
  });

  if (configError) {
    throw new Error(configError);
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  sessionStorage.setItem("spotify_code_verifier", codeVerifier);
  sessionStorage.setItem("spotify_redirect_uri", redirectUri);
  const authorizeUrl = buildSpotifyAuthorizeUrl({
    clientId: CLIENT_ID,
    redirectUri,
    codeChallenge,
  });
  window.location.href = authorizeUrl.toString();
}
