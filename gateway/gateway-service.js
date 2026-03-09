const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const DEFAULT_PORT = Number(process.env.PORT ?? 8080);

function getProxyRoutes(env = process.env) {
  return [
    {
      mountPath: '/api',
      target: env.GAMEY_SERVICE_URL ?? 'https://gamey:4000',
      stripPrefix: '/api',
    },
    {
      mountPath: '/auth',
      target: env.AUTH_SERVICE_URL ?? 'https://auth:3500',
      stripPrefix: '/auth',
    },
    {
      mountPath: '/users',
      target: env.USERS_SERVICE_URL ?? 'https://users:3000',
      stripPrefix: '/users',
    },
    {
      mountPath: '/stats',
      target: env.STATS_SERVICE_URL ?? 'https://stats:3001',
      stripPrefix: '/stats',
    },
    {
      mountPath: '/',
      target: env.WEBAPP_SERVICE_URL ?? 'https://webapp:80',
    },
  ];
}

function buildProxy({ target, stripPrefix }, proxyFactory = createProxyMiddleware) {
  return proxyFactory({
    target,
    changeOrigin: true,
    ws: true,
    pathRewrite: stripPrefix ? { [`^${stripPrefix}`]: '' } : undefined,
    on: {
      error: (_err, _req, res) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({ message: 'Bad Gateway' }));
      },
    },
  });
}

function createApp({ env = process.env, proxyFactory = createProxyMiddleware } = {}) {
  const app = express();
  const proxyRoutes = getProxyRoutes(env);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  for (const route of proxyRoutes) {
    app.use(route.mountPath, buildProxy(route, proxyFactory));
  }

  return { app, proxyRoutes };
}

function start({ port = DEFAULT_PORT, env = process.env } = {}) {
  const { app } = createApp({ env });

  return app.listen(port, () => {
    console.log(`Gateway listening at http://localhost:${port}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = {
  buildProxy,
  createApp,
  getProxyRoutes,
  start,
};
