// src/pages/Model.jsx
import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";

function ModelCard({ title, children }) {
  return (
    <div className="bg-[#181818] rounded-lg p-6">
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <div className="text-sm text-gray-300 leading-relaxed">{children}</div>
    </div>
  );
}

function Model() {
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
                The next ML step is storing structured feedback events so a
                logistic-regression baseline can learn the probability of a user
                liking a future recommendation.
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
