# Spotify AI Analytics & Recommendation Platform

AI-powered Spotify analytics and recommendation platform with taste vectors, explainable insights, and feedback-aware ranking.

This project turns exported Spotify listening history and live Spotify Web API signals into dashboard-style analytics and personalized recommendations. It focuses on behavior-driven feature engineering, user taste vectors, underplayed-track discovery, feedback learning, and transparent recommendation scores.

## What It Does

- Analyzes Spotify listening history across tracks, artists, albums, streams, minutes, and time windows.
- Builds artist and track recommendation lists using engineered listening-behavior features.
- Uses live Spotify signals when authenticated, including saved tracks, recently played tracks, followed artists, and top tracks.
- Lets users like/ignore recommendations and reranks future results around that feedback.
- Stores recommendation feedback as structured local events for future ML training.
- Shows score breakdowns, confidence, raw similarity, quality signals, and rank movement for transparency.
- Supports public demo data when Spotify login or the ML backend is not configured.
- Publishes the owner’s listening dashboard as a public portfolio demo while keeping OAuth secrets server-side.

## Key Features

- Listening analytics dashboard
- Top tracks, artists, and albums from local Spotify history
- FastAPI ML backend for analytics and recommendations
- Pandas feature tables for track and artist behavior
- NumPy user taste vectors and weighted averaging
- scikit-learn `StandardScaler`
- Cosine similarity ranking
- Feedback-aware artist/track reranking
- Structured feedback event logging for likes, ignores, saves, opens, and playlist creation
- Underplayed-track filtering
- Skip-rate, listen-strength, recency, and completion signals
- Recommendation evaluation metrics
- Spotify OAuth callback flow and Spotify Web API integration
- Cached artwork/ranking lookups in the frontend
- Group Mix playlist generation and survey-based preference inputs
- Public Spotify sync status with admin-gated manual sync

## Tech Stack

- React + Vite
- React Router
- Tailwind CSS
- Recharts
- FastAPI
- Python
- Pandas
- NumPy
- scikit-learn
- Spotify Web API
- Node.js / Express and OpenAI utility endpoint
- Vercel configuration

## Architecture / How It Works

```text
Spotify history JSON + live Spotify signals
        |
        v
FastAPI ML backend
        |
        v
Pandas feature engineering
        |
        v
Scaled feature matrix + user taste vector
        |
        v
Cosine similarity + quality signals + feedback reranking
        |
        v
React dashboard and recommendation UI
```

Important modules:

- `backend-ml/main.py` exposes analytics, recommendation, and listening-sync endpoints.
- `backend-ml/services/spotify_parser.py` loads, cleans, filters, deduplicates, and ranks listening history.
- `backend-ml/services/recommender.py` builds feature tables, user vectors, similarity scores, quality scores, and final ranked recommendations.
- `backend-ml/services/listening_sync.py` stores recent live Spotify plays locally and merges them with exported history.
- `src/services/mlApi.js` connects the React app to the ML backend and demo fallback data.
- `src/utils/feedbackEvents.js` stores local structured recommendation events for later supervised-learning work.
- `api/listening/*.js` syncs recent Spotify plays server-side for the public Vercel demo.
- `api/lib/publicListeningSync.js` refreshes Spotify access server-side, deduplicates plays, and stores safe public play data.
- `src/pages/Dashboard.jsx` renders analytics, rank movement, artwork lookup, and listening summaries.
- `src/pages/Recommendations.jsx` renders recommendation cards, feedback actions, scoring explanations, and trip playlist flows.

## Screenshots

Screenshots are not committed yet. Recommended captures:

- Listening analytics dashboard
- Track recommendation cards with score breakdown
- Artist recommendations
- Feedback analytics / ranking movement
- Trip playlist page

## Setup

### Frontend

```bash
npm install
npm run dev
```

### ML Backend

```bash
cd backend-ml
source venv/bin/activate
uvicorn main:app --reload --port 8001
```

The backend runs at:

```text
http://127.0.0.1:8001
```

Optional frontend environment variable:

```bash
VITE_ML_API_URL=http://127.0.0.1:8001
```

### Spotify Login

Public demo pages do not require Spotify login. Spotify login is needed for live Spotify data, artwork/search helpers, and private playlist creation.

The callback route is:

```text
/callback
```

For the deployed demo referenced in the app, the Spotify Developer Dashboard redirect URI must be:

```text
https://spotify-ai-sooty.vercel.app/callback
```

For local development, use the exact Vite origin:

```text
http://127.0.0.1:5173/callback
http://127.0.0.1:5174/callback
```

### Spotify Development Mode and Test Users

Spotify app mode is not exposed to this codebase or the Vercel deployment. Spotify documents app status and allowlisting in its [quota modes guide](https://developer.spotify.com/documentation/web-api/concepts/quota-modes). Verify the current mode in Spotify Developer Dashboard:

1. Open [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Select the Spotify app used by `VITE_SPOTIFY_CLIENT_ID`.
3. Open **Settings**.
4. Check **App Status**.

If the app is in **Development Mode**, random public visitors cannot fully use Spotify sign-in unless they are allowlisted. Spotify may let them complete the login screen, but Web API calls can return `403` until they are added as test users.

To add test users:

1. Open [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Select the app.
3. Open **Settings**.
4. Open **Users Management**.
5. Click **Add new user**.
6. Enter the tester's name and the exact email address on their Spotify account.
7. Ask the tester to try **Continue with Spotify** again.

Development Mode is suitable for the owner and a small allowlist. For random public visitors to sign in with their own Spotify accounts, request Spotify extended quota mode from the app's dashboard.

### Generate `SPOTIFY_REFRESH_TOKEN`

The production sync job needs a server-side Spotify refresh token. Generate it locally only; do not commit it and do not put it in frontend `VITE_` variables.

1. In Spotify Developer Dashboard, add this exact redirect URI to the same Spotify app:

```text
http://127.0.0.1:8888/callback
```

2. Make sure `.env` has `VITE_SPOTIFY_CLIENT_ID` or `SPOTIFY_CLIENT_ID`.

3. Optional: add `SPOTIFY_CLIENT_SECRET` to `.env` if you want the helper to use classic Authorization Code Flow. If no secret is present, the helper uses Authorization Code Flow with PKCE.

4. Run:

```bash
npm run setup:spotify-refresh-token
```

5. Log in with Spotify. The terminal prints the refresh token once.

6. Add it to Vercel:

```bash
npx vercel env add SPOTIFY_REFRESH_TOKEN production
npx vercel --prod --yes
```

If the helper used `SPOTIFY_CLIENT_SECRET`, also add the same secret to Vercel:

```bash
npx vercel env add SPOTIFY_CLIENT_SECRET production
npx vercel --prod --yes
```

If the helper used PKCE because no `SPOTIFY_CLIENT_SECRET` was found, `SPOTIFY_CLIENT_SECRET` is not required in Vercel.

### Public Listening Sync on Vercel

The deployed portfolio demo can show public dashboard/recommendation data without visitor login. Public data can include tracks, artists, albums, streams, minutes, ranking movement, recommendation results, and safe play timestamps.

Never expose these values in frontend code:

```text
SPOTIFY_REFRESH_TOKEN
SPOTIFY_CLIENT_SECRET
BLOB_READ_WRITE_TOKEN
CRON_SECRET
ADMIN_SESSION_SECRET
```

Set the server-only variables in Vercel Project Settings:

```bash
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_optional_for_confidential_auth
SPOTIFY_REFRESH_TOKEN=your_server_side_refresh_token
BLOB_READ_WRITE_TOKEN=your_vercel_blob_read_write_token
CRON_SECRET=generate_a_random_secret_at_least_16_chars
ADMIN_SESSION_SECRET=generate_a_different_random_secret_at_least_32_chars
```

Attach a Vercel Blob store to persist synced plays across deployments. The sync JSON contains only safe public play metadata, not OAuth tokens.

The production Vercel Cron is configured in `vercel.json`:

```json
{
  "path": "/api/listening/sync",
  "schedule": "0 3 * * *"
}
```

Vercel Cron calls that route as `GET /api/listening/sync` and must send `Authorization: Bearer <CRON_SECRET>`. The endpoint rejects scheduled sync requests if `CRON_SECRET` is missing or does not match.

The current production cadence is daily at 03:00 UTC so it works on Vercel Hobby. Spotify's recently-played API only returns the latest batch of plays, so very active days can still miss some plays unless the admin uses **Sync now**. When the project upgrades to a Vercel plan that supports sub-daily cron, change the schedule back to `*/30 * * * *` or another 30-60 minute interval.

The Spotify Web API recently-played endpoint only returns the latest recent plays, not full lifetime history. This project keeps imported/exported history as the historical base and merges newly synced recent API plays into the public dashboard. Sync is idempotent and deduplicates by `track_id + played_at`.

Admin-only manual sync is available from the Dashboard `Sync now` button. The admin modal creates a signed HttpOnly cookie through `/api/admin/login`; the sync endpoint rejects POST requests without that cookie. Recommendation feedback still uses lightweight frontend admin mode until a full backend user system is added.

Public sync endpoints:

```text
GET  /api/listening/status
GET  /api/listening/recent
GET  /api/listening/sync   # Vercel Cron
POST /api/listening/sync   # admin-gated UI action
```

## ML Backend Endpoints

```text
GET  /health
GET  /analytics/dashboard
GET  /recommendations/artists
GET  /recommendations/tracks
GET  /recommendations/trip-playlists
GET  /recommendations/artist-features
GET  /recommendations/user-vector-artists
POST /listening/recently-played
GET  /listening/status
GET  /listening/recently-played
```

## What This Demonstrates

- Recommendation-system feature engineering from real behavior logs
- User-vector modeling with Pandas, NumPy, and scikit-learn
- Cosine similarity ranking plus quality/novelty/recency signals
- Feedback-aware reranking and explainable recommendations
- Full-stack ML product architecture with React and FastAPI
- Practical handling of partial live API data versus exported history

## Roadmap

- Backend group recommendation scoring from multiple member profiles
- Persistent feedback and trip member storage
- Richer metadata features when available
- More formal recommendation evaluation over time

## Notes

Exact lifetime per-track play counts depend on exported Spotify history files because the public Spotify Web API does not expose full lifetime listening history.
