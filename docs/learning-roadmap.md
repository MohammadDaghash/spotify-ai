# Spotify AI Learning Roadmap

This project should stay practical: use probability, statistics, and machine
learning concepts when they directly improve recommendation quality,
measurement, or data reliability.

Course PDFs and local study files should stay outside Git. The repo should keep
only implementation notes, experiments, and reusable project code.

## Main Product Goal

Build a music intelligence app that learns from:

- imported Spotify listening history
- recurring Spotify sync data
- recent listening behavior
- liked, ignored, saved, and playlist-created recommendations
- group survey preferences

The recommendation system should use those signals to suggest songs, artists,
and group playlists that are explainable and measurable.

## Phase 1: Data Foundation

Focus: make the dataset trustworthy before making the model complex.

- Keep public demo data separate from private user/session data.
- Store feedback events as structured records, not only lists.
- Deduplicate Spotify plays by stable identifiers and timestamp.
- Track when each play happened so recent behavior can receive more weight.
- Keep raw data, cleaned features, and model output conceptually separate.

Relevant coursework:

- data cleaning with Pandas
- descriptive statistics
- sampling bias and missing data
- probability of events such as like, ignore, replay, save

## Phase 2: Statistical Evaluation

Focus: answer whether recommendations are actually improving.

Useful metrics:

- Precision@K: how many top recommendations are useful
- Hit@K: whether at least one recommendation works
- acceptance rate: liked or saved divided by total feedback
- ignore rate: ignored divided by shown recommendations
- discovery rate: recommendations under a play-count threshold
- diversity: unique artists, genres, languages, and moods

Relevant coursework:

- mean, variance, and distributions
- confidence intervals for acceptance rate
- hypothesis testing for model changes
- conditional probability, for example `P(like | mood, language, artist)`
- Bayesian smoothing for low-sample artists or songs

## Phase 3: Feature Engineering

Focus: convert listening behavior into model-ready numbers.

Useful features:

- total streams
- total minutes
- recent streams in 7, 30, and 90 days
- skip rate
- save/like/ignore counts
- artist, genre, mood, and language weights
- recency-weighted play count
- discovery freshness, such as played fewer than 5 or 10 times

Relevant coursework:

- NumPy vectorization
- Pandas groupby/aggregation
- feature scaling
- polynomial or interaction features only when they explain real behavior

## Phase 4: First Supervised Model

Focus: predict whether a user will like a recommendation.

Start simple:

- label liked/saved/opened recommendations as positive
- label ignored recommendations as negative
- use logistic regression as the first interpretable baseline
- compare against current heuristic scoring
- keep train/test split by time to avoid leaking future behavior

Relevant coursework:

- logistic regression
- cost functions
- gradient descent intuition
- train/test split
- accuracy, precision, recall, and false positives

## Phase 5: Recommender System Improvements

Focus: improve candidate ranking while keeping explanations readable.

Good next methods:

- content-based similarity using artist, genre, mood, language, and audio traits
- collaborative-style signals when more users exist
- recency weighting with exponential decay
- exploration vs. exploitation so the app does not only repeat safe picks
- group recommendation scoring that balances shared taste and discovery

Relevant coursework:

- vector similarity
- normalization
- clustering for taste segments
- model evaluation and error analysis

## Phase 6: Experiments

Focus: learn from changes without guessing.

Each model experiment should record:

- model version
- feature set
- scoring formula
- evaluation metrics
- number of recommendations shown
- number of feedback events collected
- notes on what improved or got worse

Use notebooks for exploration, but move stable logic into backend services.

## Immediate Next Milestone

Build a feedback event table/file with one row per user action:

- timestamp
- user/session id
- item type: song, artist, playlist
- item id/name
- action: like, ignore, save, open, create playlist
- model version
- score shown to the user
- rank shown to the user

This is the foundation for applying statistics and ML correctly later.
