from fastapi import FastAPI
from fastapi import Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from services.recommender import (
    get_artist_recommendations,
    get_track_recommendations,
    get_trip_playlists,
    build_artist_features,
    get_top_user_artists,
)
from services.spotify_parser import (
    load_combined_spotify_history,
    get_summary,
    get_top_tracks,
    get_top_artists,
    get_top_albums,
)
from services.listening_sync import (
    get_recent_synced_plays,
    get_sync_status,
    upsert_recent_plays,
)

DATA_FILE = "data/private"

app = FastAPI(title="Spotify AI ML Backend")


class SyncedPlay(BaseModel):
    play_key: Optional[str] = ""
    track_id: Optional[str] = ""
    track_name: str
    artist_name: str
    album_name: Optional[str] = ""
    played_at: str
    duration_ms: Optional[int] = 0
    spotify_url: Optional[str] = ""
    uri: Optional[str] = ""
    source: Optional[str] = "spotify_recently_played"


class ListeningSyncPayload(BaseModel):
    plays: list[SyncedPlay]


def model_to_dict(model):
    if hasattr(model, "model_dump"):
        return model.model_dump()

    return model.dict()

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


@app.post("/listening/recently-played")
def sync_recently_played(payload: ListeningSyncPayload):
    plays = [model_to_dict(play) for play in payload.plays]

    return {
        "sync": upsert_recent_plays(plays)
    }


@app.get("/listening/status")
def listening_status():
    return {
        "sync": get_sync_status()
    }


@app.get("/listening/recently-played")
def recently_synced_plays(limit: int = 50):
    return {
        "plays": get_recent_synced_plays(limit=limit)
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
        "top_tracks": get_top_tracks(DATA_FILE, limit=100, sort_by=sort_by, time_range=time_range, year=year),
        "top_artists": get_top_artists(DATA_FILE, limit=20, sort_by=sort_by, time_range=time_range, year=year),
        "top_albums": get_top_albums(DATA_FILE, limit=20, sort_by=sort_by, time_range=time_range, year=year),
    }

@app.get("/recommendations/artists")
def artist_recommendations(
    top_n: int = 20,
    liked_artists: list[str] = Query(default=[]),
    ignored_artists: list[str] = Query(default=[]),
):
    df = load_combined_spotify_history(DATA_FILE)

    return {
        "recommendations": get_artist_recommendations(
            df,
            top_n=top_n,
            liked_artists=liked_artists,
            ignored_artists=ignored_artists,
        )
    }

@app.get("/recommendations/tracks")
def track_recommendations(
    top_n: int = 20,
    max_play_count: int = 10,
    liked_tracks: list[str] = Query(default=[]),
    ignored_tracks: list[str] = Query(default=[]),
):
    df = load_combined_spotify_history(DATA_FILE)

    return {
        "recommendations": get_track_recommendations(
            df,
            top_n=top_n,
            max_play_count=max_play_count,
            liked_tracks=liked_tracks,
            ignored_tracks=ignored_tracks,
        )
    }

@app.get("/recommendations/trip-playlists")
def trip_playlists(
    limit: int = 25,
    new_song_max_plays: int = 5,
    hangout_type: str = "",
    moods: list[str] = Query(default=[]),
    languages: list[str] = Query(default=[]),
    context_artists: list[str] = Query(default=[]),
    survey_liked_artists: list[str] = Query(default=[]),
    survey_ignored_artists: list[str] = Query(default=[]),
):
    _ = (hangout_type, moods, languages)
    df = load_combined_spotify_history(DATA_FILE)

    return {
        "playlists": get_trip_playlists(
            df,
            limit=limit,
            new_song_max_plays=new_song_max_plays,
            survey_liked_artists=survey_liked_artists,
            survey_ignored_artists=survey_ignored_artists,
            context_artists=context_artists,
        )
    }

@app.get("/recommendations/artist-features")
def artist_features():
    df = load_combined_spotify_history(DATA_FILE)
    features = build_artist_features(df)

    features = features.sort_values(
        "listen_strength",
        ascending=False,
    ).head(20)

    return {
        "features": features.to_dict(orient="records")
    }

@app.get("/recommendations/user-vector-artists")
def user_vector_artists():
    df = load_combined_spotify_history(DATA_FILE)

    return {
        "artists": get_top_user_artists(df, limit=10)
    }
