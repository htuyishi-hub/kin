import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Build security check: fail if SUPABASE_SERVICE_ROLE_KEY appears in client code
function assertNoServiceRoleKeyLeak(directories: string[]) {
  const secret = "SUPABASE_SERVICE_ROLE_KEY";
  for (const dir of directories) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = path.join(entry.parentPath || (entry as any).path || dir, entry.name);
        if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx") || fullPath.endsWith(".js") || fullPath.endsWith(".json")) {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes(secret)) {
            throw new Error(`[SECURITY GATE] Forbidden token "${secret}" found in client file: ${fullPath}`);
          }
        }
      }
    }
  }
}

assertNoServiceRoleKeyLeak([
  path.resolve(import.meta.dirname, "src"),
  path.resolve(import.meta.dirname, "..", "kin", "app"),
  path.resolve(import.meta.dirname, "..", "kin", "components"),
  path.resolve(import.meta.dirname, "..", "kin", "services"),
  path.resolve(import.meta.dirname, "..", "kin", "lib"),
]);

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 4173;

if (rawPort && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
