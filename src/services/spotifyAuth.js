const env = import.meta.env || {};
const CLIENT_ID = env.VITE_SPOTIFY_CLIENT_ID;
const CONFIGURED_REDIRECT_URI = env.VITE_SPOTIFY_REDIRECT_URI;
export const SPOTIFY_SCOPES = [
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
];

const SCOPES = SPOTIFY_SCOPES.join(" ");

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

export function generateAuthState(length = 32) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let state = "";

  for (let i = 0; i < length; i++) {
    state += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return state;
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
  state = "",
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

  if (state) {
    params.set("state", state);
  }

  return new URL(`https://accounts.spotify.com/authorize?${params.toString()}`);
}

export function getSpotifyCallbackErrorMessage({
  error = "",
  tokenError = null,
  missing = "",
} = {}) {
  if (error === "access_denied") {
    return "Spotify permission was denied. Click Continue with Spotify and approve the requested access to use your own data.";
  }

  if (error) {
    return `Spotify authorization failed: ${error}`;
  }

  if (missing === "state") {
    return "Spotify login session expired. Start the Spotify sign-in again.";
  }

  if (missing === "code") {
    return "Spotify did not return an authorization code. Start the Spotify sign-in again.";
  }

  if (missing === "config") {
    return "Spotify login is missing required browser configuration. Check the Spotify client ID and redirect URI.";
  }

  if (missing === "token") {
    return "Spotify did not return an access token. Start the Spotify sign-in again.";
  }

  const responseData = tokenError?.response?.data || {};
  const description = String(responseData.error_description || "");
  const spotifyError = String(responseData.error || "");

  if (/redirect/i.test(description) || spotifyError === "invalid_grant") {
    return "Spotify rejected the callback. Confirm this exact redirect URI is added in Spotify Developer Dashboard: https://spotify-ai-sooty.vercel.app/callback";
  }

  if (tokenError?.response?.status === 401 || spotifyError === "invalid_client") {
    return "Spotify rejected the app credentials. Check the Spotify Client ID configuration.";
  }

  if (tokenError?.message) {
    return `Spotify login failed: ${tokenError.message}`;
  }

  return "Spotify login failed. Try again.";
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
  const state = generateAuthState();
  sessionStorage.setItem("spotify_code_verifier", codeVerifier);
  sessionStorage.setItem("spotify_redirect_uri", redirectUri);
  sessionStorage.setItem("spotify_auth_state", state);
  const authorizeUrl = buildSpotifyAuthorizeUrl({
    clientId: CLIENT_ID,
    redirectUri,
    codeChallenge,
    state,
  });
  window.location.href = authorizeUrl.toString();
}
