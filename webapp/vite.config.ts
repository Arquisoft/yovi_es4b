import { defineConfig } from 'vitest/config'

function proxyRule(target: string, prefix: string) {
  return {
    target,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(new RegExp(`^${prefix}`), ''),
  }
}

export default defineConfig({
  server: {
    proxy: {
      '/api': proxyRule('http://localhost:4000', '/api'),
      '/users': proxyRule('http://localhost:3000', '/users'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
})
