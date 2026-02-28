import { useMemo, useState } from "react";
import {
  TURKEY_CITY_LOOKUP,
  TURKEY_MAP_VIEWBOX,
  TURKEY_PROVINCES,
  normalizeCityKey,
} from "../lib/turkeyGeoData";

const hashString = (value) => {
  let hash = 0;
  const str = String(value ?? "");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const stableOffset = (seed, amplitude) => {
  const normalized = (hashString(seed) / 0xffffffff) * 2 - 1;
  return normalized * amplitude;
};

const resolveCity = (cityName) => TURKEY_CITY_LOOKUP[normalizeCityKey(cityName)] || null;

const getHeatColor = (count) => {
  if (count >= 5) return { fill: "#ef4444", glow: "#ef444466", label: "Cok Yogun" };
  if (count >= 3) return { fill: "#f59e0b", glow: "#f59e0b55", label: "Yogun" };
  if (count >= 1) return { fill: "#3b82f6", glow: "#3b82f644", label: "Aktif" };
  return { fill: "#64748b", glow: "#64748b33", label: "Pasif" };
};

const getProvinceFill = (count) => {
  if (count >= 5) return "#2b0f13";
  if (count >= 3) return "#2e1b0d";
  if (count >= 1) return "#132438";
  return "#0f172a";
};

export default function TurkeyHeatmap({ loads, onCityClick, selectedLoad, onLoadSelect }) {
  const [hoveredCity, setHoveredCity] = useState(null);

  const cityLoadCounts = useMemo(() => {
    const counts = Object.fromEntries(TURKEY_PROVINCES.map((province) => [province.name, 0]));
    loads.forEach((load) => {
      const from = resolveCity(load.from)?.name;
      const to = resolveCity(load.to)?.name;
      if (from && counts[from] !== undefined) counts[from] += 1;
      if (to && counts[to] !== undefined) counts[to] += 1;
    });
    return counts;
  }, [loads]);

  const routeLoads = useMemo(() => {
    return loads
      .map((load) => {
        const from = resolveCity(load.from);
        const to = resolveCity(load.to);
        if (!from || !to) return null;
        return { ...load, fromCity: from, toCity: to };
      })
      .filter(Boolean);
  }, [loads]);

  const loadPositions = useMemo(() => {
    return routeLoads.map((load) => {
      const seed = `${load.id}-${load.fromCity.name}-${load.toCity.name}`;
      return {
        ...load,
        mapX: (load.fromCity.x + load.toCity.x) / 2 + stableOffset(`${seed}:x`, 6),
        mapY: (load.fromCity.y + load.toCity.y) / 2 + stableOffset(`${seed}:y`, 4),
      };
    });
  }, [routeLoads]);

  return (
    <div
      className="mx-4 mb-4 rounded-3xl overflow-hidden border border-slate-700/60 bg-slate-900/60 relative shadow-inner"
      style={{ height: "360px" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 42%, rgba(56,189,248,0.10) 0%, rgba(14,23,36,0) 58%)",
        }}
      />

      <svg
        viewBox={TURKEY_MAP_VIEWBOX}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="mapSea" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0a1223" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <filter id="cityGlow">
            <feGaussianBlur stdDeviation="2.8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="provinceGrid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M 22 0 L 0 0 0 22" fill="none" stroke="#ffffff" strokeWidth="0.45" opacity="0.06" />
          </pattern>
        </defs>

        <rect x="0" y="0" width="1200" height="560" fill="url(#mapSea)" />

        <g>
          {TURKEY_PROVINCES.map((province) => {
            const count = cityLoadCounts[province.name] || 0;
            return (
              <path
                key={`province-${province.plate}`}
                d={province.path}
                fill={getProvinceFill(count)}
                stroke={count > 0 ? "#4b5563" : "#334155"}
                strokeWidth={count > 0 ? "1.1" : "0.9"}
                fillRule="evenodd"
              />
            );
          })}
        </g>

        <rect x="0" y="0" width="1200" height="560" fill="url(#provinceGrid)" />

        {routeLoads.map((load) => {
          const isSelected = selectedLoad?.id === load.id;
          return (
            <line
              key={`route-${load.id}`}
              x1={load.fromCity.x}
              y1={load.fromCity.y}
              x2={load.toCity.x}
              y2={load.toCity.y}
              stroke={isSelected ? "#22d3ee" : load.urgent ? "#ef44444a" : "#60a5fa33"}
              strokeWidth={isSelected ? "2.2" : "1.1"}
              strokeDasharray={isSelected ? "none" : "3 2"}
            />
          );
        })}

        {TURKEY_PROVINCES.map((province) => {
          const count = cityLoadCounts[province.name] || 0;
          const heat = getHeatColor(count);
          const isHovered = hoveredCity === province.name;
          const angle = ((province.plate * 37) % 360) * (Math.PI / 180);
          const labelDistance = count > 0 ? 13 : 10;
          const labelX = province.x + Math.cos(angle) * labelDistance;
          const labelY = province.y + Math.sin(angle) * labelDistance;
          const textAnchor = Math.cos(angle) >= 0 ? "start" : "end";
          const radius = count >= 5 ? 4.6 : count >= 3 ? 3.9 : count >= 1 ? 3.3 : 2.6;

          return (
            <g
              key={`city-${province.plate}`}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredCity(province.name)}
              onMouseLeave={() => setHoveredCity(null)}
              onClick={() => onCityClick?.(province.name)}
            >
              {count > 0 && (
                <circle
                  cx={province.x}
                  cy={province.y}
                  r={radius + 6}
                  fill={heat.glow}
                  opacity={isHovered ? 0.65 : 0.35}
                  filter="url(#cityGlow)"
                />
              )}

              <circle
                cx={province.x}
                cy={province.y}
                r={isHovered ? radius + 1.1 : radius}
                fill={heat.fill}
                stroke={count > 0 ? "#f8fafc" : "#94a3b8"}
                strokeWidth={isHovered ? "1.8" : "1.2"}
              />

              <text
                x={labelX}
                y={labelY}
                textAnchor={textAnchor}
                fill={count > 0 ? "#f8fafc" : "#94a3b8"}
                fontSize={count > 0 ? "9" : "8"}
                fontWeight={count > 0 ? "700" : "500"}
                fontFamily="'Segoe UI', 'SF Pro Display', sans-serif"
                opacity={isHovered ? 1 : count > 0 ? 0.96 : 0.82}
                pointerEvents="none"
              >
                {province.name}
              </text>

              {count > 0 && isHovered && (
                <g>
                  <rect
                    x={province.x - 28}
                    y={province.y - 28}
                    width="56"
                    height="16"
                    rx="6"
                    fill="#020617ee"
                    stroke={heat.fill}
                    strokeWidth="1"
                  />
                  <text
                    x={province.x}
                    y={province.y - 17}
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontSize="9"
                    fontWeight="700"
                  >
                    {province.name}: {count}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {loadPositions.map((load) => {
          const isSelected = selectedLoad?.id === load.id;
          return (
            <g key={`load-${load.id}`} className="cursor-pointer" onClick={() => onLoadSelect?.(load)}>
              <circle
                cx={load.mapX}
                cy={load.mapY}
                r={isSelected ? 4.2 : 2.5}
                fill={load.urgent ? "#ef4444" : "#22d3ee"}
                opacity={isSelected ? 1 : 0.75}
                stroke={isSelected ? "#ffffff" : "none"}
                strokeWidth="1.3"
              />
              {isSelected && (
                <g>
                  <rect
                    x={load.mapX - 30}
                    y={load.mapY - 24}
                    width="60"
                    height="16"
                    rx="6"
                    fill="#0f172add"
                    stroke="#22d3ee"
                    strokeWidth="1"
                  />
                  <text
                    x={load.mapX}
                    y={load.mapY - 13}
                    textAnchor="middle"
                    fill="#22d3ee"
                    fontSize="9"
                    fontWeight="700"
                  >
                    {load.price?.toLocaleString("tr-TR")} TL
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-2 left-3 flex items-center gap-3 text-[10px] text-slate-400 font-bold">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Cok Yogun
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Yogun
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Aktif
        </span>
      </div>

      <div className="absolute bottom-2 right-3 text-[10px] text-slate-400 font-mono flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute h-full w-full rounded-full bg-cyan-400 opacity-75" />
          <span className="relative h-2 w-2 rounded-full bg-cyan-500" />
        </span>
        81 il detayli harita
      </div>
    </div>
  );
}
