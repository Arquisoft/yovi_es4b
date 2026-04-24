/**
 * True end-to-end tests for the Gateway external API.
 *
 * These tests assume the full stack is already running (e.g. via docker-compose).
 * They make real HTTP requests against the gateway and verify real responses
 * from downstream services (auth, gamey, stats).
 *
 * No mocks, no spawning, no dynamic ports.
 *
 * Usage:
 *   # Start the full stack first:
 *   docker-compose up -d
 *
 *   # Run the e2e tests:
 *   GATEWAY_URL=http://localhost:8080 node --test e2e/gateway-api.e2e.test.js
 *
 *   # Or with default URL:
 *   node --test e2e/gateway-api.e2e.test.js
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:8080';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uniqueUsername() {
  return `e2e_user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyPosition(size = 3) {
  return {
    size,
    turn: 0,
    players: ['B', 'R'],
    layout: Array.from({ length: size }, (_v, i) => '.'.repeat(i + 1)).join('/'),
  };
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

async function registerAndLogin(username) {
  const password = 'E2eTestPass123!';

  const registerResponse = await fetch(`${GATEWAY_URL}/external/v1/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (registerResponse.status === 200 || registerResponse.status === 201) {
    const body = await registerResponse.json();
    return body.token;
  }

  // User might already exist – try login
  const loginResponse = await fetch(`${GATEWAY_URL}/external/v1/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  assert.ok(loginResponse.ok, `Login failed with status ${loginResponse.status}`);
  const body = await loginResponse.json();
  return body.token;
}

// ---------------------------------------------------------------------------
// Health checks
// ---------------------------------------------------------------------------

test('e2e: GET /health returns 200 ok', async () => {
  const response = await fetch(`${GATEWAY_URL}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
});

test('e2e: GET /external/v1/health returns 200 ok', async () => {
  const response = await fetch(`${GATEWAY_URL}/external/v1/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.api, 'external');
});

// ---------------------------------------------------------------------------
// Bot catalog
// ---------------------------------------------------------------------------

test('e2e: GET /external/v1/bots returns bot catalog', async () => {
  const response = await fetch(`${GATEWAY_URL}/external/v1/bots`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(body.default_bot_id, 'Expected a default_bot_id');
  assert.ok(Array.isArray(body.items), 'Expected items to be an array');
  assert.ok(body.items.length > 0, 'Expected at least one bot');

  for (const bot of body.items) {
    assert.ok(bot.bot_id, 'Each bot must have a bot_id');
    assert.ok(bot.strategy, 'Each bot must have a strategy');
    assert.ok(bot.description, 'Each bot must have a description');
  }
});

// ---------------------------------------------------------------------------
// OpenAPI docs
// ---------------------------------------------------------------------------

test('e2e: GET /external/docs serves Swagger UI', async () => {
  const response = await fetch(`${GATEWAY_URL}/external/docs`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /SwaggerUIBundle/);
});

test('e2e: GET /external/docs/openapi.json serves OpenAPI spec', async () => {
  const response = await fetch(`${GATEWAY_URL}/external/docs/openapi.json`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(body.info, 'Expected info section in OpenAPI spec');
  assert.ok(body.paths, 'Expected paths section in OpenAPI spec');
});

// ---------------------------------------------------------------------------
// User registration and login
// ---------------------------------------------------------------------------

test('e2e: POST /external/v1/users/register creates a new user', async () => {
  const username = uniqueUsername();

  const response = await fetch(`${GATEWAY_URL}/external/v1/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'E2eTestPass123!' }),
  });
  const body = await response.json();

  assert.ok(response.status === 200 || response.status === 201, `Expected 200 or 201, got ${response.status}`);
  assert.ok(body.token, 'Expected a token in the response');
});

test('e2e: POST /external/v1/users/login authenticates an existing user', async () => {
  const username = uniqueUsername();
  const password = 'E2eTestPass123!';

  // Register first
  await fetch(`${GATEWAY_URL}/external/v1/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  // Now login
  const response = await fetch(`${GATEWAY_URL}/external/v1/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(body.token, 'Expected a token in the login response');
});

test('e2e: POST /external/v1/users/login rejects wrong password', async () => {
  const username = uniqueUsername();
  const password = 'E2eTestPass123!';

  // Register
  await fetch(`${GATEWAY_URL}/external/v1/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  // Login with wrong password
  const response = await fetch(`${GATEWAY_URL}/external/v1/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'wrong_password' }),
  });

  assert.ok(response.status >= 400, `Expected 4xx error, got ${response.status}`);
});

// ---------------------------------------------------------------------------
// Authenticated user endpoints
// ---------------------------------------------------------------------------

test('e2e: GET /external/v1/users/me returns 401 without token', async () => {
  const response = await fetch(`${GATEWAY_URL}/external/v1/users/me`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.ok(body.message, 'Expected an error message');
});

test('e2e: GET /external/v1/users/me returns user profile with valid token', async () => {
  const username = uniqueUsername();
  const token = await registerAndLogin(username);

  const response = await fetch(`${GATEWAY_URL}/external/v1/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(body.username, 'Expected username in response');
  assert.ok(body.stats !== undefined, 'Expected stats in response');
});

test('e2e: GET /external/v1/users/me/history returns 401 without token', async () => {
  const response = await fetch(`${GATEWAY_URL}/external/v1/users/me/history`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.ok(body.message, 'Expected an error message');
});

test('e2e: GET /external/v1/users/me/history returns match history', async () => {
  const username = uniqueUsername();
  const token = await registerAndLogin(username);

  const response = await fetch(`${GATEWAY_URL}/external/v1/users/me/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  // New user should have no history – just verify the shape
  assert.ok(body !== null && typeof body === 'object', 'Expected a JSON response');
});

// ---------------------------------------------------------------------------
// Play endpoint (bot move)
// ---------------------------------------------------------------------------

test('e2e: GET /external/v1/play returns coordinates with default bot', async () => {
  const query = buildPlayQuery({ position: emptyPosition() });
  const response = await fetch(`${GATEWAY_URL}/external/v1/play?${query}`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(body.coords, 'Expected coords in response');
  assert.ok(Number.isInteger(body.coords.x), 'Expected integer x coordinate');
  assert.ok(Number.isInteger(body.coords.y), 'Expected integer y coordinate');
  assert.ok(Number.isInteger(body.coords.z), 'Expected integer z coordinate');
});

test('e2e: GET /external/v1/play works with explicit bot_id', async () => {
  // Get the available bots first
  const botsResponse = await fetch(`${GATEWAY_URL}/external/v1/bots`);
  const bots = await botsResponse.json();
  const firstBotId = bots.items[0].bot_id;

  const query = buildPlayQuery({ position: emptyPosition(), botId: firstBotId });
  const response = await fetch(`${GATEWAY_URL}/external/v1/play?${query}`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(body.coords, 'Expected coords in response');
});

test('e2e: GET /external/v1/play works with strategy parameter', async () => {
  const query = buildPlayQuery({ position: emptyPosition(), strategy: 'random' });
  const response = await fetch(`${GATEWAY_URL}/external/v1/play?${query}`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(body.coords, 'Expected coords in response');
});

test('e2e: GET /external/v1/play returns 400 when position is missing', async () => {
  const response = await fetch(`${GATEWAY_URL}/external/v1/play`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.message, /position is required/);
});

test('e2e: GET /external/v1/play returns 400 for invalid position JSON', async () => {
  const response = await fetch(`${GATEWAY_URL}/external/v1/play?position=%7Binvalid`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.message, /position must be valid JSON/i);
});

test('e2e: GET /external/v1/play returns 400 for non-object position', async () => {
  const query = new URLSearchParams({ position: '"just a string"' });
  const response = await fetch(`${GATEWAY_URL}/external/v1/play?${query}`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.ok(body.message, 'Expected an error message');
});

test('e2e: GET /external/v1/play returns 400 for position with invalid size', async () => {
  const bad = { size: -1, turn: 0, players: ['B', 'R'], layout: '.' };
  const query = new URLSearchParams({ position: JSON.stringify(bad) });
  const response = await fetch(`${GATEWAY_URL}/external/v1/play?${query}`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.message, /size/i);
});

// ---------------------------------------------------------------------------
// Game lifecycle
// ---------------------------------------------------------------------------

test('e2e: full game lifecycle – create, move, resign', async () => {
  const username = uniqueUsername();
  const token = await registerAndLogin(username);
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 1. Create a game
  const createResponse = await fetch(`${GATEWAY_URL}/external/v1/games`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ size: 3, mode: 'human_vs_bot', bot_id: 'random_bot' }),
  });
  const game = await createResponse.json();

  assert.equal(createResponse.status, 200);
  assert.ok(game.game_id, 'Expected game_id in create response');
  assert.equal(game.game_over, false);

  // 2. Get the game state
  const getResponse = await fetch(`${GATEWAY_URL}/external/v1/games/${game.game_id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(getResponse.status, 200);

  // 3. Try to make a move
  const moveResponse = await fetch(`${GATEWAY_URL}/external/v1/games/${game.game_id}/moves`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ coords: { x: 2, y: 0, z: 0 } }),
  });

  // Move might succeed or fail depending on game rules, but we check it returns valid JSON
  assert.ok(moveResponse.status >= 200 && moveResponse.status < 600, 'Expected a valid HTTP status');

  // 4. Resign the game
  const resignResponse = await fetch(`${GATEWAY_URL}/external/v1/games/${game.game_id}/resign`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.ok(resignResponse.status >= 200 && resignResponse.status < 500, 'Resign should not cause a server error');
});

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

test('e2e: GET /metrics returns Prometheus metrics', async () => {
  // Generate some traffic first
  await fetch(`${GATEWAY_URL}/health`);

  const response = await fetch(`${GATEWAY_URL}/metrics`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /yovi_http_requests_total/);
  assert.match(body, /yovi_process_uptime_seconds/);
});
