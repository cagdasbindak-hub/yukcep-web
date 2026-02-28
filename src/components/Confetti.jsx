import { useMemo } from "react";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899", "#fbbf24"];
const SHAPES = ["square", "circle", "triangle"];

const hashString = (value) => {
  let hash = 0;
  const str = String(value ?? "");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 33 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const seededBetween = (seed, min, max) => {
  const normalized = hashString(seed) / 0xffffffff;
  return min + normalized * (max - min);
};

export default function Confetti({ active, duration = 3000 }) {
  const pieces = useMemo(() => {
    if (!active) return [];

    const minAnim = Math.max(1.2, duration / 2600);
    const maxAnim = Math.max(2.4, duration / 1200);

    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: seededBetween(`${duration}-${i}-left`, 5, 95),
      color: COLORS[hashString(`${duration}-${i}-color`) % COLORS.length],
      shape: SHAPES[hashString(`${duration}-${i}-shape`) % SHAPES.length],
      size: seededBetween(`${duration}-${i}-size`, 6, 12),
      animDuration: seededBetween(`${duration}-${i}-anim`, minAnim, maxAnim),
      delay: seededBetween(`${duration}-${i}-delay`, 0, 0.5),
      rotation: seededBetween(`${duration}-${i}-rotation`, 0, 360),
      drift: seededBetween(`${duration}-${i}-drift`, -40, 40),
    }));
  }, [active, duration]);

  if (!active || pieces.length === 0) return null;

  return (
    <>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            top: "-10px",
            width: p.size,
            height: p.shape === "circle" ? p.size : p.size * 1.4,
            backgroundColor: p.shape !== "triangle" ? p.color : "transparent",
            borderRadius: p.shape === "circle" ? "50%" : p.shape === "square" ? "2px" : "0",
            borderLeft: p.shape === "triangle" ? `${p.size / 2}px solid transparent` : undefined,
            borderRight: p.shape === "triangle" ? `${p.size / 2}px solid transparent` : undefined,
            borderBottom: p.shape === "triangle" ? `${p.size}px solid ${p.color}` : undefined,
            animationDuration: `${p.animDuration}s`,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </>
  );
}
