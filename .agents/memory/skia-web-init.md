---
name: Skia web initialization
description: How to correctly initialize @shopify/react-native-skia on Expo web (CanvasKit WASM).
---

## Rule
Never import Skia components at the top level of a screen on web. Always lazy-load them AFTER CanvasKit WASM is ready.

## Why
The JsiSKApi web implementation captures `global.CanvasKit` at **module evaluation time**. If `@shopify/react-native-skia` is bundled into the main chunk and evaluates before the WASM loads, every Skia API call (`Skia.Path()`, `Skia.PictureRecorder()`, etc.) throws `Cannot read properties of undefined`.

## How to apply
1. Create platform-specific loaders:
   - `utils/loadSkia.native.ts` — no-op async function
   - `utils/loadSkia.web.ts` — calls `LoadSkiaWeb({ locateFile: (f) => \`https://unpkg.com/canvaskit-wasm@VERSION/bin/full/\${f}\` })`
   - The `locateFile` option is required because Metro can't serve the `.wasm` binary; the CDN WASM must match the installed `canvaskit-wasm` version (check pnpm-lock.yaml).

2. Use `React.lazy()` to split Skia components into their own bundle chunk:
   ```ts
   const ShadowCanvas = lazy(async () => {
     await ensureSkiaReady();
     return import('@/components/ShadowCanvas');
   });
   ```
   This ensures the Skia module is only **evaluated** after `global.CanvasKit` is set.

3. Wrap the lazy component in `<Suspense fallback={null}>`.

4. The Skia component needs `export default` for `lazy()` to work (add alongside named export).

## Versions this was confirmed with
- @shopify/react-native-skia 2.2.12
- canvaskit-wasm 0.40.0
- Expo SDK 54 / Metro web bundler
- `LoadSkiaWeb` import path: `@shopify/react-native-skia/lib/module/web/LoadSkiaWeb`
