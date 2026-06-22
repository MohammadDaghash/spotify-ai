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
