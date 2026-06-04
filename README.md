# Spotify AI ML Platform

A full-stack Spotify analytics and recommendation-system project built with React, FastAPI, Pandas, NumPy, scikit-learn, and the Spotify Web API.

The project started as a Spotify-style app and is being developed into a machine-learning portfolio project focused on music analytics, recommendation systems, feature engineering, feedback learning, and explainable recommendations.

---

## Current Status

The app now has a React frontend and a Python ML backend.

Current recommendation features use:

- Exported Spotify Extended Streaming History data
- Live Spotify API signals when logged in
- Pandas feature tables
- NumPy user vectors
- scikit-learn `StandardScaler`
- Cosine similarity ranking
- Local feedback learning from `Liked` and `Ignore` actions

Spotify does not expose full lifetime per-track play counts through the public Web API, so exact play-count filtering still depends on exported history JSON files.

---

## Main Features

- Listening analytics dashboard
- Top tracks, artists, and albums from local Spotify history
- Python ML artist recommender
- Python ML track recommender
- Recommendation filtering for songs played fewer than 10 times
- Live Spotify filtering using saved, recently played, and top tracks
- Liked/ignored feedback that affects future recommendations
- Feedback analytics panel
- Relative match scores with raw similarity shown for transparency
- Trip playlist generator
- Trip Group page with invite placeholders and survey-only members
- Artist preference survey: click `Like` or `Ignore`, minimum 5 choices
- Spotify playlist creation for generated trip playlists
- Artist pages and Spotify search integration

---

## Machine Learning Concepts Practiced

- Feature engineering with Pandas
- Multiple-feature recommendation scoring
- Feature scaling with scikit-learn
- NumPy vector creation and averaging
- Cosine similarity
- User taste vectors
- Skip-rate and listen-strength features
- Recency scoring
- Feedback-based reranking
- Recommendation evaluation metrics
- Group recommendation design

---

## Tech Stack

- React + Vite
- Tailwind CSS
- React Router
- Spotify Web API
- FastAPI
- Pandas
- NumPy
- scikit-learn
- Node.js / Express for existing AI/LLM utilities

---

## Project Structure

```txt
src/
  pages/
    Dashboard.jsx
    Recommendations.jsx
    Trip.jsx
    Model.jsx
  components/
    trip/
      ArtistPreferenceSurvey.jsx
  services/
    mlApi.js
    spotifyApi.js
    spotifyAuth.js
  data/
    spotify-history/

backend-ml/
  main.py
  services/
    spotify_parser.py
    recommender.py
  experiments/
    recommendation_experiment.py
  data/
    private/
```

---

## How To Run

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Start the Python ML backend

```bash
cd backend-ml
source venv/bin/activate
uvicorn main:app --reload --port 8001
```

The backend runs at:

```txt
http://127.0.0.1:8001
```

### 3. Start the React frontend

From the project root:

```bash
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```txt
http://127.0.0.1:5173
```

or:

```txt
http://127.0.0.1:5174
```

---

## Spotify Login Notes

Some features require Spotify authentication:

- Artist search
- Followed artist filtering
- Recently played/top/saved track signals
- Creating private Spotify playlists

Current scopes include:

```txt
user-read-private
user-read-email
user-library-read
user-follow-read
user-top-read
user-read-recently-played
playlist-modify-private
user-read-playback-state
user-modify-playback-state
```

If a Spotify feature fails after scope changes, log in again so Spotify grants the new permissions.

---

## ML Backend Endpoints

```txt
GET /health
GET /analytics/dashboard
GET /recommendations/artists
GET /recommendations/tracks
GET /recommendations/trip-playlists
GET /recommendations/artist-features
GET /recommendations/user-vector-artists
```

---

## Experiments

Run the recommendation experiment from `backend-ml`:

```bash
venv/bin/python experiments/recommendation_experiment.py
```

This script demonstrates the core ML flow:

```txt
load data -> build features -> scale features -> build user vector -> cosine similarity -> rank recommendations
```

---

## Current Limitations

- Exact song play counts are based on exported Spotify history snapshots.
- Live Spotify API data is partial and cannot replace full historical play counts.
- Trip playlists currently use the available backend data; true multi-user scoring is the next backend step.
- Email invites are placeholders stored locally; no real invite email is sent yet.
- Survey-only trip members are saved locally, but backend group scoring is not connected yet.

---

## Next Planned Work

- Backend group recommendation scoring from multiple member profiles
- Real invite and consent flow
- Persist feedback and trip members in a database
- Use survey-only member preferences in trip playlist generation
- Add richer track metadata when available
- Improve evaluation metrics for recommendation quality over time

---

## Credits

Base project adapted from a template by Rizik, with significant customization, analytics features, recommendation-system logic, and ML-oriented extensions added.
