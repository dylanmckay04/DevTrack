import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  test: {
  globals: true,
  environment: "jsdom",
  setupFiles: "./src/tests/setup.js",
  coverage: {
    provider: "v8",
    reporter: ["text", "lcov"],
  },
}
})
