#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import { platform } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_REDIRECT_URI = "http://127.0.0.1:8888/callback";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const DEFAULT_SCOPES = [
  "user-read-recently-played",
  "user-read-currently-playing",
];

function parseEnvText(text = "") {
  const env = {};

  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      env[key] = value;
    }
  }

  return env;
}

export function readEnvFiles(files = [".env", ".env.local"]) {
  return files.reduce((mergedEnv, file) => {
    if (typeof file === "string") {
      if (!existsSync(file)) return mergedEnv;

      return {
        ...mergedEnv,
        ...parseEnvText(readFileSync(file, "utf8")),
      };
    }

    if (!file?.exists) return mergedEnv;

    return {
      ...mergedEnv,
      ...parseEnvText(file.content),
    };
  }, {});
}

function getPortFromRedirectUri(redirectUri) {
  try {
    return Number(new URL(redirectUri).port || 80);
  } catch {
    return 8888;
  }
}

export function getSetupConfig(env = {}) {
  const clientId =
    env.SPOTIFY_CLIENT_ID || env.VITE_SPOTIFY_CLIENT_ID || "";
  const clientSecret = env.SPOTIFY_CLIENT_SECRET || "";
  const redirectUri =
    env.SPOTIFY_REFRESH_SETUP_REDIRECT_URI ||
    env.SPOTIFY_SYNC_REDIRECT_URI ||
    DEFAULT_REDIRECT_URI;
  const scopes = (
    env.SPOTIFY_REFRESH_SETUP_SCOPES || DEFAULT_SCOPES.join(" ")
  )
    .split(/\s+/)
    .filter(Boolean);

  return {
    clientId,
    clientSecret,
    redirectUri,
    port: getPortFromRedirectUri(redirectUri),
    scopes,
    usesClientSecret: Boolean(clientSecret),
  };
}

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function createCodeVerifier() {
  return base64Url(randomBytes(64));
}

export function createCodeChallenge(codeVerifier) {
  return base64Url(createHash("sha256").update(codeVerifier).digest());
}

export function buildAuthorizeUrl({
  clientId,
  redirectUri,
  scopes = DEFAULT_SCOPES,
  state,
  codeChallenge,
  usesClientSecret = false,
}) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    state,
  });

  if (!usesClientSecret) {
    params.set("code_challenge_method", "S256");
    params.set("code_challenge", codeChallenge);
  }

  return new URL(`https://accounts.spotify.com/authorize?${params.toString()}`);
}

export function buildTokenRequestOptions({
  code,
  clientId,
  clientSecret = "",
  redirectUri,
  codeVerifier = "",
}) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(
      `${clientId}:${clientSecret}`,
    ).toString("base64")}`;
  } else {
    body.set("client_id", clientId);
    body.set("code_verifier", codeVerifier);
  }

  return {
    method: "POST",
    headers,
    body,
  };
}

function openBrowser(url) {
  const command =
    platform() === "darwin"
      ? "open"
      : platform() === "win32"
        ? "cmd"
        : "xdg-open";
  const args =
    platform() === "win32" ? ["/c", "start", "", url] : [url];

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });

  child.unref();
}

async function exchangeCodeForTokens({
  code,
  clientId,
  clientSecret,
  redirectUri,
  codeVerifier,
}) {
  const response = await fetch(
    TOKEN_ENDPOINT,
    buildTokenRequestOptions({
      code,
      clientId,
      clientSecret,
      redirectUri,
      codeVerifier,
    }),
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error_description ||
        data.error ||
        `Spotify token exchange failed with ${response.status}`,
    );
  }

  if (!data.refresh_token) {
    throw new Error("Spotify did not return a refresh token.");
  }

  return data;
}

function writeHtml(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
  });
  res.end(body);
}

async function runSetup() {
  const env = {
    ...readEnvFiles(),
    ...process.env,
  };
  const config = getSetupConfig(env);

  if (!config.clientId) {
    console.error(
      "Missing SPOTIFY_CLIENT_ID or VITE_SPOTIFY_CLIENT_ID in .env/.env.local.",
    );
    process.exit(1);
  }

  const state = base64Url(randomBytes(24));
  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);
  const authorizeUrl = buildAuthorizeUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    scopes: config.scopes,
    state,
    codeChallenge,
    usesClientSecret: config.usesClientSecret,
  });

  console.log("Local Spotify refresh-token setup");
  console.log(`Redirect URI: ${config.redirectUri}`);
  console.log(
    "Add this exact redirect URI in Spotify Developer Dashboard before continuing.",
  );
  console.log(
    config.usesClientSecret
      ? "Mode: Authorization Code Flow with client secret."
      : "Mode: Authorization Code Flow with PKCE because SPOTIFY_CLIENT_SECRET was not found.",
  );
  console.log("Opening Spotify login in your browser...");

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", config.redirectUri);

    if (requestUrl.pathname !== new URL(config.redirectUri).pathname) {
      writeHtml(res, 404, "<h1>Not found</h1>");
      return;
    }

    const error = requestUrl.searchParams.get("error");
    const code = requestUrl.searchParams.get("code");
    const returnedState = requestUrl.searchParams.get("state");

    if (error) {
      writeHtml(res, 400, `<h1>Spotify authorization failed</h1><p>${error}</p>`);
      console.error(`Spotify authorization failed: ${error}`);
      server.close();
      return;
    }

    if (!code || returnedState !== state) {
      writeHtml(
        res,
        400,
        "<h1>Invalid Spotify callback</h1><p>Missing code or invalid state.</p>",
      );
      console.error("Invalid Spotify callback: missing code or invalid state.");
      server.close();
      return;
    }

    try {
      const tokens = await exchangeCodeForTokens({
        code,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
        codeVerifier,
      });

      writeHtml(
        res,
        200,
        "<h1>Refresh token generated</h1><p>Return to the terminal. The refresh token was printed there once.</p>",
      );

      console.log("\nSPOTIFY_REFRESH_TOKEN");
      console.log(tokens.refresh_token);
      console.log("\nAdd it to Vercel with:");
      console.log("npx vercel env add SPOTIFY_REFRESH_TOKEN production");
      console.log("npx vercel --prod --yes");

      if (config.usesClientSecret) {
        console.log(
          "\nBecause this token was generated with SPOTIFY_CLIENT_SECRET, add the same secret to Vercel if it is not already set:",
        );
        console.log("npx vercel env add SPOTIFY_CLIENT_SECRET production");
      } else {
        console.log(
          "\nSPOTIFY_CLIENT_SECRET is not required in Vercel for this PKCE-generated refresh token.",
        );
      }
    } catch (exchangeError) {
      writeHtml(
        res,
        500,
        `<h1>Token exchange failed</h1><p>${exchangeError.message}</p>`,
      );
      console.error(`Token exchange failed: ${exchangeError.message}`);
    } finally {
      server.close();
    }
  });

  server.listen(config.port, "127.0.0.1", () => {
    openBrowser(authorizeUrl.toString());
    console.log(
      `If the browser did not open, visit:\n${authorizeUrl.toString()}`,
    );
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runSetup().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
