import { configDefaults, defineConfig } from 'vitest/config'

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
      '/auth': proxyRule('http://localhost:3500', '/auth'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'node-tests/**', '.node-coverage-build/**'],
    coverage: {
      reporter: ['text', ['lcov', { projectRoot: '..' }]],
    },
  },
})
