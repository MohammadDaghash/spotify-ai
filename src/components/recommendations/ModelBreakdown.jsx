import {
  formatScore,
  getNumericScore,
} from "../../utils/recommendationPageUtils.js";

function ScoreBar({ label, value, tone = "green" }) {
  const numericValue = getNumericScore(value);
  const width =
    numericValue === null ? 0 : Math.min(100, Math.max(0, numericValue * 100));
  const toneClass =
    tone === "red"
      ? "bg-red-400"
      : tone === "blue"
        ? "bg-sky-400"
        : tone === "amber"
          ? "bg-amber-300"
          : "bg-[#1db954]";

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 text-xs mb-1">
        <span className="text-gray-400 truncate">{label}</span>
        <span className="text-gray-300 shrink-0">{formatScore(value)}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`${toneClass} h-full rounded-full`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function ModelBreakdown({ signals }) {
  const visibleSignals = signals.filter(
    (signal) => getNumericScore(signal.value) !== null,
  );

  if (visibleSignals.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-3">
      {visibleSignals.map((signal) => (
        <ScoreBar
          key={signal.label}
          label={signal.label}
          value={signal.value}
          tone={signal.tone}
        />
      ))}
    </div>
  );
}

export default ModelBreakdown;
