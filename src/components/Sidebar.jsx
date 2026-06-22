// src/components/Sidebar.jsx

import { NavLink } from "react-router-dom";

function Sidebar() {
  const links = [
    {
      label: "Dashboard",
      path: "/dashboard",
    },
    {
      label: "Recommendations",
      path: "/recommendations",
    },
    {
      label: "Group Mix",
      path: "/group",
    },
    {
      label: "Model",
      path: "/model",
    },
    {
      label: "Use Your Data",
      path: "/login",
    },
  ];

  return (
    <aside className="w-[260px] h-full p-2 text-white hidden lg:block">
      <div className="bg-[#121212] w-full h-full rounded-lg p-4 flex flex-col gap-6">
        <div>
          <h2 className="font-bold text-base">Music Intelligence</h2>

          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            Real Spotify history transformed into analytics, recommendation
            systems, and ML-driven insights.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {links.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `rounded-lg px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-white text-black"
                    : "bg-[#181818] text-white hover:bg-[#242424]"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="mt-auto text-xs text-gray-500">
          Recommendation System • Cosine Similarity • Evaluation Metrics
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
