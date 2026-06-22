# Spotify AI Analytics & Recommendation Platform

AI-powered Spotify analytics and recommendation platform with taste vectors, explainable insights, and feedback-aware ranking.

This project turns exported Spotify listening history and live Spotify Web API signals into dashboard-style analytics and personalized recommendations. It focuses on behavior-driven feature engineering, user taste vectors, underplayed-track discovery, feedback learning, and transparent recommendation scores.

## What It Does

- Analyzes Spotify listening history across tracks, artists, albums, streams, minutes, and time windows.
- Builds artist and track recommendation lists using engineered listening-behavior features.
- Uses live Spotify signals when authenticated, including saved tracks, recently played tracks, followed artists, and top tracks.
- Lets users like/ignore recommendations and reranks future results around that feedback.
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
- Underplayed-track filtering
- Skip-rate, listen-strength, recency, and completion signals
- Recommendation evaluation metrics
- Spotify OAuth callback flow and Spotify Web API integration
- Cached artwork/ranking lookups in the frontend
- Trip playlist generation and survey-based preference inputs
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

### Public Listening Sync on Vercel

The deployed portfolio demo can show public dashboard/recommendation data without visitor login. Public data can include tracks, artists, albums, streams, minutes, ranking movement, recommendation results, and safe play timestamps.

Never expose these values in frontend code:

```text
SPOTIFY_REFRESH_TOKEN
SPOTIFY_CLIENT_SECRET
BLOB_READ_WRITE_TOKEN
CRON_SECRET
```

Set the server-only variables in Vercel Project Settings:

```bash
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_optional_for_confidential_auth
SPOTIFY_REFRESH_TOKEN=your_server_side_refresh_token
BLOB_READ_WRITE_TOKEN=your_vercel_blob_read_write_token
CRON_SECRET=generate_a_random_secret_at_least_16_chars
```

Attach a Vercel Blob store to persist synced plays across deployments. The sync JSON contains only safe public play metadata, not OAuth tokens.

The production cron is configured in `vercel.json`:

```json
{
  "path": "/api/listening/sync",
  "schedule": "0 3 * * *"
}
```

The Spotify Web API recently-played endpoint only returns the latest recent plays, not full lifetime history. This project keeps imported/exported history as the historical base and merges newly synced recent API plays into the public dashboard. Sync is idempotent and deduplicates by `track_id + played_at`.

Admin-only manual sync is available from the Dashboard `Sync now` button. The current admin login is a lightweight frontend session, so the server endpoint is intentionally idempotent and returns no secrets. A real backend auth layer should be added before expanding admin-only write actions beyond this portfolio demo.

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
