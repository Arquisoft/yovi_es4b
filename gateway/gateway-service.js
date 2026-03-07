const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const port = Number(process.env.PORT ?? 8080);

const proxyRoutes = [
  {
    mountPath: '/api',
    target: process.env.GAMEY_SERVICE_URL ?? 'http://gamey:4000',
    stripPrefix: '/api',
  },
  {
    mountPath: '/users',
    target: process.env.USERS_SERVICE_URL ?? 'http://users:3000',
    stripPrefix: '/users',
  },
  {
    mountPath: '/',
    target: process.env.WEBAPP_SERVICE_URL ?? 'http://webapp:80',
  },
];

function buildProxy({ target, stripPrefix }) {
  return createProxyMiddleware({
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

const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

for (const route of proxyRoutes) {
  app.use(route.mountPath, buildProxy(route));
}

app.listen(port, () => {
  console.log(`Gateway listening at http://localhost:${port}`);
});
