import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web/LoadSkiaWeb';

export async function ensureSkiaReady(): Promise<void> {
  await LoadSkiaWeb({
    locateFile: (file: string) =>
      `https://unpkg.com/canvaskit-wasm@0.40.0/bin/full/${file}`,
  });
}
