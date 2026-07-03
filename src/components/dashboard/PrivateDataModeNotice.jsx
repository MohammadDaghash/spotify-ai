function PrivateDataModeNotice({ onBackToDemo, onImportHistory }) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-semibold text-amber-100">
          Personal data mode is active
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-300">
          Spotify login only provides recent/current API data. For the full
          public portfolio dataset, switch back to demo mode. For your full
          personal history, import the extended Spotify JSON export from Use
          Your Data.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-full bg-white px-4 py-2 text-xs font-bold text-black transition hover:scale-[1.02]"
          onClick={onBackToDemo}
          type="button"
        >
          Back to public demo
        </button>
        <button
          className="rounded-full bg-[#2a2a2a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#333]"
          onClick={onImportHistory}
          type="button"
        >
          Import full history
        </button>
      </div>
    </div>
  );
}

export default PrivateDataModeNotice;
