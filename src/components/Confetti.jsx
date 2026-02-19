import { useEffect, useState } from "react";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899", "#fbbf24"];
const SHAPES = ["square", "circle", "triangle"];

function randomBetween(a, b) {
  return Math.random() * (b - a) + a;
}

export default function Confetti({ active, duration = 3000 }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!active) return;

    const newPieces = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: randomBetween(5, 95),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      size: randomBetween(6, 12),
      animDuration: randomBetween(1.5, 3.5),
      delay: randomBetween(0, 0.5),
      rotation: randomBetween(0, 360),
      drift: randomBetween(-40, 40),
    }));
    setPieces(newPieces);

    const timer = setTimeout(() => setPieces([]), duration);
    return () => clearTimeout(timer);
  }, [active, duration]);

  if (pieces.length === 0) return null;

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
