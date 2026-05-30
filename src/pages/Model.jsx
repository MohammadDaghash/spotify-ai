// src/pages/Model.jsx
import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";

function ModelCard({ title, children }) {
  return (
    <div className="bg-[#181818] rounded-lg p-5">
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <div className="text-sm text-gray-300 leading-relaxed">{children}</div>
    </div>
  );
}

function Model() {
  return (
    <div className="h-screen bg-black flex flex-col">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 bg-[#121212] rounded-lg m-2 overflow-hidden">
          <div className="p-6 text-white overflow-y-auto h-full">
            <h1 className="text-3xl font-bold mb-2">Model & Evaluation</h1>

            <p className="text-sm text-gray-400 mb-6">
              Mathematical explanation of the recommendation engine: feature
              vectors, cosine similarity, hybrid scoring, and evaluation
              metrics.
            </p>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <ModelCard title="1. Feature Vector">
                Each song is represented as a vector of numerical features:
                genre indicators, mood indicators, popularity, and recency. This
                lets the model compare songs mathematically instead of only
                using names or artists.
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
                  <li>55% vector similarity</li>
                  <li>25% artist affinity</li>
                  <li>10% popularity</li>
                  <li>10% recency</li>
                </ul>
              </ModelCard>

              <ModelCard title="4. Feedback Learning">
                When the user clicks “Add to Library”, the system updates the
                taste profile by adding the song’s artist, genres, and moods.
                This creates a simple adaptive recommendation loop.
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
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Model;
