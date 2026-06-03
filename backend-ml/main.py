from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.spotify_parser import (
    get_summary,
    get_top_tracks,
    get_top_artists,
    get_top_albums,
)

DATA_FILE = "data/private"

app = FastAPI(title="Spotify AI ML Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Spotify AI ML Backend is running",
        "status": "ok"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.get("/analytics/summary")
def summary():
    return get_summary(DATA_FILE)


@app.get("/analytics/top-tracks")
def top_tracks():
    return {
        "tracks": get_top_tracks(DATA_FILE, limit=10)
    }


@app.get("/analytics/top-artists")
def top_artists():
    return {
        "artists": get_top_artists(DATA_FILE, limit=10)
    }


@app.get("/analytics/top-albums")
def top_albums():
    return {
        "albums": get_top_albums(DATA_FILE, limit=10)
    }

@app.get("/analytics/dashboard")
def dashboard_analytics(
    sort_by: str = "minutes",
    time_range: str = "all",
    year: str = "all"
):
    if sort_by not in ["minutes", "streams"]:
        sort_by = "minutes"

    return {
        "summary": get_summary(DATA_FILE, time_range=time_range, year=year),
        "top_tracks": get_top_tracks(DATA_FILE, limit=20, sort_by=sort_by, time_range=time_range, year=year),
        "top_artists": get_top_artists(DATA_FILE, limit=20, sort_by=sort_by, time_range=time_range, year=year),
        "top_albums": get_top_albums(DATA_FILE, limit=20, sort_by=sort_by, time_range=time_range, year=year),
    }