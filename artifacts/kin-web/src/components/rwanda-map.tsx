import { useCallback, useEffect, useRef, useState } from "react";

const KIGALI: [number, number] = [500, 388];

const ROUTES = [
  {
    id: "musanze",
    from: [252, 192] as [number, number],
    path: "M 252 192 Q 318 262 500 388",
    color: "#2563EB",
    glow: "rgba(37,99,235,0.85)",
    delay: 0,
    dur: 2.9,
    label: "Musanze",
    labelAnchor: "middle" as const,
    labelX: 252,
    labelY: 177,
  },
  {
    id: "huye",
    from: [448, 588] as [number, number],
    path: "M 448 588 Q 415 485 500 388",
    color: "#C9A84C",
    glow: "rgba(201,168,76,0.85)",
    delay: 0.38,
    dur: 2.6,
    label: "Huye",
    labelAnchor: "middle" as const,
    labelX: 448,
    labelY: 608,
  },
  {
    id: "rubavu",
    from: [120, 248] as [number, number],
    path: "M 120 248 Q 298 302 500 388",
    color: "#1D9E75",
    glow: "rgba(29,158,117,0.75)",
    delay: 0.7,
    dur: 2.4,
    label: "Rubavu",
    labelAnchor: "end" as const,
    labelX: 112,
    labelY: 248,
  },
];

const RWANDA =
  "M 265 108 L 322 82 L 392 68 L 462 56 L 537 53 L 602 61 L 668 72 L 722 88 L 770 110 L 810 146 L 838 186 L 845 232 L 830 282 L 812 338 L 804 396 L 780 452 L 750 502 L 712 546 L 670 582 L 620 610 L 560 628 L 494 640 L 428 644 L 366 632 L 306 612 L 256 584 L 204 547 L 164 502 L 133 453 L 110 398 L 96 340 L 100 284 L 116 236 L 140 194 L 174 160 L 210 130 Z";

type Phase = "idle" | "appear" | "travel" | "arrived" | "hold" | "fadeout";

function usePrefersReducedMotion() {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

    after(() => {
      setTraveling(true);
      setPhase("travel");
    }, 600);

    after(() => setPhase("arrived"), 4000);
    after(() => setPhase("hold"), 4600);

    after(() => {
      setPhase("fadeout");
      setTraveling(false);
    }, 7200);

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
      {/* Rwanda map outline */}
      <path
        d={RWANDA}
        fill="#1A1A2E"
        fillOpacity={0.55}
        stroke="#4A4742"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Subtle population-dot texture inside map */}
      {[
        [350,200],[420,240],[480,180],[550,210],[600,250],[480,300],
        [540,350],[460,410],[380,370],[320,430],[580,380],[640,440],
        [420,480],[500,520],[350,500],[580,510],[480,560],[440,360],
      ].map(([cx, cy], i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={1.2}
          fill="#4A4742"
          opacity={0.35}
        />
      ))}

      {/* Route dashed trails — appear when traveling */}
      {ROUTES.map((route) => (
        <path
          key={`trail-${route.id}`}
          d={route.path}
          fill="none"
          stroke={route.color}
          strokeWidth="1.2"
          strokeDasharray="5 8"
          opacity={traveling && !arrived ? 0.28 : 0}
          style={{ transition: "opacity 0.4s ease" }}
        />
      ))}

      {/* Animated dots */}
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
          <circle
            key={`dot-${route.id}`}
            r={7}
            fill={route.color}
            style={dotStyle}
          />
        );
      })}

      {/* City labels */}
      {showLabels && ROUTES.map((route) => (
        <text
          key={`label-${route.id}`}
          x={route.labelX}
          y={route.labelY}
          textAnchor={route.labelAnchor}
          fill="#4A4742"
          fontSize="12"
          fontFamily="Inter, sans-serif"
          letterSpacing="0.04em"
          style={{
            opacity: arrived ? 0 : 1,
            transition: "opacity 0.4s ease",
          }}
        >
          {route.label}
        </text>
      ))}

      {/* Start dots (static position markers) */}
      {(phase === "appear") && ROUTES.map((route) => (
        <circle
          key={`start-${route.id}`}
          cx={route.from[0]}
          cy={route.from[1]}
          r={4}
          fill={route.color}
          opacity={0.5}
        />
      ))}

      {/* Meeting point: pulse rings + merged dot */}
      {arrived && (
        <>
          {/* Outer expanding ring */}
          <circle
            cx={KIGALI[0]}
            cy={KIGALI[1]}
            r={32}
            fill="none"
            stroke="#2563EB"
            strokeWidth="1.5"
            className="kin-ring-expand"
            opacity={0.3}
          />
          {/* Mid ring */}
          <circle
            cx={KIGALI[0]}
            cy={KIGALI[1]}
            r={18}
            fill="none"
            stroke="#2563EB"
            strokeWidth="1.5"
            opacity={0.5}
            className="kin-ring-mid"
          />
          {/* Core dot */}
          <circle
            cx={KIGALI[0]}
            cy={KIGALI[1]}
            r={10}
            fill="#2563EB"
            className="kin-met-pulse"
            style={{
              filter: "drop-shadow(0 0 14px rgba(37,99,235,0.95))",
            }}
          />
          {/* White center */}
          <circle
            cx={KIGALI[0]}
            cy={KIGALI[1]}
            r={3.5}
            fill="rgba(255,255,255,0.9)"
          />
          {/* Gold accent ring */}
          <circle
            cx={KIGALI[0]}
            cy={KIGALI[1]}
            r={14}
            fill="none"
            stroke="#C9A84C"
            strokeWidth="1"
            opacity={0.4}
          />
        </>
      )}

      {/* Kigali label at meeting point */}
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
