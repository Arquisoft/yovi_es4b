const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const test = require('node:test');

const {
  DEFAULT_EXTERNAL_BOT_ID,
  PUBLIC_BOT_CATALOG,
  STRATEGY_TO_BOT_ID,
  createApp,
  pickPlayBotId,
  applyBotMoveToYen,
} = require('../../gateway-service');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

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

function buildPlayQuery({ position, botId, strategy } = {}) {
  const search = new URLSearchParams();

  if (position !== undefined) {
    search.set('position', JSON.stringify(position));
  }

  if (botId) {
    search.set('bot_id', botId);
  }

  if (strategy) {
    search.set('strategy', strategy);
  }

  return search.toString();
}

function emptyPosition() {
  return {
    size: 3,
    turn: 0,
    players: ['B', 'R'],
    layout: './../...',
  };
}

// ---------------------------------------------------------------------------
// GET /external/v1/health
// ---------------------------------------------------------------------------

test('GET /external/v1/health returns ok status', async () => {
  const { app } = createApp({ proxyFactory: noopProxyFactory });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/external/v1/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: 'ok', api: 'external' });
  });
});

// ---------------------------------------------------------------------------
// GET /external/v1/bots
// ---------------------------------------------------------------------------

test('GET /external/v1/bots returns the public bot catalog', async () => {
  const { app } = createApp({ proxyFactory: noopProxyFactory });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/external/v1/bots`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.default_bot_id, DEFAULT_EXTERNAL_BOT_ID);
    assert.ok(Array.isArray(body.items));
    assert.equal(body.items.length, PUBLIC_BOT_CATALOG.length);
    assert.deepEqual(body.items, PUBLIC_BOT_CATALOG);
  });
});

// ---------------------------------------------------------------------------
// POST /external/v1/users/register
// ---------------------------------------------------------------------------

test('POST /external/v1/users/register forwards registration to auth service', async () => {
  await withJsonServer(async (req, res, body) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/register');
    assert.equal(req.headers['content-type'], 'application/json');
    assert.deepEqual(body, { username: 'newuser', password: 'secret123' });

    jsonResponse(res, 201, {
      user: { id: 'user-new', username: 'newuser' },
      token: 'jwt-token-abc',
    });
  }, async (authUrl) => {
    const { app } = createApp({
      proxyFactory: noopProxyFactory,
      env: { AUTH_SERVICE_URL: authUrl },
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/external/v1/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'newuser', password: 'secret123' }),
      });
      const body = await response.json();

      assert.equal(response.status, 201);
      assert.equal(body.user.username, 'newuser');
      assert.equal(body.token, 'jwt-token-abc');
    });
  });
});

// ---------------------------------------------------------------------------
// POST /external/v1/users/login
// ---------------------------------------------------------------------------

test('POST /external/v1/users/login forwards credentials to auth service', async () => {
  await withJsonServer(async (req, res, body) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/login');
    assert.deepEqual(body, { username: 'ada', password: 'pass' });

    jsonResponse(res, 200, { token: 'jwt-login-token' });
  }, async (authUrl) => {
    const { app } = createApp({
      proxyFactory: noopProxyFactory,
      env: { AUTH_SERVICE_URL: authUrl },
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/external/v1/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ada', password: 'pass' }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.token, 'jwt-login-token');
    });
  });
});

// ---------------------------------------------------------------------------
// GET /external/v1/users/me – 401 without token
// ---------------------------------------------------------------------------

test('GET /external/v1/users/me returns 401 when no authorization header is sent', async () => {
  const { app } = createApp({ proxyFactory: noopProxyFactory });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/external/v1/users/me`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.message, 'Missing token');
  });
});

// ---------------------------------------------------------------------------
// GET /external/v1/users/me/history
// ---------------------------------------------------------------------------

test('GET /external/v1/users/me/history forwards auth and returns match history', async () => {
  const historyPayload = {
    items: [
      { gameId: 'game-1', result: 'win', endedAt: '2026-01-01T00:00:00Z' },
      { gameId: 'game-2', result: 'loss', endedAt: '2026-01-02T00:00:00Z' },
    ],
  };

  await withJsonServer(async (req, res) => {
    if (req.url === '/verify') {
      jsonResponse(res, 200, {
        valid: true,
        user: { id: 'user-hist', username: 'ada' },
      });
      return;
    }

    assert.fail(`Unexpected auth request: ${req.url}`);
  }, async (authUrl) => {
    await withJsonServer(async (req, res) => {
      assert.equal(req.method, 'GET');
      assert.ok(req.url.startsWith('/v1/me/history'));
      assert.equal(req.headers['x-user-id'], 'user-hist');

      jsonResponse(res, 200, historyPayload);
    }, async (statsUrl) => {
      const { app } = createApp({
        proxyFactory: noopProxyFactory,
        env: {
          AUTH_SERVICE_URL: authUrl,
          STATS_SERVICE_URL: statsUrl,
        },
      });

      await withServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/external/v1/users/me/history`, {
          headers: { Authorization: 'Bearer valid-token' },
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(body, historyPayload);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// GET /external/v1/users/me/history – 401 without token
// ---------------------------------------------------------------------------

test('GET /external/v1/users/me/history returns 401 without auth', async () => {
  const { app } = createApp({ proxyFactory: noopProxyFactory });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/external/v1/users/me/history`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.message, 'Missing token');
  });
});

// ---------------------------------------------------------------------------
// GET /external/v1/users/me/history – with limit query param
// ---------------------------------------------------------------------------

test('GET /external/v1/users/me/history forwards limit query parameter', async () => {
  await withJsonServer(async (req, res) => {
    jsonResponse(res, 200, {
      valid: true,
      user: { id: 'user-lim', username: 'bob' },
    });
  }, async (authUrl) => {
    await withJsonServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      assert.equal(url.searchParams.get('limit'), '5');

      jsonResponse(res, 200, { items: [] });
    }, async (statsUrl) => {
      const { app } = createApp({
        proxyFactory: noopProxyFactory,
        env: {
          AUTH_SERVICE_URL: authUrl,
          STATS_SERVICE_URL: statsUrl,
        },
      });

      await withServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/external/v1/users/me/history?limit=5`, {
          headers: { Authorization: 'Bearer valid-token' },
        });

        assert.equal(response.status, 200);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// GET /external/v1/games/:gameId
// ---------------------------------------------------------------------------

test('GET /external/v1/games/:gameId retrieves game state from gamey', async () => {
  const gamePayload = {
    api_version: 'v1',
    game_id: 'game-456',
    mode: 'human_vs_bot',
    yen: emptyPosition(),
    game_over: false,
    next_player: 0,
    winner: null,
  };

  await withJsonServer(async (req, res) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.url, '/v1/games/game-456');

    jsonResponse(res, 200, gamePayload);
  }, async (gameyUrl) => {
    const { app } = createApp({
      proxyFactory: noopProxyFactory,
      env: { GAMEY_SERVICE_URL: gameyUrl },
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/external/v1/games/game-456`);
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.game_id, 'game-456');
    });
  });
});

// ---------------------------------------------------------------------------
// POST /external/v1/games/:gameId/moves
// ---------------------------------------------------------------------------

test('POST /external/v1/games/:gameId/moves forwards move to gamey', async () => {
  await withJsonServer(async (req, res, body) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/v1/games/game-789/moves');
    assert.deepEqual(body, { coords: { x: 2, y: 0, z: 0 } });

    jsonResponse(res, 200, {
      game_id: 'game-789',
      yen: { size: 3, turn: 1, players: ['B', 'R'], layout: 'B/../...' },
      game_over: false,
      next_player: 1,
    });
  }, async (gameyUrl) => {
    const { app } = createApp({
      proxyFactory: noopProxyFactory,
      env: { GAMEY_SERVICE_URL: gameyUrl },
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/external/v1/games/game-789/moves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coords: { x: 2, y: 0, z: 0 } }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.game_id, 'game-789');
    });
  });
});

// ---------------------------------------------------------------------------
// POST /external/v1/games/:gameId/resign
// ---------------------------------------------------------------------------

test('POST /external/v1/games/:gameId/resign forwards resign to gamey', async () => {
  await withJsonServer(async (req, res) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/v1/games/game-res/resign');

    jsonResponse(res, 200, {
      game_id: 'game-res',
      game_over: true,
      winner: 1,
    });
  }, async (gameyUrl) => {
    const { app } = createApp({
      proxyFactory: noopProxyFactory,
      env: { GAMEY_SERVICE_URL: gameyUrl },
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/external/v1/games/game-res/resign`, {
        method: 'POST',
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.game_over, true);
      assert.equal(body.winner, 1);
    });
  });
});

// ---------------------------------------------------------------------------
// POST /external/v1/games/:gameId/pass
// ---------------------------------------------------------------------------

test('POST /external/v1/games/:gameId/pass forwards pass to gamey', async () => {
  await withJsonServer(async (req, res) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/v1/games/game-pass/pass');

    jsonResponse(res, 200, {
      game_id: 'game-pass',
      game_over: false,
      next_player: 1,
    });
  }, async (gameyUrl) => {
    const { app } = createApp({
      proxyFactory: noopProxyFactory,
      env: { GAMEY_SERVICE_URL: gameyUrl },
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/external/v1/games/game-pass/pass`, {
        method: 'POST',
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.game_id, 'game-pass');
    });
  });
});

// ---------------------------------------------------------------------------
// pickPlayBotId – unit tests
// ---------------------------------------------------------------------------

test('pickPlayBotId returns default bot when no bot_id or strategy', () => {
  assert.equal(pickPlayBotId({}), DEFAULT_EXTERNAL_BOT_ID);
  assert.equal(pickPlayBotId(undefined), DEFAULT_EXTERNAL_BOT_ID);
  assert.equal(pickPlayBotId(null), DEFAULT_EXTERNAL_BOT_ID);
  assert.equal(pickPlayBotId({ bot_id: '' }), DEFAULT_EXTERNAL_BOT_ID);
});

test('pickPlayBotId uses explicit bot_id over strategy', () => {
  assert.equal(pickPlayBotId({ bot_id: 'custom_bot', strategy: 'greedy' }), 'custom_bot');
});

test('pickPlayBotId maps known strategies to bot ids', () => {
  for (const [strategy, expectedBotId] of Object.entries(STRATEGY_TO_BOT_ID)) {
    assert.equal(pickPlayBotId({ strategy }), expectedBotId);
  }
});

test('pickPlayBotId passes through unknown strategy as-is', () => {
  assert.equal(pickPlayBotId({ strategy: 'custom_strategy' }), 'custom_strategy');
});

test('pickPlayBotId is case-insensitive for known strategies', () => {
  assert.equal(pickPlayBotId({ strategy: 'GREEDY' }), 'greedy_bot');
  assert.equal(pickPlayBotId({ strategy: 'Minimax' }), 'minimax_bot');
});

// ---------------------------------------------------------------------------
// GET /external/v1/play – with strategy query parameter
// ---------------------------------------------------------------------------

test('GET /external/v1/play resolves strategy to bot_id', async () => {
  await withJsonServer(async (req, res) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/v1/ybot/choose/greedy_bot');

    jsonResponse(res, 200, {
      api_version: 'v1',
      bot_id: 'greedy_bot',
      coords: { x: 1, y: 1, z: 0 },
    });
  }, async (gameyUrl) => {
    const { app } = createApp({
      proxyFactory: noopProxyFactory,
      env: { GAMEY_SERVICE_URL: gameyUrl },
    });

    await withServer(app, async (baseUrl) => {
      const query = buildPlayQuery({ position: emptyPosition(), strategy: 'greedy' });
      const response = await fetch(`${baseUrl}/external/v1/play?${query}`);
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, { coords: { x: 1, y: 1, z: 0 } });
    });
  });
});

// ---------------------------------------------------------------------------
// Error handling – upstream connection error (502)
// ---------------------------------------------------------------------------

test('gateway returns 502 when upstream gamey is unreachable', async () => {
  const { app } = createApp({
    proxyFactory: noopProxyFactory,
    env: { GAMEY_SERVICE_URL: 'http://127.0.0.1:1' },
  });

  await withServer(app, async (baseUrl) => {
    const query = buildPlayQuery({ position: emptyPosition() });
    const response = await fetch(`${baseUrl}/external/v1/play?${query}`);
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.match(body.message, /Bad Gateway/);
  });
});

test('gateway returns 502 when auth service is unreachable', async () => {
  const { app } = createApp({
    proxyFactory: noopProxyFactory,
    env: { AUTH_SERVICE_URL: 'http://127.0.0.1:1' },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/external/v1/users/me`, {
      headers: { Authorization: 'Bearer some-token' },
    });
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.match(body.message, /Bad Gateway/);
  });
});

// ---------------------------------------------------------------------------
// Error handling – upstream returns error status
// ---------------------------------------------------------------------------

test('gateway forwards upstream 4xx errors from gamey', async () => {
  await withJsonServer(async (_req, res) => {
    jsonResponse(res, 404, { message: 'Game not found' });
  }, async (gameyUrl) => {
    const { app } = createApp({
      proxyFactory: noopProxyFactory,
      env: { GAMEY_SERVICE_URL: gameyUrl },
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/external/v1/games/nonexistent`);
      const body = await response.json();

      assert.equal(response.status, 404);
      assert.equal(body.message, 'Game not found');
    });
  });
});

test('gateway forwards 409 occupied-cell errors from gamey with explanatory message', async () => {
  await withJsonServer(async (_req, res) => {
    jsonResponse(res, 409, {
      message: 'Could not apply move: Player 1 tries to place a stone on an occupied position: 2 0 0',
    });
  }, async (gameyUrl) => {
    const { app } = createApp({
      proxyFactory: noopProxyFactory,
      env: { GAMEY_SERVICE_URL: gameyUrl },
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/external/v1/games/game-occupied/moves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coords: { x: 2, y: 0, z: 0 } }),
      });
      const body = await response.json();

      assert.equal(response.status, 409);
      assert.match(body.message, /could not apply move/i);
      assert.match(body.message, /occupied/i);
    });
  });
});

test('gateway forwards upstream 500 errors from gamey', async () => {
  await withJsonServer(async (_req, res) => {
    jsonResponse(res, 500, { message: 'Internal server error' });
  }, async (gameyUrl) => {
    const { app } = createApp({
      proxyFactory: noopProxyFactory,
      env: { GAMEY_SERVICE_URL: gameyUrl },
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/external/v1/games/broken`);
      const body = await response.json();

      assert.equal(response.status, 500);
      assert.equal(body.message, 'Internal server error');
    });
  });
});

test('gateway returns 401 on invalid auth token', async () => {
  await withJsonServer(async (req, res) => {
    assert.equal(req.url, '/verify');
    jsonResponse(res, 401, { message: 'Invalid token' });
  }, async (authUrl) => {
    const { app } = createApp({
      proxyFactory: noopProxyFactory,
      env: { AUTH_SERVICE_URL: authUrl },
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/external/v1/users/me`, {
        headers: { Authorization: 'Bearer bad-token' },
      });
      const body = await response.json();

      assert.equal(response.status, 401);
      assert.equal(body.message, 'Invalid token');
    });
  });
});

// ---------------------------------------------------------------------------
// Position validation edge cases
// ---------------------------------------------------------------------------

test('GET /external/v1/play returns 400 for non-object position', async () => {
  const { app } = createApp({ proxyFactory: noopProxyFactory });

  await withServer(app, async (baseUrl) => {
    const query = new URLSearchParams({ position: '"just a string"' });
    const response = await fetch(`${baseUrl}/external/v1/play?${query}`);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.message, /position must be/i);
  });
});

test('GET /external/v1/play returns 400 for position with invalid size', async () => {
  const { app } = createApp({ proxyFactory: noopProxyFactory });

  await withServer(app, async (baseUrl) => {
    const badPosition = { size: -1, turn: 0, players: ['B', 'R'], layout: '.' };
    const query = new URLSearchParams({ position: JSON.stringify(badPosition) });
    const response = await fetch(`${baseUrl}/external/v1/play?${query}`);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.message, /size/i);
  });
});

test('GET /external/v1/play returns 400 for position with invalid turn', async () => {
  const { app } = createApp({ proxyFactory: noopProxyFactory });

  await withServer(app, async (baseUrl) => {
    const badPosition = { size: 3, turn: 5, players: ['B', 'R'], layout: './../...' };
    const query = new URLSearchParams({ position: JSON.stringify(badPosition) });
    const response = await fetch(`${baseUrl}/external/v1/play?${query}`);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.message, /turn/i);
  });
});

test('GET /external/v1/play returns 400 for position with invalid players', async () => {
  const { app } = createApp({ proxyFactory: noopProxyFactory });

  await withServer(app, async (baseUrl) => {
    const badPosition = { size: 3, turn: 0, players: ['X', 'Y'], layout: './../...' };
    const query = new URLSearchParams({ position: JSON.stringify(badPosition) });
    const response = await fetch(`${baseUrl}/external/v1/play?${query}`);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.message, /players/i);
  });
});

test('GET /external/v1/play returns 400 for position with unsupported cell', async () => {
  const { app } = createApp({ proxyFactory: noopProxyFactory });

  await withServer(app, async (baseUrl) => {
    const badPosition = { size: 3, turn: 0, players: ['B', 'R'], layout: 'X/../...' };
    const query = new URLSearchParams({ position: JSON.stringify(badPosition) });
    const response = await fetch(`${baseUrl}/external/v1/play?${query}`);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.message, /unsupported cell/i);
  });
});

test('GET /external/v1/play returns 400 for position with wrong layout row count', async () => {
  const { app } = createApp({ proxyFactory: noopProxyFactory });

  await withServer(app, async (baseUrl) => {
    const badPosition = { size: 3, turn: 0, players: ['B', 'R'], layout: './..' };
    const query = new URLSearchParams({ position: JSON.stringify(badPosition) });
    const response = await fetch(`${baseUrl}/external/v1/play?${query}`);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.message, /rows/i);
  });
});

// ---------------------------------------------------------------------------
// applyBotMoveToYen – additional edge cases
// ---------------------------------------------------------------------------

test('applyBotMoveToYen rejects move on occupied cell', () => {
  assert.throws(() => {
    applyBotMoveToYen(
      { size: 3, turn: 1, players: ['B', 'R'], layout: 'B/../...' },
      { x: 2, y: 0, z: 0 },
    );
  }, /occupied/i);
});

test('applyBotMoveToYen rejects coordinates outside the board', () => {
  assert.throws(() => {
    applyBotMoveToYen(
      { size: 3, turn: 0, players: ['B', 'R'], layout: './../...' },
      { x: 5, y: 0, z: 0 },
    );
  }, /outside the board/i);
});

test('applyBotMoveToYen rejects non-integer coordinates', () => {
  assert.throws(() => {
    applyBotMoveToYen(
      { size: 3, turn: 0, players: ['B', 'R'], layout: './../...' },
      { x: 1.5, y: 0, z: 0 },
    );
  }, /non-negative integers/i);
});

// ---------------------------------------------------------------------------
// Content-Type verification for gamey requests
// ---------------------------------------------------------------------------

test('gateway sends Content-Type: application/json when forwarding to gamey play endpoint', async () => {
  await withJsonServer(async (req, res) => {
    assert.equal(req.headers['content-type'], 'application/json');

    jsonResponse(res, 200, {
      api_version: 'v1',
      bot_id: DEFAULT_EXTERNAL_BOT_ID,
      coords: { x: 2, y: 0, z: 0 },
    });
  }, async (gameyUrl) => {
    const { app } = createApp({
      proxyFactory: noopProxyFactory,
      env: { GAMEY_SERVICE_URL: gameyUrl },
    });

    await withServer(app, async (baseUrl) => {
      const query = buildPlayQuery({ position: emptyPosition() });
      const response = await fetch(`${baseUrl}/external/v1/play?${query}`);

      assert.equal(response.status, 200);
    });
  });
});

// ---------------------------------------------------------------------------
// POST /external/v1/games – without auth (anonymous)
// ---------------------------------------------------------------------------

test('POST /external/v1/games works without auth token for anonymous play', async () => {
  await withJsonServer(async (req, res, body) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/v1/games');
    assert.equal(req.headers['x-user-id'], undefined);
    assert.deepEqual(body, { size: 5, mode: 'human_vs_bot', bot_id: 'random_bot' });

    jsonResponse(res, 200, {
      game_id: 'anon-game',
      mode: 'human_vs_bot',
      bot_id: 'random_bot',
    });
  }, async (gameyUrl) => {
    const { app } = createApp({
      proxyFactory: noopProxyFactory,
      env: { GAMEY_SERVICE_URL: gameyUrl },
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/external/v1/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: 5, mode: 'human_vs_bot', bot_id: 'random_bot' }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.game_id, 'anon-game');
    });
  });
});
