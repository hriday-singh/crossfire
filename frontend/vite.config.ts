import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react-reconciler/constants": path.resolve(__dirname, "./node_modules/react-reconciler/constants.js"),
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      "/cases": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/ingest": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/providers": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/ready": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
    proxy: {
      "/cases": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/ingest": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/providers": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/ready": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/tests/setup.ts",
    testTimeout: 15000,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    server: {
      deps: {
        inline: ["@pixi/react"],
      },
    },
  },
});
