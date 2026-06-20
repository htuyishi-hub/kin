import { useCallback, useEffect, useRef, useState } from "react";

// Geographic coordinates updated to match real Rwanda shape
const KIGALI: [number, number] = [500, 388];

const ROUTES = [
  {
    id: "musanze",
    from: [338, 158] as [number, number],
    path: "M 338 158 Q 400 268 500 388",
    color: "#2563EB",
    glow: "rgba(37,99,235,0.85)",
    delay: 0,
    dur: 2.9,
    label: "Musanze",
    labelAnchor: "middle" as const,
    labelX: 338,
    labelY: 143,
  },
  {
    id: "huye",
    from: [420, 575] as [number, number],
    path: "M 420 575 Q 458 482 500 388",
    color: "#C9A84C",
    glow: "rgba(201,168,76,0.85)",
    delay: 0.38,
    dur: 2.6,
    label: "Huye",
    labelAnchor: "middle" as const,
    labelX: 420,
    labelY: 596,
  },
  {
    id: "rubavu",
    from: [148, 252] as [number, number],
    path: "M 148 252 Q 314 308 500 388",
    color: "#1D9E75",
    glow: "rgba(29,158,117,0.75)",
    delay: 0.7,
    dur: 2.4,
    label: "Rubavu",
    labelAnchor: "end" as const,
    labelX: 140,
    labelY: 252,
  },
];

// Real Rwanda border — clockwise from NE (Uganda-Tanzania corner).
// Western border follows Lake Kivu (jagged). Northern border = Uganda.
// Eastern border = Tanzania. Southern border = Burundi.
const RWANDA =
  "M 758 93 " +
  // ── Northern border (Uganda) west across the top ───────────────────
  "L 718 90 L 658 89 L 592 90 L 528 90 L 465 92 L 402 94 " +
  "L 342 98 L 285 105 L 245 113 L 208 130 L 185 155 " +
  // ── Lake Kivu western border (jagged – DRC/Congo) ──────────────────
  "L 162 188 " +
  "L 144 222 " +
  "L 153 252 " +   // near Rubavu
  "L 128 282 " +
  "L 148 312 " +
  "L 118 342 " +
  "L 140 370 " +
  "L 132 400 " +
  "L 150 430 " +
  "L 153 460 " +
  "L 162 485 " +
  // ── South-west corner + Burundian border east ──────────────────────
  "L 180 512 " +
  "L 218 538 " +
  "L 268 560 " +
  "L 325 576 " +
  "L 385 590 " +
  "L 448 598 " +   // near Huye
  "L 508 592 " +
  "L 558 575 " +
  "L 600 550 " +
  // ── Eastern border (Tanzania) going north ─────────────────────────
  "L 632 522 " +
  "L 656 490 " +
  "L 670 458 " +
  "L 680 422 " +
  "L 688 385 " +
  "L 690 348 " +
  "L 684 310 " +
  "L 676 272 " +
  "L 668 235 " +
  "L 664 198 " +
  "L 668 160 " +
  // ── NE corner back to start ────────────────────────────────────────
  "L 690 128 L 722 106 L 758 93 Z";

// Interior reference dots (population texture), all verified inside the new outline
const POP_DOTS: [number, number][] = [
  [340, 165], [420, 145], [480, 150], [540, 158], [600, 175],
  [650, 210], [660, 260], [655, 310], [640, 360], [620, 405],
  [580, 445], [540, 480], [490, 510], [445, 540], [390, 555],
  [340, 535], [295, 510], [258, 480], [235, 448], [225, 415],
  [220, 380], [228, 345], [240, 310], [258, 278], [282, 248],
  [318, 225], [358, 205], [400, 192], [450, 182], [500, 280],
  [450, 340], [400, 390], [550, 340], [480, 440], [380, 460],
];

type Phase = "idle" | "appear" | "travel" | "arrived" | "hold" | "fadeout";

function usePrefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function RwandaMapAnimation() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [traveling, setTraveling] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cycleRef = useRef<(() => void) | null>(null);
  const prefersReduced = usePrefersReducedMotion();

  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const after = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  };

  const cycle = useCallback(() => {
    clearAll();

    if (prefersReduced) {
      setPhase("arrived");
      setTraveling(false);
      return;
    }

    setTraveling(false);
    setPhase("appear");

    after(() => { setTraveling(true); setPhase("travel"); }, 600);
    after(() => setPhase("arrived"), 4000);
    after(() => setPhase("hold"), 4600);
    after(() => { setPhase("fadeout"); setTraveling(false); }, 7200);
    after(() => cycleRef.current?.(), 8000);
  }, [prefersReduced]);

  cycleRef.current = cycle;

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          cycle();
        } else {
          clearAll();
          setPhase("idle");
          setTraveling(false);
        }
      },
      { threshold: 0.1 }
    );
    if (svgRef.current) obs.observe(svgRef.current);
    return () => { obs.disconnect(); clearAll(); };
  }, [cycle]);

  const visible = phase !== "idle";
  const fading = phase === "fadeout" || phase === "idle";
  const arrived = phase === "arrived" || phase === "hold";
  const showLabels = phase === "appear" || phase === "travel" || arrived;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1000 800"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 w-full h-full pointer-events-none select-none"
      aria-hidden="true"
      style={{
        opacity: visible ? (fading ? 0 : 1) : 0,
        transition: fading ? "opacity 0.7s ease" : "opacity 0.5s ease",
      }}
    >
      {/* Rwanda map fill */}
      <path
        d={RWANDA}
        fill="#1A1A2E"
        fillOpacity={0.6}
        stroke="#2D3748"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Population texture dots */}
      {POP_DOTS.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={1.2} fill="#4A4742" opacity={0.4} />
      ))}

      {/* Lake Kivu highlight — western edge */}
      <path
        d="M 185 155 L 162 188 L 144 222 L 153 252 L 128 282 L 148 312 L 118 342 L 140 370 L 132 400 L 150 430 L 153 460 L 162 485"
        fill="none"
        stroke="#1D4E89"
        strokeWidth="3"
        strokeLinecap="round"
        opacity={0.35}
      />

      {/* Route dashed trails */}
      {ROUTES.map((route) => (
        <path
          key={`trail-${route.id}`}
          d={route.path}
          fill="none"
          stroke={route.color}
          strokeWidth="1.2"
          strokeDasharray="5 8"
          opacity={traveling && !arrived ? 0.3 : 0}
          style={{ transition: "opacity 0.4s ease" }}
        />
      ))}

      {/* Animated dots traveling to Kigali */}
      {ROUTES.map((route) => {
        const dotStyle: React.CSSProperties = arrived
          ? { opacity: 0, transition: "opacity 0.3s ease" }
          : traveling
          ? {
              offsetPath: `path('${route.path}')`,
              offsetDistance: "100%",
              offsetRotate: "0deg",
              opacity: 1,
              filter: `drop-shadow(0 0 7px ${route.glow})`,
              transition: `offset-distance ${route.dur}s ${route.delay}s cubic-bezier(0.4,0,0.2,1)`,
            }
          : phase === "appear"
          ? {
              offsetPath: `path('${route.path}')`,
              offsetDistance: "0%",
              offsetRotate: "0deg",
              opacity: 1,
              filter: `drop-shadow(0 0 7px ${route.glow})`,
              transition: "none",
            }
          : { opacity: 0 };

        return (
          <circle key={`dot-${route.id}`} r={7} fill={route.color} style={dotStyle} />
        );
      })}

      {/* City labels */}
      {showLabels &&
        ROUTES.map((route) => (
          <text
            key={`label-${route.id}`}
            x={route.labelX}
            y={route.labelY}
            textAnchor={route.labelAnchor}
            fill="#6B7280"
            fontSize="11"
            fontFamily="Inter, sans-serif"
            letterSpacing="0.05em"
            style={{ opacity: arrived ? 0 : 1, transition: "opacity 0.4s ease" }}
          >
            {route.label}
          </text>
        ))}

      {/* Static city markers (appear phase) */}
      {phase === "appear" &&
        ROUTES.map((route) => (
          <circle
            key={`start-${route.id}`}
            cx={route.from[0]}
            cy={route.from[1]}
            r={4}
            fill={route.color}
            opacity={0.5}
          />
        ))}

      {/* Meeting point — pulse rings + merged dot */}
      {arrived && (
        <>
          <circle cx={KIGALI[0]} cy={KIGALI[1]} r={32} fill="none" stroke="#2563EB" strokeWidth="1.5" className="kin-ring-expand" opacity={0.3} />
          <circle cx={KIGALI[0]} cy={KIGALI[1]} r={18} fill="none" stroke="#2563EB" strokeWidth="1.5" opacity={0.5} className="kin-ring-mid" />
          <circle cx={KIGALI[0]} cy={KIGALI[1]} r={10} fill="#2563EB" className="kin-met-pulse" style={{ filter: "drop-shadow(0 0 14px rgba(37,99,235,0.95))" }} />
          <circle cx={KIGALI[0]} cy={KIGALI[1]} r={3.5} fill="rgba(255,255,255,0.9)" />
          <circle cx={KIGALI[0]} cy={KIGALI[1]} r={14} fill="none" stroke="#C9A84C" strokeWidth="1" opacity={0.4} />
        </>
      )}

      {/* Kigali label */}
      {arrived && (
        <text
          x={KIGALI[0] + 20}
          y={KIGALI[1] + 5}
          fill="#A8A49E"
          fontSize="13"
          fontFamily="Inter, sans-serif"
          letterSpacing="0.06em"
          className="kin-fade-in"
        >
          Kigali
        </text>
      )}
    </svg>
  );
}
