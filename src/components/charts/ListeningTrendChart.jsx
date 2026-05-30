// src/components/charts/ListeningTrendChart.jsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatTooltipDate(label, timeRange) {
  const date = new Date(label);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  if (timeRange === "30d") {
    return `${day}/${month}/${year}`;
  }

  if (timeRange === "6m") {
    const weekOfMonth = Math.ceil(date.getDate() / 7);
    return `${month}/${year} week ${weekOfMonth}`;
  }

  return `${month}/${year}`;
}

function ListeningTrendChart({ data, timeRange }) {
  return (
    <div className="bg-[#181818] rounded-lg p-5 mb-6">
      <h2 className="text-xl font-bold mb-4">Listening Trend</h2>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="date" />
            <YAxis />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;

                return (
                  <div className="bg-black text-white border border-white/10 rounded-lg p-3 text-sm">
                    <p className="font-semibold">
                      {payload[0].payload.displayDate}
                    </p>
                    <p className="text-gray-300">Minutes: {payload[0].value}</p>
                  </div>
                );
              }}
            />

            <Line type="monotone" dataKey="minutesPlayed" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ListeningTrendChart;
