import json
from pathlib import Path

import pandas as pd


DEFAULT_LIVE_HISTORY_FILE = Path("data/live/recent_plays.json")

LIVE_HISTORY_COLUMNS = [
    "ts",
    "ms_played",
    "track_name",
    "artist_name",
    "album_name",
    "minutes_played",
    "played_at",
    "track_id",
    "spotify_url",
    "uri",
    "source",
]


def _safe_string(value):
    return str(value or "").strip()


def _safe_int(value, default=0):
    try:
        return int(value or default)
    except (TypeError, ValueError):
        return default


def _play_key(play):
    track_identity = play.get("track_id") or "|".join(
        [
            _safe_string(play.get("track_name")).lower(),
            _safe_string(play.get("artist_name")).lower(),
            _safe_string(play.get("album_name")).lower(),
        ]
    )

    return f"{play.get('played_at')}|{track_identity}"


def normalize_play(play):
    track_name = _safe_string(play.get("track_name"))
    artist_name = _safe_string(play.get("artist_name"))
    played_at = _safe_string(play.get("played_at"))

    if not track_name or not artist_name or not played_at:
        return None

    duration_ms = _safe_int(play.get("duration_ms") or play.get("ms_played"))

    return {
        "track_id": _safe_string(play.get("track_id")),
        "track_name": track_name,
        "artist_name": artist_name,
        "album_name": _safe_string(play.get("album_name")),
        "played_at": played_at,
        "duration_ms": duration_ms,
        "spotify_url": _safe_string(play.get("spotify_url")),
        "uri": _safe_string(play.get("uri")),
        "source": _safe_string(play.get("source")) or "spotify_recently_played",
    }


def read_synced_plays(storage_path=DEFAULT_LIVE_HISTORY_FILE):
    path = Path(storage_path)

    if not path.exists():
        return []

    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, list):
        return []

    return [play for play in data if isinstance(play, dict)]


def write_synced_plays(plays, storage_path=DEFAULT_LIVE_HISTORY_FILE):
    path = Path(storage_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    temp_path = path.with_suffix(".tmp")
    with temp_path.open("w", encoding="utf-8") as file:
        json.dump(plays, file, ensure_ascii=False, indent=2)

    temp_path.replace(path)


def upsert_recent_plays(plays, storage_path=DEFAULT_LIVE_HISTORY_FILE):
    existing_plays = read_synced_plays(storage_path)
    merged = {}

    for play in existing_plays:
        normalized = normalize_play(play)
        if normalized:
            merged[_play_key(normalized)] = normalized

    inserted = 0
    normalized_received = []

    for play in plays:
        normalized = normalize_play(play)
        if not normalized:
            continue

        normalized_received.append(normalized)
        key = _play_key(normalized)

        if key not in merged:
            inserted += 1

        merged[key] = normalized

    sorted_plays = sorted(
        merged.values(),
        key=lambda item: item.get("played_at") or "",
        reverse=True,
    )

    write_synced_plays(sorted_plays, storage_path)

    return {
        "received": len(plays),
        "valid": len(normalized_received),
        "inserted": inserted,
        "total_plays": len(sorted_plays),
        "latest_played_at": sorted_plays[0]["played_at"] if sorted_plays else None,
    }


def get_sync_status(storage_path=DEFAULT_LIVE_HISTORY_FILE):
    plays = read_synced_plays(storage_path)
    latest_played_at = plays[0].get("played_at") if plays else None

    return {
        "total_plays": len(plays),
        "latest_played_at": latest_played_at,
        "storage_path": str(Path(storage_path)),
    }


def get_recent_synced_plays(limit=50, storage_path=DEFAULT_LIVE_HISTORY_FILE):
    plays = read_synced_plays(storage_path)
    return plays[:limit]


def load_synced_history(storage_path=DEFAULT_LIVE_HISTORY_FILE):
    plays = read_synced_plays(storage_path)

    if not plays:
        return pd.DataFrame(columns=LIVE_HISTORY_COLUMNS)

    df = pd.DataFrame(plays)

    df["ts"] = df["played_at"]
    df["ms_played"] = df["duration_ms"].fillna(0).astype(int)
    df["minutes_played"] = df["ms_played"] / 60000
    df["played_at"] = pd.to_datetime(df["played_at"], utc=True, errors="coerce")

    df = df.dropna(subset=["played_at", "track_name", "artist_name"])

    for column in LIVE_HISTORY_COLUMNS:
        if column not in df.columns:
            df[column] = ""

    return df[LIVE_HISTORY_COLUMNS].copy()
