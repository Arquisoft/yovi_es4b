const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');

const { buildProxy, createApp } = require('./gateway-service');

function noopProxyFactory() {
  return (_req, _res, next) => next();
}

async function withServer(app, run) {
  const server = app.listen(0);
  await once(server, 'listening');

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// GET /health returns service status.
test('GET /health returns service status', async () => {
  const { app } = createApp({ proxyFactory: noopProxyFactory });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: 'ok' });
  });
});

// createApp sets expected proxy configuration for each route.
test('createApp sets expected proxy configuration for each route', () => {
  const capturedConfigs = [];
  const proxyFactory = (config) => {
    capturedConfigs.push(config);
    return (_req, _res, next) => next();
  };

  const env = {
    GAMEY_SERVICE_URL: 'http://gamey.local:4000',
    AUTH_SERVICE_URL: 'http://auth.local:3500',
    USERS_SERVICE_URL: 'http://users.local:3000',
    STATS_SERVICE_URL: 'http://stats.local:3001',
    WEBAPP_SERVICE_URL: 'http://web.local:80',
  };

  createApp({ env, proxyFactory });

  assert.equal(capturedConfigs.length, 5);

  const gameyProxy = capturedConfigs.find((config) => config.target === env.GAMEY_SERVICE_URL);
  const authProxy = capturedConfigs.find((config) => config.target === env.AUTH_SERVICE_URL);
  const usersProxy = capturedConfigs.find((config) => config.target === env.USERS_SERVICE_URL);
  const statsProxy = capturedConfigs.find((config) => config.target === env.STATS_SERVICE_URL);
  const webappProxy = capturedConfigs.find((config) => config.target === env.WEBAPP_SERVICE_URL);

  assert.deepEqual(gameyProxy.pathRewrite, { '^/api': '' });
  assert.deepEqual(authProxy.pathRewrite, { '^/auth': '' });
  assert.deepEqual(usersProxy.pathRewrite, { '^/users': '' });
  assert.deepEqual(statsProxy.pathRewrite, { '^/stats': '' });
  assert.equal(webappProxy.pathRewrite, undefined);
});

// buildProxy returns a 502 response when upstream fails.
test('buildProxy returns a 502 response when upstream fails', () => {
  let capturedConfig;

  buildProxy(
    { target: 'http://example.local', stripPrefix: '/api' },
    (config) => {
      capturedConfig = config;
      return () => {};
    },
  );

  const response = {
    headersSent: false,
    statusCode: null,
    headers: null,
    body: null,
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    end(payload) {
      this.body = payload;
    },
  };

  capturedConfig.on.error(new Error('upstream failure'), {}, response);

  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.headers, { 'Content-Type': 'application/json' });
  assert.equal(response.body, JSON.stringify({ message: 'Bad Gateway' }));
});
