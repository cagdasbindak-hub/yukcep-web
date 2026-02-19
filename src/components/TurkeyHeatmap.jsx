import { useState, useMemo } from "react";

// Accurate Turkey city coordinates (SVG viewBox 0 0 100 50)
const CITY_COORDS = {
  "İstanbul": { x: 28.5, y: 15 },
  "Ankara": { x: 42, y: 20 },
  "İzmir": { x: 22, y: 28 },
  "Bursa": { x: 28, y: 20 },
  "Antalya": { x: 34, y: 35 },
  "Adana": { x: 48, y: 33 },
  "Konya": { x: 42, y: 28 },
  "Gaziantep": { x: 54, y: 33 },
  "Mersin": { x: 45, y: 35 },
  "Kayseri": { x: 48, y: 24 },
  "Trabzon": { x: 60, y: 14 },
  "Samsun": { x: 52, y: 14 },
};

// Better Turkey outline path
const TURKEY_PATH = "M15,20 Q18,16 22,15 Q26,13 30,14 Q34,13 38,14 Q42,13 46,14 Q50,12 54,13 Q58,11 62,12 Q66,13 70,14 Q74,14 76,16 Q78,17 76,20 Q74,22 72,24 Q70,26 68,28 Q66,30 64,32 Q62,34 58,36 Q54,38 50,38 Q46,38 42,37 Q38,36 34,38 Q30,38 26,36 Q22,34 20,32 Q18,30 16,28 Q14,26 14,24 Q14,22 15,20Z";

function getHeatColor(count) {
  if (count >= 3) return { fill: "#ef4444", glow: "#ef444480", label: "Yoğun" };
  if (count >= 2) return { fill: "#f59e0b", glow: "#f59e0b60", label: "Orta" };
  if (count >= 1) return { fill: "#3b82f6", glow: "#3b82f640", label: "Normal" };
  return { fill: "#475569", glow: "#47556940", label: "Az" };
}

export default function TurkeyHeatmap({ loads, onCityClick, selectedLoad, onLoadSelect }) {
  const [hoveredCity, setHoveredCity] = useState(null);

  // Count loads per city
  const cityLoadCounts = useMemo(() => {
    const counts = {};
    Object.keys(CITY_COORDS).forEach((c) => (counts[c] = 0));
    loads.forEach((l) => {
      if (counts[l.from] !== undefined) counts[l.from]++;
      if (counts[l.to] !== undefined) counts[l.to]++;
    });
    return counts;
  }, [loads]);

  // Map loads to approximate positions
  const loadPositions = useMemo(() => {
    return loads.map((l) => {
      const fromCoord = CITY_COORDS[l.from] || { x: 45, y: 25 };
      const toCoord = CITY_COORDS[l.to] || { x: 45, y: 25 };
      return {
        ...l,
        mapX: (fromCoord.x + toCoord.x) / 2 + (Math.random() - 0.5) * 4,
        mapY: (fromCoord.y + toCoord.y) / 2 + (Math.random() - 0.5) * 3,
      };
    });
  }, [loads]);

  return (
    <div className="mx-4 mb-4 rounded-3xl overflow-hidden border border-slate-700/50 bg-slate-800/40 relative shadow-inner" style={{ height: "240px" }}>
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 40% 40%, rgba(59,130,246,0.05) 0%, transparent 60%)" }} />
      
      <svg viewBox="8 6 76 40" className="w-full h-full" style={{ filter: "drop-shadow(0 0 1px rgba(59,130,246,0.2))" }}>
        <defs>
          <linearGradient id="heatmapBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <filter id="cityGlow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="heavyGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="heatRed" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="heatAmber" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="heatBlue" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>

          {/* Grid pattern */}
          <pattern id="heatGrid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="white" strokeWidth="0.05" opacity="0.15" />
          </pattern>
        </defs>

        {/* Turkey outline - filled */}
        <path
          d={TURKEY_PATH}
          fill="#1e293b"
          stroke="#334155"
          strokeWidth="0.3"
        />

        {/* Grid overlay */}
        <rect x="8" y="6" width="76" height="40" fill="url(#heatGrid)" />

        {/* Heat zones behind cities */}
        {Object.entries(CITY_COORDS).map(([name, coord]) => {
          const count = cityLoadCounts[name] || 0;
          if (count === 0) return null;
          const r = count >= 3 ? 8 : count >= 2 ? 6 : 4;
          const gradId = count >= 3 ? "heatRed" : count >= 2 ? "heatAmber" : "heatBlue";
          return (
            <circle
              key={`heat-${name}`}
              cx={coord.x}
              cy={coord.y}
              r={r}
              fill={`url(#${gradId})`}
              style={{ animation: "heatmap-glow 3s ease-in-out infinite" }}
            />
          );
        })}

        {/* Route lines for loads */}
        {loads.map((l) => {
          const from = CITY_COORDS[l.from];
          const to = CITY_COORDS[l.to];
          if (!from || !to) return null;
          const isSelected = selectedLoad?.id === l.id;
          return (
            <line
              key={`route-${l.id}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={isSelected ? "#22d3ee" : l.urgent ? "#ef444440" : "#3b82f620"}
              strokeWidth={isSelected ? 0.5 : 0.2}
              strokeDasharray={isSelected ? "none" : "1 1"}
            />
          );
        })}

        {/* City dots with heat effect */}
        {Object.entries(CITY_COORDS).map(([name, coord]) => {
          const count = cityLoadCounts[name] || 0;
          const heat = getHeatColor(count);
          const isHovered = hoveredCity === name;
          const baseR = count >= 3 ? 1.8 : count >= 2 ? 1.4 : count >= 1 ? 1.1 : 0.7;

          return (
            <g
              key={`city-${name}`}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredCity(name)}
              onMouseLeave={() => setHoveredCity(null)}
              onClick={() => onCityClick?.(name)}
            >
              {/* Pulse ring for active cities */}
              {count > 0 && (
                <circle
                  cx={coord.x}
                  cy={coord.y}
                  r={baseR}
                  fill="none"
                  stroke={heat.fill}
                  strokeWidth="0.3"
                  opacity="0.6"
                >
                  <animate
                    attributeName="r"
                    values={`${baseR};${baseR + 2.5};${baseR}`}
                    dur={count >= 3 ? "1.5s" : "2.5s"}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.6;0;0.6"
                    dur={count >= 3 ? "1.5s" : "2.5s"}
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Main dot */}
              <circle
                cx={coord.x}
                cy={coord.y}
                r={isHovered ? baseR + 0.5 : baseR}
                fill={heat.fill}
                stroke="white"
                strokeWidth={isHovered ? 0.4 : 0.2}
                filter={count >= 2 ? "url(#cityGlow)" : ""}
                style={{ transition: "r 0.2s, stroke-width 0.2s" }}
              />

              {/* City label */}
              {(isHovered || count >= 2) && (
                <g>
                  <rect
                    x={coord.x - (name.length * 1.2)}
                    y={coord.y - 4.5}
                    width={name.length * 2.4}
                    height={3.2}
                    rx="0.8"
                    fill="#0f172a"
                    stroke={heat.fill}
                    strokeWidth="0.15"
                    opacity="0.9"
                  />
                  <text
                    x={coord.x}
                    y={coord.y - 2.5}
                    textAnchor="middle"
                    fill="white"
                    fontSize="1.8"
                    fontWeight="bold"
                    fontFamily="system-ui, sans-serif"
                  >
                    {name}
                  </text>
                </g>
              )}

              {/* Load count badge */}
              {count > 0 && isHovered && (
                <g>
                  <circle cx={coord.x + baseR + 1.5} cy={coord.y - baseR - 0.5} r="1.5" fill={heat.fill} stroke="#0f172a" strokeWidth="0.3" />
                  <text x={coord.x + baseR + 1.5} y={coord.y - baseR + 0.15} textAnchor="middle" fill="white" fontSize="1.5" fontWeight="bold">
                    {count}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Load dots on map */}
        {loadPositions.map((l) => {
          const isSelected = selectedLoad?.id === l.id;
          return (
            <g
              key={`load-${l.id}`}
              className="cursor-pointer"
              onClick={() => onLoadSelect?.(l)}
            >
              <circle
                cx={l.mapX}
                cy={l.mapY}
                r={isSelected ? 1.5 : 0.8}
                fill={l.urgent ? "#ef4444" : "#22d3ee"}
                opacity={isSelected ? 1 : 0.6}
                stroke={isSelected ? "white" : "none"}
                strokeWidth="0.2"
              />
              {isSelected && (
                <g>
                  <rect x={l.mapX - 6} y={l.mapY - 4} width="12" height="3" rx="0.8" fill="#0f172aee" stroke="#22d3ee" strokeWidth="0.15" />
                  <text x={l.mapX} y={l.mapY - 2} textAnchor="middle" fill="#22d3ee" fontSize="1.6" fontWeight="bold">
                    {l.price?.toLocaleString("tr-TR")}₺
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-3 flex items-center gap-3 text-[9px] text-slate-500 font-bold">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Yoğun</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Orta</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Normal</span>
      </div>

      {/* Interactive label */}
      <div className="absolute bottom-2 right-3 text-[9px] text-slate-500 font-mono flex items-center gap-1">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute h-full w-full rounded-full bg-cyan-400 opacity-75" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-cyan-500" />
        </span>
        canlı harita
      </div>
    </div>
  );
}
