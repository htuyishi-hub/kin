import { Skia, type SkPath } from '@shopify/react-native-skia';

export function buildShadowPath(cx: number, cy: number, scale: number = 1.0): SkPath {
  const path = Skia.Path.Make();
  const W = 60 * scale;
  const H = 160 * scale;

  const headR = 18 * scale;
  const headCY = cy - H + headR;
  path.addCircle(cx, headCY, headR);

  const shoulderY = cy - H + headR * 2 + 8 * scale;
  const waistY    = cy - H * 0.38;
  const hipY      = cy - H * 0.28;
  const kneeY     = cy - H * 0.14;

  path.moveTo(cx - W * 0.5, shoulderY);
  path.cubicTo(
    cx - W * 0.55, waistY,
    cx - W * 0.38, hipY,
    cx - W * 0.22, kneeY
  );
  path.lineTo(cx - W * 0.12, cy);
  path.lineTo(cx + W * 0.12, cy);
  path.lineTo(cx + W * 0.22, kneeY);
  path.cubicTo(
    cx + W * 0.38, hipY,
    cx + W * 0.55, waistY,
    cx + W * 0.5, shoulderY
  );
  path.cubicTo(
    cx + W * 0.3, shoulderY - 10 * scale,
    cx + W * 0.1, shoulderY - 16 * scale,
    cx,           shoulderY - 18 * scale
  );
  path.cubicTo(
    cx - W * 0.1, shoulderY - 16 * scale,
    cx - W * 0.3, shoulderY - 10 * scale,
    cx - W * 0.5, shoulderY
  );
  path.close();

  return path;
}
