const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');

const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const externalApiSpec = require('./external-api-spec.json');
const { createPrometheusMetrics } = require('./prometheus-metrics');

const DEFAULT_PORT = Number(process.env.PORT ?? 8080);
const DEFAULT_EXTERNAL_BOT_ID = 'random_bot';
const DEFAULT_REDIRECT_HTTPS_HOST = 'localhost';
const SAFE_REDIRECT_SEGMENT = /^[A-Za-z0-9._~-]+$/;
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

function getRedirectHostname(env = process.env) {
  return (
    normalizeOptionalString(env.GATEWAY_PUBLIC_HOSTNAME) ??
    normalizeOptionalString(env.GATEWAY_HTTPS_HOST) ??
    DEFAULT_REDIRECT_HTTPS_HOST
  );
}

function buildHttpsOrigin(hostname, httpsPort) {
  const normalizedHostname = normalizeOptionalString(hostname) ?? DEFAULT_REDIRECT_HTTPS_HOST;
  const portSuffix = httpsPort === 443 ? '' : `:${httpsPort}`;
  return `https://${normalizedHostname}${portSuffix}`;
}

function parseAllowedOrigins(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function parseOriginUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeHostname(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }

  const asUrl = parseOriginUrl(normalized.includes('://') ? normalized : `https://${normalized}`);
  return asUrl?.hostname ?? null;
}

function isOriginAllowedByHostname(origin, hostnames) {
  const originUrl = parseOriginUrl(origin);
  if (!originUrl) {
    return false;
  }

  const allowedHostnames = hostnames
    .map(normalizeHostname)
    .filter(Boolean);

  return allowedHostnames.includes(originUrl.hostname);
}

function isInternalApiOriginAllowed(origin, env = process.env) {
  if (!origin) {
    return true;
  }

  const allowedOrigins = parseAllowedOrigins(env.GATEWAY_ALLOWED_ORIGINS);
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return isOriginAllowedByHostname(origin, [
    env.GATEWAY_PUBLIC_HOSTNAME,
    env.GATEWAY_HTTPS_HOST,
  ]);
}

function handleCorsError(error, _req, res, next) {
  if (error?.message !== 'Not allowed by CORS for internal API') {
    return next(error);
  }

  return res.status(403).json({ message: error.message });
}

function sanitizeRedirectPath(requestPath = '/') {
  if (typeof requestPath !== 'string' || requestPath.trim().length === 0 || !requestPath.startsWith('/')) {
    return '/';
  }

  const safeSegments = [];

  for (const rawSegment of requestPath.split('/')) {
    if (rawSegment.length === 0) {
      continue;
    }

    let decodedSegment;
    try {
      decodedSegment = decodeURIComponent(rawSegment);
    } catch {
      return '/';
    }

    if (
      decodedSegment.length === 0 ||
      decodedSegment === '.' ||
      decodedSegment === '..' ||
      !SAFE_REDIRECT_SEGMENT.test(decodedSegment)
    ) {
      return '/';
    }

    safeSegments.push(decodedSegment);
  }

  return safeSegments.length === 0 ? '/' : `/${safeSegments.join('/')}`;
}

function buildRedirectDestination({ redirectHostname, httpsPort, requestPath = '/' }) {
  const destination = new URL(buildHttpsOrigin(redirectHostname, httpsPort));
  destination.pathname = sanitizeRedirectPath(requestPath);
  return destination.toString();
}

function createRedirectApp({ httpsPort = 443, redirectHostname = DEFAULT_REDIRECT_HTTPS_HOST } = {}) {
  const app = express();

  app.use((req, res) => {
    const destination = buildRedirectDestination({
      redirectHostname,
      httpsPort,
      requestPath: req.path,
    });
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

function buildInternalForwardHeaders(req, user, extraHeaders = {}) {
  const headers = buildForwardHeaders(req, user, extraHeaders);
  const forwardedUserId = normalizeOptionalString(req.get('x-user-id'));

  if (!headers['x-user-id'] && forwardedUserId) {
    headers['x-user-id'] = forwardedUserId;
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

function parsePlayPositionQuery(positionQueryValue) {
  const rawPosition = normalizeOptionalString(positionQueryValue);
  if (!rawPosition) {
    throw new Error('position is required');
  }

  let parsedPosition;
  try {
    parsedPosition = JSON.parse(rawPosition);
  } catch {
    throw new Error('position must be valid JSON object in YEN format');
  }

  const validatedPosition = validateYenPosition(parsedPosition);

  return {
    position: parsedPosition,
    boardSize: validatedPosition.size,
  };
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


  router.get('/v1/play', asyncRoute(async (req, res) => {
    let playQuery;
    try {
      playQuery = parsePlayPositionQuery(req.query.position);
    } catch (error) {
      res.status(400).json({ message: error.message });
      return;
    }

    const botId = pickPlayBotId(req.query);
    const playResult = await fetchJson(
      fetchImpl,
      'gamey service',
      `${serviceUrls.gamey}/v1/ybot/choose/${encodeURIComponent(botId)}`,
      buildJsonInit('POST', playQuery.position, {
        'Content-Type': 'application/json',
      }),
    );

    const coords = validateCoordinates(playResult.payload?.coords, playQuery.boardSize);

    res.json({
      coords,
    });
  }));

  router.post('/v1/games', asyncRoute(async (req, res) => {
    const user = await getOptionalUser(req, serviceUrls, fetchImpl);
    const opponentUserId = normalizeOptionalString(req.body?.opponent_user_id);
    const payload = {
      ...req.body,
    };

    delete payload.opponent_user_id;

    const result = await fetchJson(
      fetchImpl,
      'gamey service',
      `${serviceUrls.gamey}/v1/games`,
      buildJsonInit('POST', payload, buildForwardHeaders(req, user, {
        ...(opponentUserId ? { 'x-opponent-user-id': opponentUserId } : {}),
        'Content-Type': 'application/json',
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

function createInternalApiRouter({ serviceUrls, fetchImpl }) {
  const router = express.Router();

  router.post('/v1/matchmaking/enqueue', express.json(), asyncRoute(async (req, res) => {
    const user = await getOptionalUser(req, serviceUrls, fetchImpl);
    const result = await fetchJson(
      fetchImpl,
      'gamey service',
      `${serviceUrls.gamey}/v1/matchmaking/enqueue`,
      buildJsonInit('POST', req.body, buildInternalForwardHeaders(req, user, {
        'Content-Type': 'application/json',
      })),
    );

    sendPayload(res, result.status, result.payload);
  }));

  router.get('/v1/matchmaking/tickets/:ticketId', asyncRoute(async (req, res) => {
    const result = await fetchJson(
      fetchImpl,
      'gamey service',
      `${serviceUrls.gamey}/v1/matchmaking/tickets/${encodeURIComponent(req.params.ticketId)}`,
      { method: 'GET' },
    );

    sendPayload(res, result.status, result.payload);
  }));

  router.post('/v1/matchmaking/tickets/:ticketId/cancel', asyncRoute(async (req, res) => {
    const result = await fetchJson(
      fetchImpl,
      'gamey service',
      `${serviceUrls.gamey}/v1/matchmaking/tickets/${encodeURIComponent(req.params.ticketId)}/cancel`,
      { method: 'POST' },
    );

    sendPayload(res, result.status, result.payload);
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
  const metrics = createPrometheusMetrics({ serviceName: 'gateway' });

  app.use(metrics.middleware);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/metrics', metrics.handler);

  app.use('/external', createExternalApiRouter({ env, fetchImpl, spec }));

  const serviceUrls = buildServiceUrls(env);

  // Stricter CORS for the internal API
  app.use('/api', cors({
    origin: (origin, callback) => {
      if (isInternalApiOriginAllowed(origin, env)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS for internal API'));
      }
    }
  }));
  app.use('/api', handleCorsError);

  app.use('/api', createInternalApiRouter({ serviceUrls, fetchImpl }));

  for (const route of proxyRoutes) {
    if (route.mountPath === '/api') {
      // Internal authenticated proxy for webapp and E2E tests.
      // This is the FIX for "Invalid player_token" as it forwards x-user-id.
      app.use(route.mountPath, async (req, res, next) => {
        try {
          const user = await getOptionalUser(req, serviceUrls, fetchImpl);
          if (user) {
            req.headers['x-user-id'] = user.id;
          }
        } catch (error) {
          if (!(error instanceof HttpResponseError) && !(error instanceof UpstreamConnectionError)) {
            return next(error);
          }
          // Ignore auth errors for raw proxy, internal services handle it.
        }
        next();
      }, buildProxy(route, proxyFactory));
    } else {
      app.use(route.mountPath, buildProxy(route, proxyFactory));
    }
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
    const redirectHost = getRedirectHostname(env);
    const redirectHttpsPort = normalizeOptionalPort(env.GATEWAY_HTTPS_HOST_PORT) ?? httpsPort;
    const redirectApp = createRedirectApp({
      httpsPort: redirectHttpsPort,
      redirectHostname: redirectHost,
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
  handleCorsError,
  buildProxy,
  buildRedirectDestination,
  buildHttpsOrigin,
  createApp,
  createRedirectApp,
  createExternalApiRouter,
  getRedirectHostname,
  getProxyRoutes,
  getTlsConfig,
  isInternalApiOriginAllowed,
  isDirectExecution,
  loadTlsOptions,
  parseAllowedOrigins,
  sanitizeRedirectPath,
  pickPlayBotId,
  parseBoolean,
  start,
};
