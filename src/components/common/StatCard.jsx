function StatCard({ title, value, subtitle }) {
  return (
    <div className="bg-[#181818] rounded-lg p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
        {title}
      </p>
      <h3 className="mt-3 text-3xl font-bold">{value}</h3>
      <p className="mt-2 text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

export default StatCard;
