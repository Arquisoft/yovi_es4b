const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');

const {
  DEFAULT_EXTERNAL_BOT_ID,
  applyBotMoveToYen,
  buildHttpsOrigin,
  createApp,
  createRedirectApp,
  getRedirectHostname,
  getTlsConfig,
  loadTlsOptions,
  normalizeRedirectPath,
  parseBoolean,
  start,
} = require('./gateway-service');

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
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function withJsonServer(handler, run) {
  const server = http.createServer(async (req, res) => {
    let rawBody = '';

    for await (const chunk of req) {
      rawBody += chunk;
    }

    const parsedBody = rawBody.length > 0 ? JSON.parse(rawBody) : null;
    await handler(req, res, parsedBody);
  });

  server.listen(0);
  await once(server, 'listening');

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await run(baseUrl);
  } finally {
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

function jsonResponse(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function withPatchedMethod(object, methodName, replacement, run) {
  const originalMethod = object[methodName];
  object[methodName] = replacement;

  const restore = () => {
    object[methodName] = originalMethod;
  };

  try {
    const result = run();
    if (result && typeof result.then === 'function') {
      return result.finally(restore);
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
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

// GET /metrics exposes Prometheus metrics after traffic is observed.
test('GET /metrics exposes Prometheus metrics for gateway requests', async () => {
  const { app } = createApp({ proxyFactory: noopProxyFactory });

  await withServer(app, async (baseUrl) => {
    await fetch(`${baseUrl}/health`);

    const response = await fetch(`${baseUrl}/metrics`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /# TYPE yovi_http_requests_total counter/);
    assert.match(body, /yovi_http_requests_total\{service="gateway",method="GET",route="\/health",status="200"\} 1/);
    assert.match(body, /yovi_process_uptime_seconds\{service="gateway"\}/);
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
    STATS_SERVICE_URL: 'http://stats.local:3001',
    WEBAPP_SERVICE_URL: 'http://web.local:80',
  };

  createApp({ env, proxyFactory });

  assert.equal(capturedConfigs.length, 4);

  const gameyProxy = capturedConfigs.find((config) => config.target === env.GAMEY_SERVICE_URL);
  const authProxy = capturedConfigs.find((config) => config.target === env.AUTH_SERVICE_URL);
  const statsProxy = capturedConfigs.find((config) => config.target === env.STATS_SERVICE_URL);
  const webappProxy = capturedConfigs.find((config) => config.target === env.WEBAPP_SERVICE_URL);

  assert.deepEqual(gameyProxy.pathRewrite, { '^/api': '' });
  assert.deepEqual(authProxy.pathRewrite, { '^/auth': '' });
  assert.deepEqual(statsProxy.pathRewrite, { '^/stats': '' });
  assert.equal(webappProxy.pathRewrite, undefined);
});

// buildProxy returns a 502 response when upstream fails.
test('buildProxy returns a 502 response when upstream fails', () => {
  let capturedConfig;

  const { buildProxy } = require('./gateway-service');

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

// TLS config remains disabled until both certificate paths are configured.
test('getTlsConfig requires both certificate and key paths', () => {
  assert.equal(getTlsConfig({}), null);
  assert.equal(getTlsConfig({ HTTPS_CERT_PATH: '', HTTPS_KEY_PATH: '' }), null);
  assert.throws(
    () => getTlsConfig({ HTTPS_CERT_PATH: '/tmp/server.crt' }),
    /must be set together/,
  );
  assert.deepEqual(
    getTlsConfig({
      HTTPS_CERT_PATH: '/tmp/server.crt',
      HTTPS_KEY_PATH: '/tmp/server.key',
    }),
    {
      certPath: '/tmp/server.crt',
      keyPath: '/tmp/server.key',
    },
  );
});

// TLS certificate contents are loaded from disk when HTTPS is configured.
test('loadTlsOptions reads certificate files from disk', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-tls-'));
  const certPath = path.join(tempDir, 'server.crt');
  const keyPath = path.join(tempDir, 'server.key');

  fs.writeFileSync(certPath, 'certificate-data');
  fs.writeFileSync(keyPath, 'key-data');

  assert.deepEqual(
    loadTlsOptions({
      HTTPS_CERT_PATH: certPath,
      HTTPS_KEY_PATH: keyPath,
    }),
    {
      cert: Buffer.from('certificate-data'),
      key: Buffer.from('key-data'),
    },
  );
  assert.equal(loadTlsOptions({}), null);
});

// Boolean env parsing accepts common truthy values.
test('parseBoolean understands common truthy and falsy values', () => {
  assert.equal(parseBoolean(undefined), false);
  assert.equal(parseBoolean('false'), false);
  assert.equal(parseBoolean('TRUE'), true);
  assert.equal(parseBoolean('yes'), true);
});

// HTTP redirects preserve path and query string while targeting HTTPS.
test('createRedirectApp redirects requests to the configured HTTPS port', async () => {
  const redirectApp = createRedirectApp({
    httpsPort: 8443,
    redirectHostname: 'gateway.example.com',
  });

  await withServer(redirectApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/auth/login?next=dashboard`, {
      redirect: 'manual',
      headers: {
        Host: 'malicious.example.net',
      },
    });

    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), 'https://gateway.example.com:8443/auth/login?next=dashboard');
  });
});

// Redirect hostnames come from trusted server configuration only.
test('getRedirectHostname falls back to localhost when unset', () => {
  assert.equal(getRedirectHostname({}), 'localhost');
  assert.equal(getRedirectHostname({ GATEWAY_PUBLIC_HOSTNAME: 'gateway.example.com' }), 'gateway.example.com');
  assert.equal(getRedirectHostname({ GATEWAY_HTTPS_HOST: 'legacy.example.com' }), 'legacy.example.com');
});

// Redirect paths are normalized as relative paths before building Location headers.
test('normalizeRedirectPath preserves path and query string', () => {
  assert.equal(normalizeRedirectPath('/auth/login?next=dashboard'), '/auth/login?next=dashboard');
  assert.equal(normalizeRedirectPath(''), '/');
  assert.equal(normalizeRedirectPath('https://malicious.example/path?q=1'), '/path?q=1');
});

// Standard HTTPS omits the port suffix in redirect targets.
test('buildHttpsOrigin omits port 443 and preserves other ports', () => {
  assert.equal(buildHttpsOrigin('example.com', 443), 'https://example.com');
  assert.equal(buildHttpsOrigin('example.com', 8443), 'https://example.com:8443');
});

// start falls back to plain HTTP when TLS is not configured.
test('start listens over HTTP when TLS is disabled', async () => {
  const { httpServer, httpsServer } = start({
    port: 0,
    env: {
      PORT: '0',
    },
  });

  try {
    await once(httpServer, 'listening');
    assert.ok(httpServer.address().port > 0);
    assert.equal(httpsServer, null);
  } finally {
    await new Promise((resolve) => httpServer.close(resolve));
  }
});

// start creates HTTPS and redirect servers when TLS and redirects are enabled.
test('start listens over HTTPS and starts redirect server when configured', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-start-'));
  const certPath = path.join(tempDir, 'server.crt');
  const keyPath = path.join(tempDir, 'server.key');

  fs.writeFileSync(certPath, 'certificate-data');
  fs.writeFileSync(keyPath, 'key-data');

  const createdHttpServers = [];
  const createdHttpsServers = [];

  const createStubServer = () => ({
    listenCalls: [],
    listen(port, callback) {
      this.listenCalls.push(port);
      callback?.();
    },
  });

  await withPatchedMethod(http, 'createServer', (app) => {
    const server = createStubServer();
    server.app = app;
    createdHttpServers.push(server);
    return server;
  }, async () => withPatchedMethod(https, 'createServer', (tlsOptions, app) => {
    const server = createStubServer();
    server.tlsOptions = tlsOptions;
    server.app = app;
    createdHttpsServers.push(server);
    return server;
  }, async () => {
    const result = start({
      port: 8080,
      env: {
        HTTPS_CERT_PATH: certPath,
        HTTPS_KEY_PATH: keyPath,
        HTTPS_PORT: '8443',
        HTTP_REDIRECT_ENABLED: 'true',
        GATEWAY_PUBLIC_HOSTNAME: 'gateway.example.com',
        GATEWAY_HTTPS_HOST_PORT: '443',
      },
    });

    assert.equal(createdHttpsServers.length, 1);
    assert.equal(createdHttpServers.length, 1);
    assert.deepEqual(createdHttpsServers[0].tlsOptions, {
      cert: Buffer.from('certificate-data'),
      key: Buffer.from('key-data'),
    });
    assert.deepEqual(createdHttpsServers[0].listenCalls, [8443]);
    assert.deepEqual(createdHttpServers[0].listenCalls, [8080]);
    assert.equal(result.httpServer, createdHttpServers[0]);
    assert.equal(result.httpsServer, createdHttpsServers[0]);
  }));
});

// The external OpenAPI document is served by the gateway.
test('GET /external/docs/openapi.json exposes the external API contract', async () => {
  const { app } = createApp({ proxyFactory: noopProxyFactory });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/external/docs/openapi.json`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.info.title, 'Yovi External Bot API');
    assert.ok(body.paths['/external/v1/play']);
  });
});

// The docs route serves a Swagger UI page over the OpenAPI contract.
test('GET /external/docs serves Swagger UI for the external API', async () => {
  const { app } = createApp({ proxyFactory: noopProxyFactory });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/external/docs`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /SwaggerUIBundle/);
    assert.match(body, /OpenAPI JSON/);
  });
});

// GET /external/v1/users/me aggregates auth identity and player stats.
test('GET /external/v1/users/me aggregates auth and stats services', async () => {
  await withJsonServer(async (req, res, body) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.url, '/verify');
    assert.equal(req.headers.authorization, 'Bearer valid-token');
    assert.equal(body, null);

    jsonResponse(res, 200, {
      valid: true,
      user: { id: 'user-123', username: 'ada' },
    });
  }, async (authUrl) => {
    await withJsonServer(async (req, res, body) => {
      assert.equal(req.method, 'GET');
      assert.equal(req.url, '/v1/me');
      assert.equal(req.headers['x-user-id'], 'user-123');
      assert.equal(body, null);

      jsonResponse(res, 200, {
        userId: 'user-123',
        totalGames: 7,
        victories: 5,
        defeats: 2,
        updatedAt: null,
      });
    }, async (statsUrl) => {
      const { app } = createApp({
        proxyFactory: noopProxyFactory,
        env: {
          AUTH_SERVICE_URL: authUrl,
          STATS_SERVICE_URL: statsUrl,
        },
      });

      await withServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/external/v1/users/me`, {
          headers: {
            Authorization: 'Bearer valid-token',
          },
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(body, {
          id: 'user-123',
          username: 'ada',
          stats: {
            userId: 'user-123',
            totalGames: 7,
            victories: 5,
            defeats: 2,
            updatedAt: null,
          },
        });
      });
    });
  });
});

// POST /external/v1/games forwards authenticated player and opponent identifiers.
test('POST /external/v1/games forwards user identity and opponent to gamey', async () => {
  await withJsonServer(async (req, res) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.url, '/verify');

    jsonResponse(res, 200, {
      valid: true,
      user: { id: 'player-0', username: 'ada' },
    });
  }, async (authUrl) => {
    await withJsonServer(async (req, res, body) => {
      assert.equal(req.method, 'POST');
      assert.equal(req.url, '/v1/games');
      assert.equal(req.headers['x-user-id'], 'player-0');
      assert.equal(req.headers['x-opponent-user-id'], 'player-1');
      assert.deepEqual(body, {
        size: 7,
        mode: 'human_vs_human',
      });

      jsonResponse(res, 200, {
        api_version: 'v1',
        game_id: 'game-123',
        mode: 'human_vs_human',
        bot_id: null,
        yen: {
          size: 7,
          turn: 0,
          players: ['B', 'R'],
          layout: './../.../..../...../....../.......',
        },
        game_over: false,
        next_player: 0,
        winner: null,
      });
    }, async (gameyUrl) => {
      const { app } = createApp({
        proxyFactory: noopProxyFactory,
        env: {
          AUTH_SERVICE_URL: authUrl,
          GAMEY_SERVICE_URL: gameyUrl,
        },
      });

      await withServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/external/v1/games`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            size: 7,
            mode: 'human_vs_human',
            opponent_user_id: 'player-1',
          }),
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.game_id, 'game-123');
      });
    });
  });
});

// POST /external/v1/play returns the chosen move and the resulting YEN position.
test('POST /external/v1/play returns resulting YEN move for bots', async () => {
  await withJsonServer(async (req, res, body) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.url, `/v1/ybot/choose/${DEFAULT_EXTERNAL_BOT_ID}`);
    assert.deepEqual(body, {
      size: 3,
      turn: 0,
      players: ['B', 'R'],
      layout: './../...',
    });

    jsonResponse(res, 200, {
      api_version: 'v1',
      bot_id: DEFAULT_EXTERNAL_BOT_ID,
      coords: { x: 2, y: 0, z: 0 },
    });
  }, async (gameyUrl) => {
    const { app } = createApp({
      proxyFactory: noopProxyFactory,
      env: {
        GAMEY_SERVICE_URL: gameyUrl,
      },
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/external/v1/play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          position: {
            size: 3,
            turn: 0,
            players: ['B', 'R'],
            layout: './../...',
          },
        }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        api_version: 'v1',
        bot_id: DEFAULT_EXTERNAL_BOT_ID,
        coords: { x: 2, y: 0, z: 0 },
        move: {
          size: 3,
          turn: 1,
          players: ['B', 'R'],
          layout: 'B/../...',
        },
      });
    });
  });
});

// applyBotMoveToYen updates the right YEN cell and derives the next turn.
test('applyBotMoveToYen updates YEN positions deterministically', () => {
  const nextPosition = applyBotMoveToYen(
    {
      size: 3,
      turn: 1,
      players: ['B', 'R'],
      layout: 'B/R./...',
    },
    { x: 0, y: 2, z: 0 },
  );

  assert.deepEqual(nextPosition, {
    size: 3,
    turn: 1,
    players: ['B', 'R'],
    layout: 'B/R./..B',
  });
});
