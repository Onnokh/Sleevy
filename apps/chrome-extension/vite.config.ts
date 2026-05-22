import { defineConfig } from "vite";
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  return {
    base: "",
    root: "src",
    define: {
      __SLEEVY_API_URL__: JSON.stringify(isDev ? "http://localhost:4001" : "https://api.sleevy.app"),
      __SLEEVY_WEB_URL__: JSON.stringify(isDev ? "http://localhost:4000" : "https://sleevy.app"),
    },
    build: {
      outDir: join(__dirname, "dist"),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          background: join(__dirname, "src/background.ts"),
          options: join(__dirname, "src/options.html"),
        },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "chunks/[name].js",
          assetFileNames: "assets/[name].[ext]",
          manualChunks: undefined,
        },
      },
    },
    plugins: [
      {
        name: "copy-manifest-and-icons",
        closeBundle() {
          const distDir = join(__dirname, "dist");
          if (!existsSync(join(distDir, "icons"))) {
            mkdirSync(join(distDir, "icons"), { recursive: true });
          }
          const manifestSource = readFileSync(
            join(__dirname, "public/manifest.json"),
            "utf8",
          );
          const manifest = JSON.parse(manifestSource) as {
            host_permissions?: string[];
          };
          if (isDev) {
            manifest.host_permissions = [
              ...(manifest.host_permissions ?? []),
              "http://localhost/*",
            ];
          }
          writeFileSync(
            join(distDir, "manifest.json"),
            JSON.stringify(manifest, null, 2),
          );
          for (const size of [16, 32, 48, 128]) {
            copyFileSync(
              join(__dirname, `public/icons/icon-${size}.png`),
              join(distDir, `icons/icon-${size}.png`),
            );
          }
          copyFileSync(
            join(__dirname, "public/icons/chrome.png"),
            join(distDir, "icons/chrome.png"),
          );
        },
      },
    ],
  };
});
