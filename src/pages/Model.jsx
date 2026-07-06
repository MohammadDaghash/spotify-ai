// src/pages/Model.jsx
import { useEffect, useMemo, useState } from "react";

import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import StatCard from "../components/common/StatCard.jsx";
import { fetchServerFeedbackEvents } from "../services/feedbackApi.js";
import { trainFeedbackLogisticBaseline } from "../utils/feedbackLearningModel.js";
import { buildModelFeedbackSummary } from "../utils/modelFeedbackSummary.js";

function ModelCard({ title, children }) {
  return (
    <div className="bg-[#181818] rounded-lg p-6">
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <div className="text-sm text-gray-300 leading-relaxed">{children}</div>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return "No events yet";

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function Model() {
  const [feedbackDataset, setFeedbackDataset] = useState({
    events: [],
    status: {},
    storageMode: "unknown",
  });
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackError, setFeedbackError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadFeedbackDataset() {
      try {
        setFeedbackLoading(true);
        setFeedbackError("");

        const data = await fetchServerFeedbackEvents(100);

        if (!isMounted) return;

        setFeedbackDataset({
          events: data.events || [],
          status: data.status || {},
          storageMode: data.storage_mode || "unknown",
        });
      } catch (error) {
        if (!isMounted) return;

        setFeedbackError(
          error instanceof Error
            ? error.message
            : "Could not load server feedback.",
        );
      } finally {
        if (isMounted) {
          setFeedbackLoading(false);
        }
      }
    }

    loadFeedbackDataset();

    return () => {
      isMounted = false;
    };
  }, []);

  const feedbackSummary = useMemo(
    () =>
      buildModelFeedbackSummary({
        events: feedbackDataset.events,
        status: feedbackDataset.status,
      }),
    [feedbackDataset],
  );
  const feedbackBaseline = useMemo(
    () => trainFeedbackLogisticBaseline(feedbackDataset.events),
    [feedbackDataset.events],
  );
  const baselineStatusLabel =
    feedbackBaseline.status === "trained" ? "Trained" : "Needs more labels";

  return (
    <div className="app-shell h-screen bg-black flex flex-col">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 bg-[#121212] rounded-lg m-2 overflow-hidden">
          <div className="fade-in p-6 text-white overflow-y-auto h-full">
            <div className="premium-hero mb-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-[#1db954]">
                Model lab
              </p>
              <h1 className="page-title text-4xl font-bold md:text-5xl">
                Model & Evaluation
              </h1>

              <p className="page-subtitle mt-3 max-w-4xl text-sm leading-relaxed md:text-base">
                Current model notes for the recommender: data sources, feature
                engineering, feedback learning, group scoring, and evaluation
                metrics.
              </p>
            </div>

            <section className="bg-[#181818] rounded-lg p-6 mb-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#1db954]">
                    Server feedback
                  </p>
                  <h2 className="text-2xl font-bold">
                    Feedback training dataset
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-300">
                    This is the durable event stream from Like, Ignore, Save,
                    Open Spotify, and playlist creation actions. It is the
                    dataset we will later use for logistic regression and
                    evaluation.
                  </p>
                </div>

                <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-300">
                  storage mode: {feedbackDataset.storageMode}
                </div>
              </div>

              {feedbackError ? (
                <div className="mt-5 rounded-lg border border-red-400/30 bg-red-950/30 p-4 text-sm text-red-200">
                  {feedbackError}
                </div>
              ) : null}

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
                <StatCard
                  title="Events"
                  value={feedbackLoading ? "..." : feedbackSummary.totalEvents}
                  subtitle="Stored training rows"
                />
                <StatCard
                  title="Positive"
                  value={feedbackLoading ? "..." : feedbackSummary.positiveLabels}
                  subtitle="Like, save, playlist"
                />
                <StatCard
                  title="Negative"
                  value={feedbackLoading ? "..." : feedbackSummary.negativeLabels}
                  subtitle="Ignored suggestions"
                />
                <StatCard
                  title="Neutral"
                  value={feedbackLoading ? "..." : feedbackSummary.neutralSignals}
                  subtitle="Open Spotify signals"
                />
                <StatCard
                  title="Accept rate"
                  value={feedbackLoading ? "..." : feedbackSummary.acceptanceRate}
                  subtitle="Positive / labelable"
                />
                <StatCard
                  title="Ignore rate"
                  value={feedbackLoading ? "..." : feedbackSummary.ignoreRate}
                  subtitle="Negative / labelable"
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
                <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                  <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-gray-300">
                    Dataset shape
                  </h3>
                  <div className="mt-4 space-y-3 text-sm text-gray-300">
                    <p>Songs: {feedbackSummary.songEvents}</p>
                    <p>Artists: {feedbackSummary.artistEvents}</p>
                    <p>Group playlists: {feedbackSummary.groupPlaylistEvents}</p>
                    <p>Latest event: {formatDateTime(feedbackSummary.latestEventAt)}</p>
                    <p>Updated: {formatDateTime(feedbackSummary.updatedAt)}</p>
                  </div>

                  <div className="mt-5 space-y-2">
                    {feedbackSummary.actionRows.length > 0 ? (
                      feedbackSummary.actionRows.map((row) => (
                        <div
                          className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-sm"
                          key={row.label}
                        >
                          <span className="text-gray-300">{row.label}</span>
                          <span className="font-bold">{row.count}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">
                        No server feedback events recorded yet.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                  <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-gray-300">
                    Recent training signals
                  </h3>

                  <div className="mt-4 space-y-3">
                    {feedbackSummary.recentEvents.length > 0 ? (
                      feedbackSummary.recentEvents.map((event) => (
                        <div
                          className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                          key={event.id}
                        >
                          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                            <p className="font-semibold">{event.description}</p>
                            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#1db954]">
                              {event.actionLabel}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            {event.itemType} | {event.source || "unknown source"} |{" "}
                            {event.mode || "unknown mode"} |{" "}
                            {formatDateTime(event.timestamp)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">
                        New recommendation actions will appear here after they
                        sync to the server.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-white/10 bg-black/30 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-gray-300">
                      Logistic regression baseline
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-400">
                      This uses feature scaling, the sigmoid probability
                      function, log-loss, and gradient descent. It is a learning
                      baseline only; recommendation ranking is unchanged until
                      we collect enough feedback to validate it.
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] ${
                      feedbackBaseline.status === "trained"
                        ? "border-[#1db954]/40 bg-[#1db954]/10 text-[#1db954]"
                        : "border-yellow-300/30 bg-yellow-950/30 text-yellow-200"
                    }`}
                  >
                    {baselineStatusLabel}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-5">
                  <StatCard
                    title="Training rows"
                    value={feedbackLoading ? "..." : feedbackBaseline.trainingRows}
                    subtitle="Positive + negative labels"
                  />
                  <StatCard
                    title="Features"
                    value={feedbackLoading ? "..." : feedbackBaseline.featureCount}
                    subtitle="Scaled input columns"
                  />
                  <StatCard
                    title="Accuracy"
                    value={
                      feedbackLoading || feedbackBaseline.accuracy === null
                        ? "-"
                        : `${Math.round(feedbackBaseline.accuracy * 100)}%`
                    }
                    subtitle="Training-set check"
                  />
                  <StatCard
                    title="Log loss"
                    value={
                      feedbackLoading || feedbackBaseline.logLoss === null
                        ? "-"
                        : feedbackBaseline.logLoss
                    }
                    subtitle="Lower is better"
                  />
                  <StatCard
                    title="Avg p(like)"
                    value={
                      feedbackLoading ||
                      feedbackBaseline.averagePredictedLikeProbability === null
                        ? "-"
                        : `${Math.round(
                            feedbackBaseline.averagePredictedLikeProbability * 100,
                          )}%`
                    }
                    subtitle="Mean predicted probability"
                  />
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <p className="font-mono text-xs text-gray-300">
                      {feedbackBaseline.formula}
                    </p>
                    <p className="mt-3 text-sm text-gray-400">
                      {feedbackBaseline.status === "trained"
                        ? "The coefficients below show which current feedback features push the model toward a higher or lower like probability."
                        : feedbackBaseline.reason}
                    </p>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
                      Top coefficients
                    </h4>
                    <div className="mt-3 space-y-2">
                      {feedbackBaseline.coefficients.length > 0 ? (
                        feedbackBaseline.coefficients.slice(0, 5).map((row) => (
                          <div
                            className="flex items-center justify-between rounded-md bg-black/30 px-3 py-2 text-sm"
                            key={row.feature}
                          >
                            <span className="text-gray-300">{row.feature}</span>
                            <span
                              className={
                                row.direction === "positive"
                                  ? "font-bold text-[#1db954]"
                                  : "font-bold text-red-300"
                              }
                            >
                              {row.weight}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">
                          Coefficients will appear after the baseline has both
                          positive and negative labels.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <ModelCard title="1. Data Modes">
                The public demo uses the owner listening history plus safe
                server-side synced plays. A visitor can switch to private mode
                with Spotify login or JSON import, and those private entries
                stay in that browser session instead of overwriting public demo
                data.
              </ModelCard>

              <ModelCard title="2. Feature Tables">
                The Python backend uses Pandas groupby features for artists and
                tracks: streams, minutes, active days, skip rate, completion,
                recent streams, recent minutes, listen strength, and last played
                time.
              </ModelCard>

              <ModelCard title="3. Scaling & Similarity">
                Numeric features are log-transformed where useful, scaled with
                scikit-learn `StandardScaler`, and compared with cosine
                similarity. This makes large stream counts useful without
                letting them dominate every score.
                <div className="mt-3 bg-black rounded p-3 font-mono text-xs">
                  similarity = dot(userVector, songVector) / (||userVector|| ×
                  ||songVector||)
                </div>
              </ModelCard>

              <ModelCard title="4. Hybrid Ranking Score">
                The final recommendation score combines similarity with quality
                signals:
                <ul className="list-disc list-inside mt-3 space-y-1">
                  <li>recent listen strength</li>
                  <li>completion and skip-rate quality</li>
                  <li>underplayed-song filtering</li>
                  <li>known-track or known-artist penalty</li>
                  <li>diversity reranking</li>
                </ul>
              </ModelCard>

              <ModelCard title="5. Feedback Learning">
                Like, ignore, save, and playlist actions are treated as training
                signals. Today they adjust filtering and weighting immediately.
                Structured events are now stored server-side so a
                logistic-regression baseline can later learn the probability of
                a user liking a future recommendation.
              </ModelCard>

              <ModelCard title="6. Group Mix Scoring">
                Group Mix creates three playlist strategies from listening
                history, survey likes/ignores, and hangout context:
                shared favorites, bridge picks, and new discoveries. Survey
                liked artists and context artists boost relevant tracks;
                ignored artists are excluded.
              </ModelCard>

              <ModelCard title="7. Recency Weighting">
                Recent behavior matters more than old behavior. The current
                model gives extra weight to recent 7-day and 30-day streams, so
                a song played heavily this week can outrank an older lifetime
                favorite when the current context supports it.
              </ModelCard>

              <ModelCard title="8. Precision@K">
                Measures how many of the top K recommendations were relevant.
                <div className="mt-3 bg-black rounded p-3 font-mono text-xs">
                  Precision@K = relevant recommendations / K
                </div>
              </ModelCard>

              <ModelCard title="9. Hit@K">
                Measures whether at least one relevant recommendation appeared
                in the top K results. This is useful when one strong
                recommendation is enough to count as success.
              </ModelCard>

              <ModelCard title="10. Catalog Coverage">
                Measures how much of the available candidate catalog the system
                is able to recommend. Higher coverage means the model is less
                repetitive.
              </ModelCard>

              <ModelCard title="11. Artist Diversity">
                Measures whether recommendations come from different artists
                instead of repeating the same artist again and again.
              </ModelCard>

              <ModelCard title="12. Recall & NDCG">
                Recall@K checks how many relevant songs were recovered. NDCG
                rewards the model for ranking relevant songs near the top,
                making it better suited for recommendation quality than accuracy
                alone.
              </ModelCard>

              <ModelCard title="13. Statistical Next Step">
                The next rigorous step is measuring uncertainty: acceptance
                rate, ignore rate, confidence intervals, and A/B comparisons
                between scoring versions. That connects directly to probability
                and statistics coursework.
              </ModelCard>

              <ModelCard title="14. ML Next Step">
                The first supervised model should be simple and interpretable:
                logistic regression on feedback labels. Positive labels come
                from liked, saved, and playlist-created recommendations;
                negative labels come from ignored recommendations. Spotify-open
                clicks are stored as neutral interest signals.
              </ModelCard>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Model;
