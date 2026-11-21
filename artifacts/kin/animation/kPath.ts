import { Skia, type SkPath } from '@shopify/react-native-skia';
import type { Particle } from './particleSystem';

export type KTarget = { x: number; y: number };

export interface KPathData {
  path: SkPath;
  targets: KTarget[];
}

interface Point {
  x: number;
  y: number;
}

function sampleCubicBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  count: number
): KTarget[] {
  const pts: KTarget[] = [];
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

function sampleLine(
  p0: Point,
  p1: Point,
  count: number
): KTarget[] {
  const pts: KTarget[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    pts.push({
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t,
    });
  }
  return pts;
}

export function buildKPath(cx: number, cy: number, size: number): KPathData {
  // Normalized coordinates centered at (0, 0) for logo height = size:
  // Stem: line from (-0.6573, -0.5) to (-0.6573, 0.5)
  const stem = {
    p0: { x: cx - size * 0.6573, y: cy - size * 0.5 },
    p1: { x: cx - size * 0.6573, y: cy + size * 0.5 },
  };

  // Upper arm of k: cubic bezier from bottom loop to arm tip
  const arm = {
    p0: { x: cx - size * 0.5734, y: cy + size * 0.3811 },
    p1: { x: cx - size * 0.5175, y: cy + size * 0.1538 },
    p2: { x: cx - size * 0.3986, y: cy - size * 0.0385 },
    p3: { x: cx - size * 0.2308, y: cy - size * 0.1713 },
  };

  // Lower branch of k: from diagonal junction down to valley
  const branch = {
    p0: { x: cx - size * 0.4371, y: cy + size * 0.1189 },
    p1: { x: cx - size * 0.3497, y: cy + size * 0.2587 },
    p2: { x: cx - size * 0.2622, y: cy + size * 0.4650 },
    p3: { x: cx - size * 0.1259, y: cy + size * 0.4650 },
  };

  // Valley rise 1: sweep out of valley bottom and up
  const rise1 = {
    p0: { x: cx - size * 0.1259, y: cy + size * 0.4650 },
    p1: { x: cx - size * 0.0175, y: cy + size * 0.4650 },
    p2: { x: cx + size * 0.0280, y: cy + size * 0.2762 },
    p3: { x: cx + size * 0.0420, y: cy + size * 0.0315 },
  };

  // Valley rise 2: up to arch of n
  const rise2 = {
    p0: { x: cx + size * 0.0420, y: cy + size * 0.0315 },
    p1: { x: cx + size * 0.0490, y: cy - size * 0.1084 },
    p2: { x: cx + size * 0.1748, y: cy - size * 0.1573 },
    p3: { x: cx + size * 0.3322, y: cy - size * 0.1573 },
  };

  // Arch of n: over the peak
  const arch = {
    p0: { x: cx + size * 0.3322, y: cy - size * 0.1573 },
    p1: { x: cx + size * 0.5070, y: cy - size * 0.1573 },
    p2: { x: cx + size * 0.6573, y: cy - size * 0.0804 },
    p3: { x: cx + size * 0.6573, y: cy + size * 0.1014 },
  };

  // Right leg of n: straight down
  const leg = {
    p0: { x: cx + size * 0.6573, y: cy + size * 0.1014 },
    p1: { x: cx + size * 0.6573, y: cy + size * 0.4930 },
  };

  const path = Skia.Path.Make();

  // 1. Stem
  path.moveTo(stem.p0.x, stem.p0.y);
  path.lineTo(stem.p1.x, stem.p1.y);

  // 2. Upper arm of k
  path.moveTo(arm.p0.x, arm.p0.y);
  path.cubicTo(arm.p1.x, arm.p1.y, arm.p2.x, arm.p2.y, arm.p3.x, arm.p3.y);

  // 3. Ribbon (branch -> valley -> rise -> arch -> right leg)
  path.moveTo(branch.p0.x, branch.p0.y);
  path.cubicTo(branch.p1.x, branch.p1.y, branch.p2.x, branch.p2.y, branch.p3.x, branch.p3.y);
  path.cubicTo(rise1.p1.x, rise1.p1.y, rise1.p2.x, rise1.p2.y, rise1.p3.x, rise1.p3.y);
  path.cubicTo(rise2.p1.x, rise2.p1.y, rise2.p2.x, rise2.p2.y, rise2.p3.x, rise2.p3.y);
  path.cubicTo(arch.p1.x, arch.p1.y, arch.p2.x, arch.p2.y, arch.p3.x, arch.p3.y);
  path.lineTo(leg.p1.x, leg.p1.y);

  // Sample 92 targets matching WELCOME_CONFIG.particles.count
  const targets: KTarget[] = [
    ...sampleLine(stem.p0, stem.p1, 24),
    ...sampleCubicBezier(arm.p0, arm.p1, arm.p2, arm.p3, 18),
    ...sampleCubicBezier(branch.p0, branch.p1, branch.p2, branch.p3, 14),
    ...sampleCubicBezier(rise1.p0, rise1.p1, rise1.p2, rise1.p3, 10),
    ...sampleCubicBezier(rise2.p0, rise2.p1, rise2.p2, rise2.p3, 8),
    ...sampleCubicBezier(arch.p0, arch.p1, arch.p2, arch.p3, 10),
    ...sampleLine(leg.p0, leg.p1, 8),
  ];

  return { path, targets };
}

export const buildKnPath = buildKPath;

export function assignParticlesToTargets(
  particles: Particle[],
  targets: KTarget[]
): void {
  const available = [...targets];
  for (const p of particles) {
    if (available.length === 0) break;
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < available.length; i++) {
      const dx   = available[i].x - p.x;
      const dy   = available[i].y - p.y;
      const dist = dx * dx + dy * dy;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx  = i;
      }
    }
    p.targetX = available[nearestIdx].x;
    p.targetY = available[nearestIdx].y;
    p.phase   = 'gather';
    available.splice(nearestIdx, 1);
  }
}
