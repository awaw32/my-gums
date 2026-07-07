import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
    minify: "esbuild",
    sourcemap: false,
    assetsInlineLimit: 4096,
    rollupOptions: {
      input: "index.html",
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
});
