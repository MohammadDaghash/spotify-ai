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
                Mathematical explanation of the recommendation engine: feature
                vectors, cosine similarity, hybrid scoring, and evaluation
                metrics.
              </p>
            </div>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <ModelCard title="1. Feature Vector">
                Each song is represented as a dynamic normalized vector:
                weighted genres, weighted moods, popularity, and recency. The
                vector dimensions are built from the available catalog instead
                of being hard-coded.
              </ModelCard>

              <ModelCard title="2. Cosine Similarity">
                The engine compares the user taste vector with each song vector
                using cosine similarity. A score closer to 1 means the song is
                more similar to the user’s listening profile.
                <div className="mt-3 bg-black rounded p-3 font-mono text-xs">
                  similarity = dot(userVector, songVector) / (||userVector|| ×
                  ||songVector||)
                </div>
              </ModelCard>

              <ModelCard title="3. Hybrid Recommendation Score">
                Final ranking combines multiple signals:
                <ul className="list-disc list-inside mt-3 space-y-1">
                  <li>Vector similarity</li>
                  <li>Artist affinity</li>
                  <li>Genre and mood affinity</li>
                  <li>Novelty and recency</li>
                  <li>Popularity debiasing</li>
                </ul>
              </ModelCard>

              <ModelCard title="4. Feedback Learning">
                When the user clicks “Add to Library”, the system updates the
                taste profile by increasing artist, genre, and mood weights.
                Recent and stronger interactions carry more weight than weak or
                stale interactions.
              </ModelCard>

              <ModelCard title="5. Precision@K">
                Measures how many of the top K recommendations were relevant.
                <div className="mt-3 bg-black rounded p-3 font-mono text-xs">
                  Precision@K = relevant recommendations / K
                </div>
              </ModelCard>

              <ModelCard title="6. Hit@K">
                Measures whether at least one relevant recommendation appeared
                in the top K results. This is useful when one strong
                recommendation is enough to count as success.
              </ModelCard>

              <ModelCard title="7. Catalog Coverage">
                Measures how much of the available candidate catalog the system
                is able to recommend. Higher coverage means the model is less
                repetitive.
              </ModelCard>

              <ModelCard title="8. Artist Diversity">
                Measures whether recommendations come from different artists
                instead of repeating the same artist again and again.
              </ModelCard>

              <ModelCard title="9. Recall & NDCG">
                Recall@K checks how many relevant songs were recovered. NDCG
                rewards the model for ranking relevant songs near the top,
                making it better suited for recommendation quality than accuracy
                alone.
              </ModelCard>

              <ModelCard title="10. Reranking">
                After scoring, the engine reranks results with diversity and
                novelty constraints so the list does not over-repeat one artist
                or only recommend globally popular songs.
              </ModelCard>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Model;
