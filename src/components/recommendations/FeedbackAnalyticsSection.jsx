import StatCard from "../common/StatCard.jsx";

function WeightList({ title, items }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-2">{title}</p>
      <div className="space-y-1 text-sm text-gray-400">
        {items.map((item) => (
          <p key={item.name}>
            {item.name}: {item.weight}
          </p>
        ))}
      </div>
    </div>
  );
}

function FeedbackAnalyticsSection({
  evaluationMetrics,
  feedbackAnalytics,
  ignoredArtists,
  ignoredSongs,
  likedArtists,
  likedSongs,
}) {
  return (
    <>
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Precision@3"
          value={evaluationMetrics.precisionAtK}
          subtitle="Top 3 under 10 plays"
        />
        <StatCard
          title="Hit@3"
          value={evaluationMetrics.hitAtK}
          subtitle="At least one discovery in top 3"
        />
        <StatCard
          title="Catalog coverage"
          value={evaluationMetrics.catalogCoverage}
          subtitle="Candidate songs eligible"
        />
        <StatCard
          title="Artist diversity"
          value={evaluationMetrics.artistDiversity}
          subtitle="Unique artists in visible songs"
        />
      </section>

      <section className="bg-[#181818] rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold">Feedback analytics</h2>
          <p className="text-sm text-gray-400">
            Event acceptance: {feedbackAnalytics.eventAcceptanceRate}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-5">
          <StatCard
            title="Feedback events"
            value={feedbackAnalytics.feedbackEventStats.totalEvents}
            subtitle="Structured ML training rows"
          />
          <StatCard
            title="Liked songs"
            value={likedSongs.length}
            subtitle="Boost artist, genre, and mood"
          />
          <StatCard
            title="Ignored songs"
            value={ignoredSongs.length}
            subtitle="Penalize artist, genre, and mood"
          />
          <StatCard
            title="Liked artists"
            value={likedArtists.length}
            subtitle="Sent to Python user vector"
          />
          <StatCard
            title="Ignored artists"
            value={ignoredArtists.length}
            subtitle="Excluded from Python results"
          />
          <StatCard
            title="Live signals"
            value={feedbackAnalytics.liveSignalCount}
            subtitle="Saved, recent, and top Spotify tracks"
          />
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            title="Positive labels"
            value={feedbackAnalytics.feedbackEventStats.positiveEvents}
            subtitle="Like, save, playlist created"
          />
          <StatCard
            title="Negative labels"
            value={feedbackAnalytics.feedbackEventStats.negativeEvents}
            subtitle="Ignored recommendation events"
          />
          <StatCard
            title="Ignore rate"
            value={feedbackAnalytics.eventIgnoreRate}
            subtitle="Negative labels / labelable events"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <WeightList
            title="Top boosted artists"
            items={feedbackAnalytics.topBoostedArtists}
          />
          <WeightList
            title="Top genre weights"
            items={feedbackAnalytics.topGenres}
          />
          <WeightList
            title="Top mood weights"
            items={feedbackAnalytics.topMoods}
          />
        </div>
      </section>
    </>
  );
}

export default FeedbackAnalyticsSection;
