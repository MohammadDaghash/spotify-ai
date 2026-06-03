from pathlib import Path
from functools import lru_cache
import pandas as pd


@lru_cache(maxsize=4)
def load_spotify_history(data_path: str) -> pd.DataFrame:
    path = Path(data_path)

    if path.is_dir():
        json_files = list(path.glob("*.json"))

        if not json_files:
            raise ValueError(f"No JSON files found in directory: {data_path}")

        frames = [pd.read_json(file) for file in json_files]
        df = pd.concat(frames, ignore_index=True)
    else:
        df = pd.read_json(path)

    required_columns = [
        "ts",
        "ms_played",
        "master_metadata_track_name",
        "master_metadata_album_artist_name",
        "master_metadata_album_album_name",
    ]

    missing_columns = [col for col in required_columns if col not in df.columns]

    if missing_columns:
        raise ValueError(f"Missing columns: {missing_columns}")

    df = df[required_columns].copy()

    df = df.dropna(
        subset=[
            "ts",
            "ms_played",
            "master_metadata_track_name",
            "master_metadata_album_artist_name",
        ]
    )

    df["minutes_played"] = df["ms_played"] / 60000
    df["played_at"] = pd.to_datetime(df["ts"])

    df = df.rename(
        columns={
            "master_metadata_track_name": "track_name",
            "master_metadata_album_artist_name": "artist_name",
            "master_metadata_album_album_name": "album_name",
        }
    )

    return df


def filter_history(
    df: pd.DataFrame,
    time_range: str = "all",
    year: str = "all",
) -> pd.DataFrame:
    filtered_df = df.copy()

    if year != "all":
        try:
            selected_year = int(year)
            filtered_df = filtered_df[
                filtered_df["played_at"].dt.year == selected_year
            ]
        except ValueError:
            pass

    if time_range == "30d":
        max_date = filtered_df["played_at"].max()
        filtered_df = filtered_df[
            filtered_df["played_at"] >= max_date - pd.Timedelta(days=30)
        ]

    elif time_range == "6m":
        max_date = filtered_df["played_at"].max()
        filtered_df = filtered_df[
            filtered_df["played_at"] >= max_date - pd.DateOffset(months=6)
        ]

    return filtered_df


def get_summary(file_path: str, time_range: str = "all", year: str = "all"):
    df = load_spotify_history(file_path)
    df = filter_history(df, time_range=time_range, year=year)

    return {
        "total_streams": int(len(df)),
        "total_minutes": round(float(df["minutes_played"].sum()), 2),
        "unique_tracks": int(df["track_name"].nunique()),
        "unique_artists": int(df["artist_name"].nunique()),
        "unique_albums": int(df["album_name"].nunique()),
    }


def get_top_tracks(
    file_path: str,
    limit: int = 10,
    sort_by: str = "minutes",
    time_range: str = "all",
    year: str = "all",
):
    df = load_spotify_history(file_path)
    df = filter_history(df, time_range=time_range, year=year)

    if sort_by not in ["minutes", "streams"]:
        sort_by = "minutes"

    top_tracks = (
        df.groupby(["track_name", "artist_name", "album_name"])
        .agg(
            streams=("track_name", "count"),
            minutes=("minutes_played", "sum"),
        )
        .reset_index()
    )

    top_tracks["minutes"] = top_tracks["minutes"].round(2)

    top_tracks = top_tracks.sort_values(by=sort_by, ascending=False).head(limit)

    return top_tracks.to_dict(orient="records")


def get_top_artists(
    file_path: str,
    limit: int = 10,
    sort_by: str = "minutes",
    time_range: str = "all",
    year: str = "all",
):
    df = load_spotify_history(file_path)
    df = filter_history(df, time_range=time_range, year=year)

    if sort_by not in ["minutes", "streams"]:
        sort_by = "minutes"

    top_artists = (
        df.groupby("artist_name")
        .agg(
            streams=("artist_name", "count"),
            minutes=("minutes_played", "sum"),
        )
        .reset_index()
    )

    top_artists["minutes"] = top_artists["minutes"].round(2)

    top_artists = top_artists.sort_values(by=sort_by, ascending=False).head(limit)

    return top_artists.to_dict(orient="records")


def get_top_albums(
    file_path: str,
    limit: int = 10,
    sort_by: str = "minutes",
    time_range: str = "all",
    year: str = "all",
):
    df = load_spotify_history(file_path)
    df = filter_history(df, time_range=time_range, year=year)

    if sort_by not in ["minutes", "streams"]:
        sort_by = "minutes"

    top_albums = (
        df.groupby(["album_name", "artist_name"])
        .agg(
            streams=("album_name", "count"),
            minutes=("minutes_played", "sum"),
        )
        .reset_index()
    )

    top_albums["minutes"] = top_albums["minutes"].round(2)

    top_albums = top_albums.sort_values(by=sort_by, ascending=False).head(limit)

    return top_albums.to_dict(orient="records")