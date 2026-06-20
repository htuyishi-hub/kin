import { Skia, type SkPath } from '@shopify/react-native-skia';
import type { Particle } from './particleSystem';

export type KTarget = { x: number; y: number };

export interface KPathData {
  path: SkPath;
  targets: KTarget[];
}

export function buildKPath(cx: number, cy: number, size: number): KPathData {
  const halfH = size * 0.5;

  const verticalBar = {
    x1: cx - size * 0.22, y1: cy - halfH,
    x2: cx - size * 0.22, y2: cy + halfH,
  };
  const upperDiag = {
    x1: cx - size * 0.22, y1: cy,
    x2: cx + size * 0.28, y2: cy - halfH,
  };
  const lowerDiag = {
    x1: cx - size * 0.22, y1: cy,
    x2: cx + size * 0.28, y2: cy + halfH,
  };

  const path = Skia.Path.Make();
  path.moveTo(verticalBar.x1, verticalBar.y1);
  path.lineTo(verticalBar.x2, verticalBar.y2);
  path.moveTo(upperDiag.x1, upperDiag.y1);
  path.lineTo(upperDiag.x2, upperDiag.y2);
  path.moveTo(lowerDiag.x1, lowerDiag.y1);
  path.lineTo(lowerDiag.x2, lowerDiag.y2);

  const targets: KTarget[] = [
    ...sampleLine(verticalBar, 35),
    ...sampleLine(upperDiag,   22),
    ...sampleLine(lowerDiag,   23),
  ];

  return { path, targets };
}

function sampleLine(
  line: { x1: number; y1: number; x2: number; y2: number },
  count: number
): KTarget[] {
  const pts: KTarget[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    pts.push({
      x: line.x1 + (line.x2 - line.x1) * t,
      y: line.y1 + (line.y2 - line.y1) * t,
    });
  }
  return pts;
}

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
