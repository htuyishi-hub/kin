import React, { useEffect, useRef } from 'react';

interface WelcomeAnimationProps {
  tagline: string;
}

const TIMING = {
  darknessDuration: 1500,
  enterDuration:    2500,
  slowDuration:     2500,
  convergeDuration: 2500,
  scatterDuration:   600,
  gatherDuration:   1900,
  textHoldDuration: 2800,
  fadeOutDuration:  1000,
};

const TOTAL_CYCLE =
  TIMING.darknessDuration +
  TIMING.enterDuration +
  TIMING.slowDuration +
  TIMING.convergeDuration +
  TIMING.scatterDuration +
  TIMING.gatherDuration +
  TIMING.textHoldDuration +
  TIMING.fadeOutDuration;

interface Point {
  x: number;
  y: number;
}

function sampleCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, count: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const u = 1 - t;
    pts.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return pts;
}

function sampleLine(p0: Point, p1: Point, count: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    pts.push({
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t,
    });
  }
  return pts;
}

// Exactly 92 targets for the official connected kn logo
function generateKnTargets(cx: number, cy: number, size: number): Point[] {
  const stem = {
    p0: { x: cx - size * 0.6573, y: cy - size * 0.5 },
    p1: { x: cx - size * 0.6573, y: cy + size * 0.5 },
  };

  const arm = {
    p0: { x: cx - size * 0.5734, y: cy + size * 0.3811 },
    p1: { x: cx - size * 0.5175, y: cy + size * 0.1538 },
    p2: { x: cx - size * 0.3986, y: cy - size * 0.0385 },
    p3: { x: cx - size * 0.2308, y: cy - size * 0.1713 },
  };

  const branch = {
    p0: { x: cx - size * 0.4371, y: cy + size * 0.1189 },
    p1: { x: cx - size * 0.3497, y: cy + size * 0.2587 },
    p2: { x: cx - size * 0.2622, y: cy + size * 0.4650 },
    p3: { x: cx - size * 0.1259, y: cy + size * 0.4650 },
  };

  const rise1 = {
    p0: { x: cx - size * 0.1259, y: cy + size * 0.4650 },
    p1: { x: cx - size * 0.0175, y: cy + size * 0.4650 },
    p2: { x: cx + size * 0.0280, y: cy + size * 0.2762 },
    p3: { x: cx + size * 0.0420, y: cy + size * 0.0315 },
  };

  const rise2 = {
    p0: { x: cx + size * 0.0420, y: cy + size * 0.0315 },
    p1: { x: cx + size * 0.0490, y: cy - size * 0.1084 },
    p2: { x: cx + size * 0.1748, y: cy - size * 0.1573 },
    p3: { x: cx + size * 0.3322, y: cy - size * 0.1573 },
  };

  const arch = {
    p0: { x: cx + size * 0.3322, y: cy - size * 0.1573 },
    p1: { x: cx + size * 0.5070, y: cy - size * 0.1573 },
    p2: { x: cx + size * 0.6573, y: cy - size * 0.0804 },
    p3: { x: cx + size * 0.6573, y: cy + size * 0.1014 },
  };

  const leg = {
    p0: { x: cx + size * 0.6573, y: cy + size * 0.1014 },
    p1: { x: cx + size * 0.6573, y: cy + size * 0.4930 },
  };

  return [
    ...sampleLine(stem.p0, stem.p1, 24),
    ...sampleCubicBezier(arm.p0, arm.p1, arm.p2, arm.p3, 18),
    ...sampleCubicBezier(branch.p0, branch.p1, branch.p2, branch.p3, 14),
    ...sampleCubicBezier(rise1.p0, rise1.p1, rise1.p2, rise1.p3, 10),
    ...sampleCubicBezier(rise2.p0, rise2.p1, rise2.p2, rise2.p3, 8),
    ...sampleCubicBezier(arch.p0, arch.p1, arch.p2, arch.p3, 10),
    ...sampleLine(leg.p0, leg.p1, 8),
  ];
}

class Particle {
  x: number;
  y: number;
  startX: number;
  startY: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  targetX: number;
  targetY: number;

  constructor(sourceX: number, sourceY: number, target: Point) {
    const angle = Math.random() * Math.PI * 2;
    const radial = Math.sqrt(Math.random()) * 28;
    this.startX = sourceX + Math.cos(angle) * radial;
    this.startY = sourceY + Math.sin(angle) * radial * 2;
    this.x = this.startX;
    this.y = this.startY;
    this.vx = (Math.random() - 0.5) * 4.5;
    this.vy = (Math.random() - 0.5) * 4.5;
    this.radius = 2.0 + Math.random() * 2.8;
    this.alpha = 0.45 + Math.random() * 0.45;
    this.targetX = target.x;
    this.targetY = target.y;
  }
}

function drawShadowFigure(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  walkBob: number,
  scale: number = 0.95
) {
  const W = 56 * scale;
  const H = 150 * scale;
  const y = cy + walkBob;

  const headR = 16 * scale;
  const headCY = y - H + headR;
  const shoulderY = y - H + headR * 2 + 8 * scale;
  const waistY = y - H * 0.38;
  const hipY = y - H * 0.28;
  const kneeY = y - H * 0.14;

  ctx.save();
  ctx.fillStyle = '#D8D0C8';

  // Multi-pass soft shadow silhouette
  ctx.shadowColor = 'rgba(216, 208, 200, 0.45)';
  ctx.shadowBlur = 16;

  ctx.beginPath();
  ctx.arc(cx, headCY, headR, 0, Math.PI * 2);

  ctx.moveTo(cx - W * 0.5, shoulderY);
  ctx.bezierCurveTo(cx - W * 0.55, waistY, cx - W * 0.38, hipY, cx - W * 0.22, kneeY);
  ctx.lineTo(cx - W * 0.12, y);
  ctx.lineTo(cx + W * 0.12, y);
  ctx.lineTo(cx + W * 0.22, kneeY);
  ctx.bezierCurveTo(cx + W * 0.38, hipY, cx + W * 0.55, waistY, cx + W * 0.5, shoulderY);
  ctx.bezierCurveTo(cx + W * 0.3, shoulderY - 10 * scale, cx + W * 0.1, shoulderY - 16 * scale, cx, shoulderY - 18 * scale);
  ctx.bezierCurveTo(cx - W * 0.1, shoulderY - 16 * scale, cx - W * 0.3, shoulderY - 10 * scale, cx - W * 0.5, shoulderY);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawKnVector(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  alpha: number,
  pulse: number = 1.0
) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  ctx.translate(-cx, -cy);

  const grad = ctx.createLinearGradient(cx - size * 0.7, cy, cx + size * 0.7, cy);
  grad.addColorStop(0, '#38BDF8');
  grad.addColorStop(1, '#2563EB');

  ctx.strokeStyle = grad;
  ctx.lineWidth = Math.max(9, size * 0.095);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Stem of k
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.6573, cy - size * 0.5);
  ctx.lineTo(cx - size * 0.6573, cy + size * 0.5);
  ctx.stroke();

  // 2. Upper arm of k
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.5734, cy + size * 0.3811);
  ctx.bezierCurveTo(
    cx - size * 0.5175, cy + size * 0.1538,
    cx - size * 0.3986, cy - size * 0.0385,
    cx - size * 0.2308, cy - size * 0.1713
  );
  ctx.stroke();

  // 3. Ribbon (lower branch flowing into valley, rise, arch, and leg of n)
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.4371, cy + size * 0.1189);
  ctx.bezierCurveTo(
    cx - size * 0.3497, cy + size * 0.2587,
    cx - size * 0.2622, cy + size * 0.4650,
    cx - size * 0.1259, cy + size * 0.4650
  );
  ctx.bezierCurveTo(
    cx - size * 0.0175, cy + size * 0.4650,
    cx + size * 0.0280, cy + size * 0.2762,
    cx + size * 0.0420, cy + size * 0.0315
  );
  ctx.bezierCurveTo(
    cx + size * 0.0490, cy - size * 0.1084,
    cx + size * 0.1748, cy - size * 0.1573,
    cx + size * 0.3322, cy - size * 0.1573
  );
  ctx.bezierCurveTo(
    cx + size * 0.5070, cy - size * 0.1573,
    cx + size * 0.6573, cy - size * 0.0804,
    cx + size * 0.6573, cy + size * 0.1014
  );
  ctx.lineTo(cx + size * 0.6573, cy + size * 0.4930);
  ctx.stroke();

  ctx.restore();
}

export function WelcomeAnimation({ tagline }: WelcomeAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();
    let elapsed = 0;
    let particles: Particle[] = [];

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const initParticleArray = (
      scatterX: number,
      scatterY: number,
      targets: Point[]
    ) => {
      particles = targets.map((t, i) => {
        const fromLeft = i < Math.floor(targets.length / 2);
        const sx = fromLeft ? scatterX - 12 : scatterX + 12;
        return new Particle(sx, scatterY, t);
      });
    };

    const render = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      const centerX = W / 2;
      // Position logo high above buttons (33% of height)
      const logoCenterY = H * 0.33;
      const logoSize = Math.min(130, Math.max(96, H * 0.16));
      // Ground level where shadows walk (64% of height, safely above bottom action buttons)
      const groundY = H * 0.64;
      const meetingChestY = groundY - 65;

      const targets = generateKnTargets(centerX, logoCenterY, logoSize);
      if (particles.length !== targets.length) {
        initParticleArray(centerX, meetingChestY, targets);
      }

      // Timing boundaries
      const T = TIMING;
      const pEnter = T.darknessDuration;
      const pSlow = pEnter + T.enterDuration;
      const pConverge = pSlow + T.slowDuration;
      const pScatter = pConverge + T.convergeDuration;
      const pGather = pScatter + T.scatterDuration;
      const pText = pGather + T.gatherDuration;
      const pFade = pText + T.textHoldDuration;

      let shadowAX = -80;
      let shadowBX = W + 80;
      let shadowAlpha = 1.0;
      let knAlpha = 0;
      let pulse = 1.0;
      let bloomIntensity = 0.12;

      // Calculate phases
      if (time < pEnter) {
        // Darkness & Rest
        bloomIntensity = 0.12;
        shadowAlpha = 1.0;
        shadowAX = -80;
        shadowBX = W + 80;
      } else if (time < pSlow) {
        // Shadows Enter
        const prog = (time - pEnter) / T.enterDuration;
        const ease = Math.sin((prog * Math.PI) / 2);
        shadowAX = -80 + (W * 0.35 + 80) * ease;
        shadowBX = (W + 80) - (W + 80 - W * 0.65) * ease;
        bloomIntensity = 0.14 + 0.05 * prog;
      } else if (time < pConverge) {
        // Slow Approach
        shadowAX = W * 0.35;
        shadowBX = W * 0.65;
        bloomIntensity = 0.19;
      } else if (time < pScatter) {
        // Converging to meeting point
        const prog = (time - pConverge) / T.convergeDuration;
        shadowAX = W * 0.35 + (centerX - W * 0.35) * prog;
        shadowBX = W * 0.65 + (centerX - W * 0.65) * prog;
        bloomIntensity = 0.20 + 0.40 * prog;

        // Subtle connection threads
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.22 * prog;
        for (let i = 0; i < 4; i++) {
          const ty = groundY - 60 + (i - 2) * 18;
          ctx.beginPath();
          ctx.moveTo(shadowAX, ty);
          ctx.lineTo(shadowBX, ty);
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
      } else if (time < pGather) {
        // Shatter into particles
        const prog = (time - pScatter) / T.scatterDuration;
        shadowAlpha = Math.max(0, 1 - prog * 2.5);
        bloomIntensity = 0.45 - prog * 0.15;

        // Particles burst outward
        particles.forEach((p) => {
          const scatterDist = prog * 40;
          const px = p.startX + p.vx * scatterDist * 0.35;
          const py = p.startY + p.vy * scatterDist * 0.35;
          ctx.fillStyle = px < centerX ? '#38BDF8' : '#2563EB';
          ctx.globalAlpha = p.alpha * (0.5 + 0.5 * (1 - prog));
          ctx.beginPath();
          ctx.arc(px, py, p.radius, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (time < pText) {
        // Dots gather and rise to assemble kn logo
        const prog = (time - pGather) / T.gatherDuration;
        bloomIntensity = 0.25;

        // Smooth cubic ease with subtle overshoot
        const ease =
          prog < 0.8
            ? (prog / 0.8) * (prog / 0.8) * (3 - 2 * (prog / 0.8))
            : 1 + Math.sin(((prog - 0.8) / 0.2) * Math.PI) * 0.035;

        particles.forEach((p) => {
          const curX = p.startX + (p.targetX - p.startX) * Math.min(1.0, ease);
          const curY = p.startY + (p.targetY - p.startY) * Math.min(1.0, ease);
          ctx.fillStyle = curX < centerX ? '#38BDF8' : '#2563EB';
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(curX, curY, p.radius, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (time < pFade) {
        // Assembled kn logo with glowing stroke & gentle pulse
        bloomIntensity = 0.26;
        const textProg = (time - pText) / T.textHoldDuration;
        knAlpha = Math.min(1.0, textProg * 3.0);

        if (textProg > 0.3 && textProg < 0.7) {
          pulse = 1.0 + Math.sin(((textProg - 0.3) / 0.4) * Math.PI * 2) * 0.05;
        }

        // Draw settled dots merging into logo
        particles.forEach((p) => {
          ctx.fillStyle = p.targetX < centerX ? '#38BDF8' : '#2563EB';
          ctx.globalAlpha = p.alpha * (1 - knAlpha * 0.6);
          ctx.beginPath();
          ctx.arc(p.targetX, p.targetY, p.radius, 0, Math.PI * 2);
          ctx.fill();
        });
      } else {
        // Soft fade out before next loop
        const prog = (time - pFade) / T.fadeOutDuration;
        knAlpha = Math.max(0, 1 - prog);
        bloomIntensity = Math.max(0.08, 0.26 * (1 - prog));
      }

      // Draw Ambient Bloom behind logo
      const bloomGrad = ctx.createRadialGradient(
        centerX,
        logoCenterY,
        15,
        centerX,
        logoCenterY,
        260
      );
      bloomGrad.addColorStop(0, `rgba(37, 99, 235, ${bloomIntensity * 0.6})`);
      bloomGrad.addColorStop(0.5, `rgba(201, 168, 76, ${bloomIntensity * 0.2})`);
      bloomGrad.addColorStop(1, 'rgba(13, 17, 23, 0)');
      ctx.fillStyle = bloomGrad;
      ctx.beginPath();
      ctx.arc(centerX, logoCenterY, 260, 0, Math.PI * 2);
      ctx.fill();

      // Draw Shadows if visible
      if (shadowAlpha > 0.01 && time < pScatter + 300) {
        ctx.save();
        ctx.globalAlpha = shadowAlpha;
        drawShadowFigure(ctx, shadowAX, groundY, Math.sin(time * 0.008) * 3);
        drawShadowFigure(ctx, shadowBX, groundY, -Math.sin(time * 0.008) * 3);
        ctx.restore();
      }

      // Draw Glowing kn Vector Path
      drawKnVector(ctx, centerX, logoCenterY, logoSize, knAlpha, pulse);

      // Draw Wordmark and Tagline when kn is assembled
      if (time >= pGather + T.gatherDuration * 0.75 && time < pFade + T.fadeOutDuration) {
        const textAlpha = Math.min(
          1.0,
          Math.max(0, (time - (pGather + T.gatherDuration * 0.75)) / 600)
        );
        const fadeFactor = time >= pFade ? Math.max(0, 1 - (time - pFade) / T.fadeOutDuration) : 1;

        ctx.save();
        ctx.globalAlpha = textAlpha * fadeFactor;
        ctx.textAlign = 'center';

        // Wordmark "kinn"
        ctx.fillStyle = '#F0EDE6';
        ctx.font = 'bold 30px serif';
        ctx.fillText('kinn', centerX, logoCenterY + logoSize * 0.5 + 34);

        // Translated Tagline
        ctx.font = 'bold 20px serif';
        ctx.fillStyle = '#F0EDE6';
        ctx.fillText(tagline, centerX, logoCenterY + logoSize * 0.5 + 68);

        ctx.restore();
      }

      ctx.restore();
    };

    const loop = (timestamp: number) => {
      const dt = timestamp - lastTime;
      elapsed += dt;
      if (elapsed >= TOTAL_CYCLE) {
        elapsed = 0;
        const rect = canvas.getBoundingClientRect();
        const targets = generateKnTargets(
          rect.width / 2,
          rect.height * 0.33,
          Math.min(130, Math.max(96, rect.height * 0.16))
        );
        initParticleArray(rect.width / 2, rect.height * 0.64 - 65, targets);
      }
      lastTime = timestamp;
      render(elapsed);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [tagline]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}

export default WelcomeAnimation;
