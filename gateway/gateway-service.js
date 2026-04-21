const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const externalApiSpec = require('./external-api-spec.json');

const DEFAULT_PORT = Number(process.env.PORT ?? 8080);
const DEFAULT_EXTERNAL_BOT_ID = 'random_bot';
const DEFAULT_REDIRECT_HTTPS_HOST = 'localhost';
const EXTERNAL_DOCS_PATH = '/external/docs';
const EXTERNAL_OPENAPI_PATH = '/external/docs/openapi.json';
const STRATEGY_TO_BOT_ID = {
  random: 'random_bot',
  biased_random: 'biased_random_bot',
  greedy: 'greedy_bot',
  minimax: 'minimax_bot',
};
const PUBLIC_BOT_CATALOG = [
  {
    bot_id: 'random_bot',
    strategy: 'random',
    description: 'Chooses uniformly among valid moves.',
  },
  {
    bot_id: 'biased_random_bot',
    strategy: 'biased_random',
    description: 'Randomized bot with positional bias towards stronger cells.',
  },
  {
    bot_id: 'greedy_bot',
    strategy: 'greedy',
    description: 'Prefers locally strong tactical moves.',
  },
  {
    bot_id: 'minimax_bot',
    strategy: 'minimax',
    description: 'Looks ahead to choose stronger competitive moves.',
  },
];
const VALID_YEN_CELLS = new Set(['.', 'B', 'R']);

class HttpResponseError extends Error {
  constructor(status, payload, fallbackMessage) {
    super(extractMessage(payload, fallbackMessage));
    this.name = 'HttpResponseError';
    this.status = status;
    this.payload = payload;
  }
}

class UpstreamConnectionError extends Error {
  constructor(serviceName, cause) {
    super(`Could not reach ${serviceName}`);
    this.name = 'UpstreamConnectionError';
    this.serviceName = serviceName;
    this.cause = cause;
  }
}

function getProxyRoutes(env = process.env) {
  return [
    {
      mountPath: '/api',
      target: env.GAMEY_SERVICE_URL ?? 'http://gamey:4000',
      stripPrefix: '/api',
    },
    {
      mountPath: '/auth',
      target: env.AUTH_SERVICE_URL ?? 'http://auth:3500',
      stripPrefix: '/auth',
    },
    {
      mountPath: '/stats',
      target: env.STATS_SERVICE_URL ?? 'http://stats:3001',
      stripPrefix: '/stats',
    },
    {
      mountPath: '/',
      target: env.WEBAPP_SERVICE_URL ?? 'http://webapp:80',
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

function normalizeBaseUrl(url) {
  let normalizedUrl = String(url);

  while (normalizedUrl.endsWith('/')) {
    normalizedUrl = normalizedUrl.slice(0, -1);
  }

  return normalizedUrl;
}

function buildServiceUrls(env = process.env) {
  return {
    auth: normalizeBaseUrl(env.AUTH_SERVICE_URL ?? 'http://auth:3500'),
    gamey: normalizeBaseUrl(env.GAMEY_SERVICE_URL ?? 'http://gamey:4000'),
    stats: normalizeBaseUrl(env.STATS_SERVICE_URL ?? 'http://stats:3001'),
  };
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const clean = value.trim();
  return clean.length > 0 ? clean : null;
}

function normalizeOptionalPort(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port value: ${value}`);
  }

  return port;
}

function parseBoolean(value, defaultValue = false) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(normalized.toLowerCase());
}

function getTlsConfig(env = process.env) {
  const certPath = normalizeOptionalString(env.HTTPS_CERT_PATH);
  const keyPath = normalizeOptionalString(env.HTTPS_KEY_PATH);

  if (!certPath && !keyPath) {
    return null;
  }

  if (!certPath || !keyPath) {
    throw new Error('HTTPS_CERT_PATH and HTTPS_KEY_PATH must be set together');
  }

  return {
    certPath,
    keyPath,
  };
}

function loadTlsOptions(env = process.env) {
  const tlsConfig = getTlsConfig(env);
  if (!tlsConfig) {
    return null;
  }

  return {
    cert: fs.readFileSync(tlsConfig.certPath),
    key: fs.readFileSync(tlsConfig.keyPath),
  };
}

function buildHttpsOrigin(hostname, httpsPort) {
  const normalizedHost = normalizeOptionalString(hostname) ?? DEFAULT_REDIRECT_HTTPS_HOST;
  const portSuffix = httpsPort === 443 ? '' : `:${httpsPort}`;
  return `https://${normalizedHost}${portSuffix}`;
}

function createRedirectApp({ httpsHost = DEFAULT_REDIRECT_HTTPS_HOST, httpsPort = 443 } = {}) {
  const app = express();

  app.use((req, res) => {
    const destination = `${buildHttpsOrigin(httpsHost, httpsPort)}${req.originalUrl}`;
    res.redirect(308, destination);
  });

  return app;
}

function extractMessage(payload, fallbackMessage = 'Request failed') {
  if (isObject(payload) && typeof payload.message === 'string') {
    return payload.message;
  }

  if (typeof payload === 'string' && payload.trim().length > 0) {
    return payload;
  }

  return fallbackMessage;
}

async function parseUpstreamResponse(response) {
  const raw = await response.text();

  if (raw.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function fetchJson(fetchImpl, serviceName, url, init) {
  let response;

  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    throw new UpstreamConnectionError(serviceName, error);
  }

  const payload = await parseUpstreamResponse(response);

  if (!response.ok) {
    throw new HttpResponseError(response.status, payload, `${serviceName} request failed`);
  }

  return {
    status: response.status,
    payload,
  };
}

function sendPayload(res, status, payload) {
  if (payload === null || payload === undefined) {
    return res.status(status).end();
  }

  if (typeof payload === 'string') {
    return res.status(status).type('text/plain').send(payload);
  }

  return res.status(status).json(payload);
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function buildJsonInit(method, body, headers = {}) {
  const init = {
    method,
    headers,
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  return init;
}

function extractAuthorizationHeader(req) {
  return normalizeOptionalString(req.get('authorization'));
}

async function verifyUser(authorization, serviceUrls, fetchImpl) {
  const { payload } = await fetchJson(
    fetchImpl,
    'auth service',
    `${serviceUrls.auth}/verify`,
    {
      method: 'GET',
      headers: {
        Authorization: authorization,
      },
    },
  );

  if (!isObject(payload) || !isObject(payload.user)) {
    throw new HttpResponseError(502, { message: 'Invalid auth verification response' });
  }

  return payload.user;
}

async function getOptionalUser(req, serviceUrls, fetchImpl) {
  const authorization = extractAuthorizationHeader(req);

  if (!authorization) {
    return null;
  }

  return verifyUser(authorization, serviceUrls, fetchImpl);
}

async function requireUser(req, res, serviceUrls, fetchImpl) {
  const authorization = extractAuthorizationHeader(req);

  if (!authorization) {
    res.status(401).json({ message: 'Missing token' });
    return null;
  }

  return verifyUser(authorization, serviceUrls, fetchImpl);
}

function buildForwardHeaders(req, user, extraHeaders = {}) {
  const headers = { ...extraHeaders };

  if (user && typeof user.id === 'string') {
    headers['x-user-id'] = user.id;
  }

  const authorization = extractAuthorizationHeader(req);
  if (authorization) {
    headers.Authorization = authorization;
  }

  return headers;
}

function pickPlayBotId(body) {
  const explicitBotId = normalizeOptionalString(body?.bot_id);
  if (explicitBotId) {
    return explicitBotId;
  }

  const strategy = normalizeOptionalString(body?.strategy);
  if (!strategy) {
    return DEFAULT_EXTERNAL_BOT_ID;
  }

  return STRATEGY_TO_BOT_ID[strategy.toLowerCase()] ?? strategy;
}

function validateYenPlayers(players) {
  if (!Array.isArray(players) || players?.length !== 2 || players?.[0] !== 'B' || players?.[1] !== 'R') {
    throw new Error("position.players must be exactly ['B', 'R']");
  }

  return players;
}

function findUnsupportedYenCell(row) {
  return [...row].find((cell) => !VALID_YEN_CELLS.has(cell)) ?? null;
}

function validateYenLayout(layout, size) {
  if (typeof layout !== 'string' || layout.trim().length === 0) {
    throw new Error('position.layout must be a non-empty string');
  }

  const rows = layout.split('/');
  if (rows.length !== size) {
    throw new Error(`position.layout must contain ${size} rows`);
  }

  rows.forEach((row, rowIndex) => {
    if (row.length !== rowIndex + 1) {
      throw new Error(`position.layout row ${rowIndex} must contain ${rowIndex + 1} cells`);
    }

    const unsupportedCell = findUnsupportedYenCell(row);
    if (unsupportedCell) {
      throw new Error(`position.layout contains unsupported cell '${unsupportedCell}'`);
    }
  });

  return rows;
}

function validateYenPosition(position) {
  if (!isObject(position)) {
    throw new Error('position must be a JSON object in YEN format');
  }

  const size = Number(position.size);
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error('position.size must be an integer greater than 0');
  }

  const turn = Number(position.turn);
  if (!Number.isInteger(turn) || turn < 0 || turn > 1) {
    throw new Error('position.turn must be 0 or 1');
  }

  const players = validateYenPlayers(position.players);
  const rows = validateYenLayout(position.layout, size);

  return {
    size,
    turn,
    players,
    rows,
  };
}

function validateCoordinates(coords, boardSize) {
  if (!isObject(coords)) {
    throw new Error('Bot response did not include valid coordinates');
  }

  const x = Number(coords.x);
  const y = Number(coords.y);
  const z = Number(coords.z);

  if (![x, y, z].every((value) => Number.isInteger(value) && value >= 0)) {
    throw new Error('Bot response coordinates must be non-negative integers');
  }

  const max = boardSize - 1;
  if (x > max || y > max || z > max || x + y + z !== max) {
    throw new Error('Bot response coordinates are outside the board');
  }

  return { x, y, z };
}

function inferTurnFromRows(rows) {
  let blue = 0;
  let red = 0;

  for (const row of rows) {
    for (const cell of row) {
      if (cell === 'B') {
        blue += 1;
      } else if (cell === 'R') {
        red += 1;
      }
    }
  }

  if (blue === red) {
    return 0;
  }

  if (blue === red + 1) {
    return 1;
  }

  return null;
}

function applyBotMoveToYen(position, coords) {
  const validatedPosition = validateYenPosition(position);
  const validatedCoords = validateCoordinates(coords, validatedPosition.size);
  const rowIndex = validatedPosition.size - 1 - validatedCoords.x;
  const columnIndex = validatedCoords.y;
  const rows = validatedPosition.rows.map((row) => row.split(''));

  if (rows[rowIndex][columnIndex] !== '.') {
    throw new Error('Bot selected an occupied position');
  }

  const effectiveTurn = inferTurnFromRows(validatedPosition.rows) ?? validatedPosition.turn;
  rows[rowIndex][columnIndex] = validatedPosition.players[effectiveTurn];

  return {
    size: validatedPosition.size,
    turn: (effectiveTurn + 1) % validatedPosition.players.length,
    players: validatedPosition.players,
    layout: rows.map((row) => row.join('')).join('/'),
  };
}

function buildDocsHtml(spec = externalApiSpec) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${spec.info.title}</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
    <style>
      html {
        box-sizing: border-box;
        overflow-y: scroll;
      }
      *, *:before, *:after {
        box-sizing: inherit;
      }
      body {
        margin: 0;
        background: #f6f7fb;
      }
      .topbar {
        background: linear-gradient(90deg, #1f2937 0%, #374151 100%);
        color: #fff;
        padding: 14px 22px;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      }
      .topbar strong {
        font-size: 1rem;
      }
      .topbar span {
        margin-left: 12px;
        opacity: 0.8;
      }
      .topbar a {
        color: #fbbf24;
        margin-left: 16px;
        text-decoration: none;
      }
      #swagger-ui {
        max-width: 1200px;
        margin: 0 auto;
      }
    </style>
  </head>
  <body>
    <div class="topbar">
      <strong>${spec.info.title}</strong>
      <span>${spec.info.version}</span>
      <a href="${EXTERNAL_OPENAPI_PATH}">OpenAPI JSON</a>
    </div>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: '${EXTERNAL_OPENAPI_PATH}',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          layout: 'BaseLayout',
          displayRequestDuration: true,
          docExpansion: 'list',
          defaultModelsExpandDepth: 2,
          tryItOutEnabled: true
        });
      };
    </script>
  </body>
</html>`;
}

function createExternalApiRouter({ env = process.env, fetchImpl = globalThis.fetch, spec = externalApiSpec } = {}) {
  const router = express.Router();
  const serviceUrls = buildServiceUrls(env);

  router.get('/docs', (_req, res) => {
    res.type('html').send(buildDocsHtml(spec));
  });

  router.get('/docs/openapi.json', (_req, res) => {
    res.json(spec);
  });

  router.use('/v1', express.json());

  router.get('/v1/health', (_req, res) => {
    res.json({ status: 'ok', api: 'external' });
  });

  router.get('/v1/bots', (_req, res) => {
    res.json({
      default_bot_id: DEFAULT_EXTERNAL_BOT_ID,
      items: PUBLIC_BOT_CATALOG,
    });
  });

  router.post('/v1/users/register', asyncRoute(async (req, res) => {
    const result = await fetchJson(
      fetchImpl,
      'auth service',
      `${serviceUrls.auth}/register`,
      buildJsonInit('POST', req.body, {
        'Content-Type': 'application/json',
      }),
    );

    sendPayload(res, result.status, result.payload);
  }));

  router.post('/v1/users/login', asyncRoute(async (req, res) => {
    const result = await fetchJson(
      fetchImpl,
      'auth service',
      `${serviceUrls.auth}/login`,
      buildJsonInit('POST', req.body, {
        'Content-Type': 'application/json',
      }),
    );

    sendPayload(res, result.status, result.payload);
  }));

  router.get('/v1/users/me', asyncRoute(async (req, res) => {
    const user = await requireUser(req, res, serviceUrls, fetchImpl);
    if (!user) {
      return;
    }

    const stats = await fetchJson(
      fetchImpl,
      'stats service',
      `${serviceUrls.stats}/v1/me`,
      {
        method: 'GET',
        headers: {
          'x-user-id': user.id,
        },
      },
    );

    res.json({
      id: user.id,
      username: user.username,
      stats: stats.payload,
    });
  }));

  router.get('/v1/users/me/history', asyncRoute(async (req, res) => {
    const user = await requireUser(req, res, serviceUrls, fetchImpl);
    if (!user) {
      return;
    }

    const limit = normalizeOptionalString(req.query.limit);
    const url = new URL(`${serviceUrls.stats}/v1/me/history`);
    if (limit) {
      url.searchParams.set('limit', limit);
    }

    const history = await fetchJson(
      fetchImpl,
      'stats service',
      url.toString(),
      {
        method: 'GET',
        headers: {
          'x-user-id': user.id,
        },
      },
    );

    sendPayload(res, history.status, history.payload);
  }));

  router.post('/v1/games', asyncRoute(async (req, res) => {
    const user = await getOptionalUser(req, serviceUrls, fetchImpl);
    const opponentUserId = normalizeOptionalString(req.body?.opponent_user_id);
    const requestBody = isObject(req.body)
      ? {
          size: req.body.size,
          mode: req.body.mode,
          bot_id: req.body.bot_id,
        }
      : req.body;

    const result = await fetchJson(
      fetchImpl,
      'gamey service',
      `${serviceUrls.gamey}/v1/games`,
      buildJsonInit('POST', requestBody, buildForwardHeaders(req, user, {
        'Content-Type': 'application/json',
        ...(opponentUserId ? { 'x-opponent-user-id': opponentUserId } : {}),
      })),
    );

    sendPayload(res, result.status, result.payload);
  }));

  router.get('/v1/games/:gameId', asyncRoute(async (req, res) => {
    const user = await getOptionalUser(req, serviceUrls, fetchImpl);
    const result = await fetchJson(
      fetchImpl,
      'gamey service',
      `${serviceUrls.gamey}/v1/games/${encodeURIComponent(req.params.gameId)}`,
      {
        method: 'GET',
        headers: buildForwardHeaders(req, user),
      },
    );

    sendPayload(res, result.status, result.payload);
  }));

  router.post('/v1/games/:gameId/moves', asyncRoute(async (req, res) => {
    const user = await getOptionalUser(req, serviceUrls, fetchImpl);
    const result = await fetchJson(
      fetchImpl,
      'gamey service',
      `${serviceUrls.gamey}/v1/games/${encodeURIComponent(req.params.gameId)}/moves`,
      buildJsonInit('POST', req.body, buildForwardHeaders(req, user, {
        'Content-Type': 'application/json',
      })),
    );

    sendPayload(res, result.status, result.payload);
  }));

  router.post('/v1/games/:gameId/resign', asyncRoute(async (req, res) => {
    const user = await getOptionalUser(req, serviceUrls, fetchImpl);
    const result = await fetchJson(
      fetchImpl,
      'gamey service',
      `${serviceUrls.gamey}/v1/games/${encodeURIComponent(req.params.gameId)}/resign`,
      {
        method: 'POST',
        headers: buildForwardHeaders(req, user),
      },
    );

    sendPayload(res, result.status, result.payload);
  }));

  router.post('/v1/games/:gameId/pass', asyncRoute(async (req, res) => {
    const user = await getOptionalUser(req, serviceUrls, fetchImpl);
    const result = await fetchJson(
      fetchImpl,
      'gamey service',
      `${serviceUrls.gamey}/v1/games/${encodeURIComponent(req.params.gameId)}/pass`,
      {
        method: 'POST',
        headers: buildForwardHeaders(req, user),
      },
    );

    sendPayload(res, result.status, result.payload);
  }));

  router.post('/v1/play', asyncRoute(async (req, res) => {
    if (!isObject(req.body)) {
      res.status(400).json({ message: 'Body must be a JSON object' });
      return;
    }

    if (!isObject(req.body.position)) {
      res.status(400).json({ message: 'position is required' });
      return;
    }

    const botId = pickPlayBotId(req.body);
    const playResult = await fetchJson(
      fetchImpl,
      'gamey service',
      `${serviceUrls.gamey}/v1/ybot/choose/${encodeURIComponent(botId)}`,
      buildJsonInit('POST', req.body.position, {
        'Content-Type': 'application/json',
      }),
    );

    const move = applyBotMoveToYen(req.body.position, playResult.payload?.coords);

    res.json({
      api_version: playResult.payload?.api_version ?? 'v1',
      bot_id: playResult.payload?.bot_id ?? botId,
      coords: playResult.payload?.coords,
      move,
    });
  }));

  router.use((error, _req, res, _next) => {
    if (res.headersSent) {
      return;
    }

    if (error instanceof HttpResponseError) {
      sendPayload(res, error.status, error.payload ?? { message: error.message });
      return;
    }

    if (error instanceof UpstreamConnectionError) {
      res.status(502).json({ message: `Bad Gateway: ${error.serviceName} unavailable` });
      return;
    }

    console.error(error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  });

  return router;
}

function createApp({
  env = process.env,
  proxyFactory = createProxyMiddleware,
  fetchImpl = globalThis.fetch,
  spec = externalApiSpec,
} = {}) {
  const app = express();
  const proxyRoutes = getProxyRoutes(env);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/external', createExternalApiRouter({ env, fetchImpl, spec }));

  for (const route of proxyRoutes) {
    app.use(route.mountPath, buildProxy(route, proxyFactory));
  }

  return { app, proxyRoutes };
}

function start({ port = DEFAULT_PORT, env = process.env } = {}) {
  const { app } = createApp({ env });
  const tlsOptions = loadTlsOptions(env);

  if (!tlsOptions) {
    const httpServer = http.createServer(app);
    httpServer.listen(port, () => {
      console.log(`Gateway listening at http://localhost:${port}`);
    });
    return {
      httpServer,
      httpsServer: null,
    };
  }

  const httpsPort = normalizeOptionalPort(env.HTTPS_PORT) ?? 8443;
  const httpsServer = https.createServer(tlsOptions, app);
  httpsServer.listen(httpsPort, () => {
    console.log(`Gateway listening at https://localhost:${httpsPort}`);
  });

  let httpServer = null;
  if (parseBoolean(env.HTTP_REDIRECT_ENABLED)) {
    const redirectHost = normalizeOptionalString(env.GATEWAY_HTTPS_HOST) ?? DEFAULT_REDIRECT_HTTPS_HOST;
    const redirectHttpsPort = normalizeOptionalPort(env.GATEWAY_HTTPS_HOST_PORT) ?? httpsPort;
    const redirectApp = createRedirectApp({
      httpsHost: redirectHost,
      httpsPort: redirectHttpsPort,
    });
    httpServer = http.createServer(redirectApp);
    httpServer.listen(port, () => {
      console.log(`Gateway redirecting http://localhost:${port} -> ${buildHttpsOrigin(redirectHost, redirectHttpsPort)}`);
    });
  }

  return {
    httpServer,
    httpsServer,
  };
}

function isDirectExecution() {
  return require.main?.filename === __filename;
}

if (isDirectExecution()) {
  start();
}

module.exports = {
  DEFAULT_EXTERNAL_BOT_ID,
  EXTERNAL_DOCS_PATH,
  EXTERNAL_OPENAPI_PATH,
  PUBLIC_BOT_CATALOG,
  STRATEGY_TO_BOT_ID,
  applyBotMoveToYen,
  buildDocsHtml,
  buildProxy,
  buildHttpsOrigin,
  createApp,
  createRedirectApp,
  createExternalApiRouter,
  getProxyRoutes,
  getTlsConfig,
  isDirectExecution,
  loadTlsOptions,
  pickPlayBotId,
  parseBoolean,
  start,
};
