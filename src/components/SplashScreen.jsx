import { useState, useEffect, useMemo } from "react";

// ─── Particle System ───
const generateParticles = (count) =>
  Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: Math.random() * 4 + 1,
    duration: Math.random() * 4 + 3,
    delay: Math.random() * 3,
    drift: (Math.random() - 0.5) * 100,
    color: ["#3b82f6", "#60a5fa", "#06b6d4", "#22d3ee", "#818cf8", "#a78bfa"][
      Math.floor(Math.random() * 6)
    ],
  }));

// ─── Stars ───
const generateStars = (count) =>
  Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 60,
    size: Math.random() * 2 + 0.5,
    delay: Math.random() * 5,
    duration: Math.random() * 3 + 2,
  }));

export default function SplashScreen({ onComplete }) {
  const [phase, setPhase] = useState(0); // 0=particles, 1=truck, 2=title, 3=fadeout
  const [fadeOut, setFadeOut] = useState(false);

  const particles = useMemo(() => generateParticles(30), []);
  const stars = useMemo(() => generateStars(40), []);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300); // truck appears
    const t2 = setTimeout(() => setPhase(2), 1100); // truck stops, driver waves, title reveals
    const t3 = setTimeout(() => setFadeOut(true), 2800); // fade out
    const t4 = setTimeout(() => onComplete(), 3400); // done

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete]);

  return (
    <div className={`splash-container ${fadeOut ? "fade-out" : ""}`}>
      {/* ─── Background Stars ─── */}
      {stars.map((s) => (
        <div
          key={`star-${s.id}`}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animation: `star-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      {/* ─── Ambient Glow Orbs ─── */}
      <div
        className="absolute w-64 h-64 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
          top: "20%",
          left: "10%",
          animation: "orb-float 8s ease-in-out infinite",
        }}
      />
      <div
        className="absolute w-48 h-48 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)",
          bottom: "30%",
          right: "5%",
          animation: "orb-float 10s ease-in-out 2s infinite",
        }}
      />

      {/* ─── Road SVG ─── */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 800 120"
        style={{ height: "120px", opacity: phase >= 1 ? 1 : 0, transition: "opacity 0.5s" }}
        preserveAspectRatio="none"
      >
        {/* Ground */}
        <rect x="0" y="60" width="800" height="60" fill="#1a1a2e" />
        {/* Road surface */}
        <rect x="0" y="55" width="800" height="30" fill="#2a2a3e" rx="2" />
        {/* Road edge lines */}
        <line x1="0" y1="55" x2="800" y2="55" stroke="#4a4a5a" strokeWidth="1.5" />
        <line x1="0" y1="85" x2="800" y2="85" stroke="#4a4a5a" strokeWidth="1.5" />
        {/* Center dashes */}
        <line
          x1="0" y1="70" x2="800" y2="70"
          stroke="#fbbf24"
          strokeWidth="2"
          strokeDasharray="15 10"
          style={{ animation: "road-dash 1s linear infinite" }}
        />
      </svg>

      {/* ─── Floating Particles ─── */}
      {particles.map((p) => (
        <div
          key={`p-${p.id}`}
          className="splash-particle"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            "--drift": `${p.drift}px`,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
        />
      ))}

      {/* ─── Truck + Exhaust ─── */}
      {phase >= 1 && (
        <div
          className="absolute splash-truck-stage splash-truck-entry"
          style={{
            bottom: "75px",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          {/* Headlight glow */}
          <div
            className="absolute -right-6 top-1/2 -translate-y-1/2 w-16 h-8 rounded-full"
            style={{
              background: "radial-gradient(ellipse, rgba(251,191,36,0.4) 0%, transparent 70%)",
            }}
          />
          {/* Truck emoji with bounce */}
          <div className="splash-truck-bounce" style={{ fontSize: "64px", lineHeight: 1 }}>
            🚛
          </div>

          {/* Driver appears when truck reaches center */}
          {phase >= 2 && (
            <>
              <div className="splash-driver-pop" style={{ fontSize: "24px", lineHeight: 1 }}>
                <span role="img" aria-label="driver">🧑‍✈️</span>
                <span className="splash-driver-wave" role="img" aria-label="wave">👋</span>
              </div>
              <div className="splash-driver-bubble">
                Selam!
              </div>
            </>
          )}

          {/* Speed lines */}
          <div className="absolute -left-12 top-1/2 -translate-y-1/2 space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-0.5 rounded-full"
                style={{
                  width: `${20 + i * 8}px`,
                  background: `linear-gradient(90deg, transparent, rgba(148,163,184,${0.3 + i * 0.1}))`,
                  animation: `speedline 0.8s ease-out ${i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── Title & Subtitle ─── */}
      <div className="relative z-10 text-center" style={{ marginBottom: "140px" }}>
        {phase >= 2 && (
          <>
            <h1
              className="splash-title splash-title-glow text-6xl sm:text-7xl font-black text-white tracking-tight"
              style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}
            >
              Yük
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: "linear-gradient(135deg, #3b82f6, #06b6d4, #60a5fa)",
                }}
              >
                Cep
              </span>
            </h1>
            <p
              className="splash-subtitle text-slate-400 text-lg sm:text-xl font-medium mt-3 tracking-wide"
            >
              Türkiye'nin Nakliye Platformu
            </p>
            {/* Loading indicator */}
            <div className="splash-subtitle flex items-center justify-center gap-2 mt-6">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-blue-400"
                  style={{
                    animation: `loading-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ─── Bottom gradient ─── */}
      <div
        className="absolute bottom-0 left-0 w-full h-32 pointer-events-none"
        style={{
          background: "linear-gradient(transparent, rgba(2,6,23,0.8))",
        }}
      />
    </div>
  );
}
