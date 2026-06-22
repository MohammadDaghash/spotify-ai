from pathlib import Path
from functools import lru_cache
import re
import unicodedata
import pandas as pd

from services.listening_sync import DEFAULT_LIVE_HISTORY_FILE, load_synced_history


ALBUM_EDITION_PATTERN = re.compile(
    r"""
    \s*
    (?:
        [\(\[\{]\s*
        (?:
            .*?\bdeluxe\b.*?
            |.*?\bexpanded\b.*?
            |.*?\bbonus\b.*?
            |.*?\banniversary\b.*?
            |.*?\bremaster(?:ed)?\b.*?
            |.*?\bspecial\b.*?\bedition\b.*?
            |.*?\bcomplete\b.*?
        )
        \s*[\)\]\}]
        |
        (?:-|–|—|:)\s*
        (?:
            .*?\bdeluxe\b.*?
            |.*?\bexpanded\b.*?
            |.*?\bbonus\b.*?
            |.*?\banniversary\b.*?
            |.*?\bremaster(?:ed)?\b.*?
            |.*?\bspecial\b.*?\bedition\b.*?
            |.*?\bcomplete\b.*?
        )
        |
        \s+
        (?:
            \bdeluxe\b.*?
            |\bexpanded\b.*?
            |\bbonus\b.*?
            |\banniversary\b.*?
            |\bremaster(?:ed)?\b.*?
            |\bspecial\b.*?\bedition\b.*?
            |\bcomplete\b.*?
        )
    )
    \s*$
    """,
    re.IGNORECASE | re.VERBOSE,
)

ARTIST_CREDIT_SPLIT_PATTERN = re.compile(
    r"\s*(?:,|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bwith\b)\s*",
    re.IGNORECASE,
)
PROTECTED_COMMA_ARTIST_NAMES = {
    "tyler, the creator",
}
PROTECTED_COMMA_ARTIST_PATTERNS = [
    re.compile(r"tyler,\s*the creator", re.IGNORECASE),
]


def get_canonical_album_name(album_name: str) -> str:
    clean_name = str(album_name or "").strip()

    if not clean_name:
        return clean_name

    previous_name = None

    while previous_name != clean_name:
        previous_name = clean_name
        clean_name = ALBUM_EDITION_PATTERN.sub("", clean_name).strip()

    return re.sub(r"\s+", " ", clean_name).strip()


def normalize_artist_name_key(artist_name: str) -> str:
    return re.sub(r"\s+", " ", str(artist_name or "").strip().lower())


def normalize_rank_key_part(value, column_name: str) -> str:
    if pd.isna(value):
        value = ""

    clean_value = str(value or "").strip().lower()

    if "album" in column_name:
        clean_value = get_canonical_album_name(clean_value)

    clean_value = unicodedata.normalize("NFD", clean_value)
    clean_value = "".join(
        char for char in clean_value if unicodedata.category(char) != "Mn"
    )
    clean_value = clean_value.replace("&", " and ").replace("'", "").replace("’", "")
    clean_value = re.sub(r"[^\w]+", " ", clean_value, flags=re.UNICODE)

    return re.sub(r"\s+", " ", clean_value).strip()


def build_rank_match_key(row, columns: list[str]) -> str:
    return "::".join(
        normalize_rank_key_part(row[column], column)
        for column in columns
    )


def split_artist_names(artist_name: str) -> list[str]:
    clean_name = re.sub(r"\s+", " ", str(artist_name or "").strip())

    if not clean_name:
        return []

    if normalize_artist_name_key(clean_name) in PROTECTED_COMMA_ARTIST_NAMES:
        return [clean_name]

    protected_artists = {}
    protected_name = clean_name

    for index, pattern in enumerate(PROTECTED_COMMA_ARTIST_PATTERNS):
        placeholder = f"__protected_artist_{index}__"

        def replace_match(match):
            protected_artists[placeholder] = match.group(0)
            return placeholder

        protected_name = pattern.sub(replace_match, protected_name)

    parts = [
        protected_artists.get(part.strip(), part.strip())
        for part in ARTIST_CREDIT_SPLIT_PATTERN.split(protected_name)
        if part.strip()
    ]

    if not parts:
        return [clean_name]

    # Protect common artist names that contain commas from being split as a collab.
    if len(parts) == 2 and normalize_artist_name_key(clean_name) in PROTECTED_COMMA_ARTIST_NAMES:
        return [clean_name]

    return list(dict.fromkeys(parts))


def explode_artist_credits(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty or "artist_name" not in df.columns:
        return df.copy()

    artist_df = df.copy()
    artist_df["artist_name"] = artist_df["artist_name"].apply(split_artist_names)
    artist_df = artist_df.explode("artist_name")
    artist_df["artist_name"] = artist_df["artist_name"].astype(str).str.strip()
    artist_df = artist_df[artist_df["artist_name"] != ""]

    return artist_df.reset_index(drop=True)


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
    filtered_df["played_at"] = pd.to_datetime(
        filtered_df["played_at"],
        utc=True,
        errors="coerce",
    )
    filtered_df = filtered_df.dropna(subset=["played_at"])

    if year != "all":
        try:
            selected_year = int(year)
            filtered_df = filtered_df[
                filtered_df["played_at"].dt.year == selected_year
            ]
        except ValueError:
            pass

    if time_range == "30d":
        max_date = pd.Timestamp.now(tz="UTC")
        filtered_df = filtered_df[
            filtered_df["played_at"] >= max_date - pd.Timedelta(days=30)
        ]

    elif time_range == "6m":
        max_date = pd.Timestamp.now(tz="UTC")
        filtered_df = filtered_df[
            filtered_df["played_at"] >= max_date - pd.DateOffset(months=6)
        ]

    return filtered_df


def get_previous_history(
    df: pd.DataFrame,
    time_range: str = "all",
    year: str = "all",
) -> pd.DataFrame:
    dated_df = df.copy()
    dated_df["played_at"] = pd.to_datetime(
        dated_df["played_at"],
        utc=True,
        errors="coerce",
    )
    dated_df = dated_df.dropna(subset=["played_at"])

    if year != "all":
        try:
            selected_year = int(year)
            return dated_df[dated_df["played_at"].dt.year == selected_year - 1]
        except ValueError:
            pass

    now = pd.Timestamp.now(tz="UTC")

    if time_range == "30d":
        current_start = now - pd.Timedelta(days=30)
        previous_start = current_start - pd.Timedelta(days=30)

        return dated_df[
            (dated_df["played_at"] >= previous_start)
            & (dated_df["played_at"] < current_start)
        ]

    if time_range == "6m":
        current_start = now - pd.DateOffset(months=6)
        previous_start = current_start - pd.DateOffset(months=6)

        return dated_df[
            (dated_df["played_at"] >= previous_start)
            & (dated_df["played_at"] < current_start)
        ]

    current_start = now - pd.Timedelta(days=30)
    return dated_df[dated_df["played_at"] < current_start]


def add_rank_movement(
    current_rankings: pd.DataFrame,
    previous_rankings: pd.DataFrame,
    group_columns: list[str],
) -> pd.DataFrame:
    if current_rankings.empty:
        return current_rankings

    current_rankings = current_rankings.copy().reset_index(drop=True)
    current_rankings["rank"] = current_rankings.index + 1

    if previous_rankings.empty:
        current_rankings["previous_rank"] = None
        current_rankings["rank_change"] = None
        current_rankings["rank_direction"] = "new"
        return current_rankings

    previous_rankings = previous_rankings.copy().reset_index(drop=True)
    previous_rankings["previous_rank"] = previous_rankings.index + 1
    current_rankings["_rank_match_key"] = current_rankings.apply(
        lambda row: build_rank_match_key(row, group_columns),
        axis=1,
    )
    previous_rankings["_rank_match_key"] = previous_rankings.apply(
        lambda row: build_rank_match_key(row, group_columns),
        axis=1,
    )

    current_rankings = current_rankings.merge(
        previous_rankings[["_rank_match_key", "previous_rank"]],
        on="_rank_match_key",
        how="left",
    )

    previous_ranks = []
    rank_changes = []
    rank_directions = []

    for _, row in current_rankings.iterrows():
        if pd.isna(row["previous_rank"]):
            previous_ranks.append(None)
            rank_changes.append(None)
            rank_directions.append("new")
            continue

        previous_rank = int(row["previous_rank"])
        rank_change = previous_rank - int(row["rank"])

        previous_ranks.append(previous_rank)
        rank_changes.append(rank_change)

        if rank_change > 0:
            rank_directions.append("up")
        elif rank_change < 0:
            rank_directions.append("down")
        else:
            rank_directions.append("same")

    current_rankings["previous_rank"] = pd.Series(previous_ranks, dtype=object)
    current_rankings["rank_change"] = pd.Series(rank_changes, dtype=object)
    current_rankings["rank_direction"] = rank_directions
    current_rankings = current_rankings.drop(columns=["_rank_match_key"])

    return current_rankings


def build_ranked_group(
    df: pd.DataFrame,
    group_columns: list[str],
    sort_by: str,
) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(
            columns=group_columns + ["streams", "minutes"],
        )

    rankings = (
        df.groupby(group_columns)
        .agg(
            streams=(group_columns[0], "count"),
            minutes=("minutes_played", "sum"),
        )
        .reset_index()
    )

    rankings["minutes"] = rankings["minutes"].round(2)

    secondary_sort = "streams" if sort_by == "minutes" else "minutes"
    return rankings.sort_values(
        [sort_by, secondary_sort],
        ascending=[False, False],
    ).reset_index(drop=True)


def load_combined_spotify_history(
    data_path: str,
    live_history_path=DEFAULT_LIVE_HISTORY_FILE,
) -> pd.DataFrame:
    exported_df = load_spotify_history(data_path).copy()
    live_df = load_synced_history(live_history_path)

    if live_df.empty:
        return exported_df

    combined_df = pd.concat([exported_df, live_df], ignore_index=True, sort=False)

    combined_df["played_at"] = pd.to_datetime(
        combined_df["played_at"],
        utc=True,
        errors="coerce",
    )
    combined_df = combined_df.dropna(
        subset=["played_at", "track_name", "artist_name"]
    )

    combined_df["_dedupe_key"] = (
        combined_df["played_at"].astype(str)
        + "|"
        + combined_df["track_name"].astype(str).str.lower()
        + "|"
        + combined_df["artist_name"].astype(str).str.lower()
    )

    combined_df = combined_df.drop_duplicates("_dedupe_key", keep="last")
    combined_df = combined_df.drop(columns=["_dedupe_key"])

    return combined_df


def get_summary(file_path: str, time_range: str = "all", year: str = "all"):
    full_df = load_combined_spotify_history(file_path)
    df = filter_history(full_df, time_range=time_range, year=year)
    last_played_at = full_df["played_at"].max()
    artist_credit_df = explode_artist_credits(df)

    return {
        "total_streams": int(len(df)),
        "total_minutes": round(float(df["minutes_played"].sum()), 2),
        "unique_tracks": int(df["track_name"].nunique()),
        "unique_artists": int(artist_credit_df["artist_name"].nunique()),
        "unique_albums": int(df["album_name"].nunique()),
        "last_played_at": last_played_at.isoformat() if pd.notna(last_played_at) else None,
        "generated_at": pd.Timestamp.now(tz="UTC").isoformat(),
    }


def get_top_tracks(
    file_path: str,
    limit: int = 10,
    sort_by: str = "minutes",
    time_range: str = "all",
    year: str = "all",
):
    if sort_by not in ["minutes", "streams"]:
        sort_by = "minutes"

    full_df = load_combined_spotify_history(file_path)
    current_df = filter_history(full_df, time_range=time_range, year=year)
    previous_df = get_previous_history(full_df, time_range=time_range, year=year)
    group_columns = ["track_name", "artist_name", "album_name"]

    current_rankings = build_ranked_group(current_df, group_columns, sort_by)
    previous_rankings = build_ranked_group(
        previous_df,
        group_columns,
        sort_by,
    ).head(limit)
    top_tracks = add_rank_movement(
        current_rankings,
        previous_rankings,
        group_columns,
    ).head(limit)

    return top_tracks.to_dict(orient="records")


def get_top_artists(
    file_path: str,
    limit: int = 10,
    sort_by: str = "minutes",
    time_range: str = "all",
    year: str = "all",
):
    if sort_by not in ["minutes", "streams"]:
        sort_by = "minutes"

    full_df = load_combined_spotify_history(file_path)
    current_df = filter_history(full_df, time_range=time_range, year=year)
    previous_df = get_previous_history(full_df, time_range=time_range, year=year)
    group_columns = ["artist_name"]
    current_artist_df = explode_artist_credits(current_df)
    previous_artist_df = explode_artist_credits(previous_df)

    current_rankings = build_ranked_group(current_artist_df, group_columns, sort_by)
    previous_rankings = build_ranked_group(
        previous_artist_df,
        group_columns,
        sort_by,
    ).head(limit)
    top_artists = add_rank_movement(
        current_rankings,
        previous_rankings,
        group_columns,
    ).head(limit)

    return top_artists.to_dict(orient="records")


def get_top_albums(
    file_path: str,
    limit: int = 10,
    sort_by: str = "minutes",
    time_range: str = "all",
    year: str = "all",
):
    if sort_by not in ["minutes", "streams"]:
        sort_by = "minutes"

    full_df = load_combined_spotify_history(file_path)
    current_df = filter_history(full_df, time_range=time_range, year=year)
    previous_df = get_previous_history(full_df, time_range=time_range, year=year)
    current_df = current_df.copy()
    previous_df = previous_df.copy()
    current_df["album_name"] = current_df["album_name"].apply(
        get_canonical_album_name,
    )
    previous_df["album_name"] = previous_df["album_name"].apply(
        get_canonical_album_name,
    )
    group_columns = ["album_name", "artist_name"]

    current_rankings = build_ranked_group(current_df, group_columns, sort_by)
    previous_rankings = build_ranked_group(
        previous_df,
        group_columns,
        sort_by,
    ).head(limit)
    top_albums = add_rank_movement(
        current_rankings,
        previous_rankings,
        group_columns,
    ).head(limit)

    return top_albums.to_dict(orient="records")
