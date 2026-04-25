const express = require('express');
const { MongoClient } = require('mongodb');
const { createPrometheusMetrics } = require('./prometheus-metrics');

// 1) Configuracion basica
const DEFAULT_PORT = Number(process.env.PORT ?? 3001);
const MONGO_URL = process.env.MONGO_URL ?? 'mongodb://localhost:27017';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME ?? 'yovi_stats';
const INTERNAL_TOKEN = process.env.STATS_INTERNAL_TOKEN ?? 'stats-internal-token';
const HISTORY_MODE_VALUES = ['human_vs_bot', 'local_human_vs_human', 'human_vs_human', 'online'];

// --- Helpers de validacion y normalizacion ---

function parseLimit(rawLimit, defaultValue = 20, maxValue = 100) {
  const parsed = Number(rawLimit);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.min(parsed, maxValue);
}

function readOptionalQueryString(query, name) {
  const rawValue = query[name];

  if (rawValue === undefined || rawValue === null) {
    return { value: null };
  }

  if (typeof rawValue !== 'string') {
    return { error: `${name} must be a single string value` };
  }

  const value = rawValue.trim();
  return { value: value.length > 0 ? value : null };
}

function readEnumQueryString(query, name, allowedValues) {
  const { value, error } = readOptionalQueryString(query, name);

  if (error || value === null) {
    return { value, error };
  }

  return allowedValues.includes(value)
    ? { value }
    : { error: `${name} must be one of: ${allowedValues.join(', ')}` };
}

function readBooleanQueryString(query, name) {
  const { value, error } = readOptionalQueryString(query, name);

  if (error || value === null) {
    return { value, error };
  }

  if (value === 'true') return { value: true };
  if (value === 'false') return { value: false };

  return { error: `${name} must be one of: true, false` };
}

function buildHistoryQuery({ userId, rawQuery = {} }) {
  const filter = { userId };

  const result = readEnumQueryString(rawQuery, 'result', ['win', 'loss']);
  if (result.error) return { error: result.error };
  if (result.value) filter.result = result.value;

  const winner = readEnumQueryString(rawQuery, 'winner', ['you', 'rival']);
  if (winner.error) return { error: winner.error };
  if (winner.value) {
    const winnerResult = winner.value === 'you' ? 'win' : 'loss';
    filter.result = filter.result && filter.result !== winnerResult ? { $in: [] } : winnerResult;
  }

  const mode = readEnumQueryString(rawQuery, 'mode', HISTORY_MODE_VALUES);
  if (mode.error) return { error: mode.error };
  if (mode.value === 'online') {
    filter.mode = { $in: ['online', 'human_vs_human'] };
  } else if (mode.value) {
    filter.mode = mode.value;
  }

  const botId = readOptionalQueryString(rawQuery, 'botId');
  if (botId.error) return { error: botId.error };

  const hasBot = readBooleanQueryString(rawQuery, 'hasBot');
  if (hasBot.error) return { error: hasBot.error };
  if (botId.value && hasBot.value !== null) {
    return { error: 'botId and hasBot cannot be used together' };
  }
  if (botId.value) {
    filter.botId = botId.value;
  } else if (hasBot.value === true) {
    filter.botId = { $type: 'string', $ne: '' };
  } else if (hasBot.value === false) {
    filter.botId = null;
  }

  const winnerId = readOptionalQueryString(rawQuery, 'winnerId');
  if (winnerId.error) return { error: winnerId.error };

  const hasWinner = readBooleanQueryString(rawQuery, 'hasWinner');
  if (hasWinner.error) return { error: hasWinner.error };
  if (winnerId.value && hasWinner.value !== null) {
    return { error: 'winnerId and hasWinner cannot be used together' };
  }
  if (winnerId.value) {
    filter.winnerId = winnerId.value;
  } else if (hasWinner.value === true) {
    filter.winnerId = { $type: 'string', $ne: '' };
  } else if (hasWinner.value === false) {
    filter.winnerId = null;
  }

  const sortOption = readEnumQueryString(rawQuery, 'sort', ['recent_first', 'oldest_first']);
  if (sortOption.error) return { error: sortOption.error };

  return {
    filter,
    sort: { endedAt: sortOption.value === 'oldest_first' ? 1 : -1 },
  };
}

function readUserIdFromHeader(req) {
  const userId = req.get('x-user-id');

  if (typeof userId !== 'string') {
    return null;
  }

  const cleanUserId = userId.trim();
  return cleanUserId.length > 0 ? cleanUserId : null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateRequiredNonEmptyString(value, errorMessage) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return errorMessage;
  }

  return null;
}

function validateOptionalObject(value, errorMessage) {
  if (value === undefined || value === null) {
    return null;
  }

  return isPlainObject(value) ? null : errorMessage;
}

function validateOptionalString(value, errorMessage) {
  if (value === undefined || value === null) {
    return null;
  }

  return typeof value === 'string' ? null : errorMessage;
}

function validateFinishedMatchPlayer(player) {
  if (!isPlainObject(player)) {
    return 'Each player must be an object';
  }

  const userIdError = validateRequiredNonEmptyString(
    player.userId,
    'Each player.userId is required',
  );
  if (userIdError) {
    return userIdError;
  }

  if (player.result !== 'win' && player.result !== 'loss') {
    return "Each player.result must be one of: 'win', 'loss'";
  }

  return null;
}

function validateFinishedMatchPayload(payload) {
  if (!isPlainObject(payload)) {
    return 'Body must be a JSON object';
  }

  const gameIdError = validateRequiredNonEmptyString(payload.gameId, 'gameId is required');
  if (gameIdError) return gameIdError;

  if (!Array.isArray(payload.players) || payload.players.length === 0) {
    return 'players must be a non-empty array';
  }

  const finalBoardError = validateOptionalObject(payload.finalBoard, 'finalBoard must be an object');
  if (finalBoardError) return finalBoardError;

  const botIdError = validateOptionalString(payload.botId, 'botId must be a string');
  if (botIdError) return botIdError;

  for (const player of payload.players) {
    const playerError = validateFinishedMatchPlayer(player);
    if (playerError) return playerError;
  }

  return null;
}

function buildStatsIncrement(result) {
  return {
    totalGames: 1,
    victories: result === 'win' ? 1 : 0,
    defeats: result === 'loss' ? 1 : 0,
  };
}

function sanitizeCount(value) {
  const num = Number(value ?? 0);

  if (!Number.isFinite(num) || num < 0) {
    return 0;
  }

  return Math.floor(num);
}

function normalizeStats(statsDoc, userId) {
  const stats = statsDoc ?? {};

  // Compatibilidad con nombres antiguos
  const totalGames = stats.totalGames ?? stats.gamesPlayed;
  const victories = stats.victories ?? stats.wins;
  const defeats = stats.defeats ?? stats.losses;

  return {
    userId,
    totalGames: sanitizeCount(totalGames),
    victories: sanitizeCount(victories),
    defeats: sanitizeCount(defeats),
    updatedAt: stats.updatedAt ?? null,
  };
}

function toOptionalString(value) {
  return typeof value === 'string' ? value : null;
}

function toOptionalObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value;
}

function requireUserIdHeader(req, res, next) {
  const userId = readUserIdFromHeader(req);

  if (!userId) {
    return res.status(401).json({ message: 'Missing x-user-id header' });
  }

  req.userId = userId;
  next();
}

// --- Conexion a Mongo e indices ---

async function connectToMongo({
  mongoUrl = MONGO_URL,
  mongoDbName = MONGO_DB_NAME,
  mongoClientFactory = (url) => new MongoClient(url),
} = {}) {
  const mongoClient = mongoClientFactory(mongoUrl);
  await mongoClient.connect();

  const db = mongoClient.db(mongoDbName);
  const playerStatsCollection = db.collection('player_stats');
  const playerMatchesCollection = db.collection('player_matches');

  await Promise.all([
    playerStatsCollection.createIndex({ userId: 1 }, { unique: true }),
    playerMatchesCollection.createIndex({ gameId: 1, userId: 1 }, { unique: true }),
    playerMatchesCollection.createIndex({ userId: 1, endedAt: -1 }),
    playerMatchesCollection.createIndex({ userId: 1, result: 1, endedAt: -1 }),
    playerMatchesCollection.createIndex({ userId: 1, mode: 1, endedAt: -1 }),
    playerMatchesCollection.createIndex({ userId: 1, botId: 1, endedAt: -1 }),
    playerMatchesCollection.createIndex({ userId: 1, winnerId: 1, endedAt: -1 }),
  ]);

  return {
    mongoClient,
    playerStatsCollection,
    playerMatchesCollection,
  };
}

function createApp({ internalToken = INTERNAL_TOKEN, playerStatsCollection, playerMatchesCollection }) {
  if (!playerStatsCollection || !playerMatchesCollection) {
    throw new Error('Stats collections are required to create the app');
  }

  const app = express();
  const metrics = createPrometheusMetrics({ serviceName: 'stats' });

  app.use(metrics.middleware);
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'stats' });
  });

  app.get('/metrics', metrics.handler);

  function requireServiceToken(req, res, next) {
    const token = req.get('x-service-token');

    if (token !== internalToken) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    next();
  }

  // --- Rutas publicas de lectura ---

  app.get('/v1/me', requireUserIdHeader, async (req, res) => {
    try {
      const statsDoc = await playerStatsCollection.findOne(
        { userId: req.userId },
        { projection: { _id: 0 } },
      );

      return res.json(normalizeStats(statsDoc, req.userId));
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get('/v1/me/history', requireUserIdHeader, async (req, res) => {
    try {
      const limit = parseLimit(req.query.limit, 20, 100);
      const historyQuery = buildHistoryQuery({ userId: req.userId, rawQuery: req.query });

      if (historyQuery.error) {
        return res.status(400).json({ message: historyQuery.error });
      }

      const history = await playerMatchesCollection
        .find(historyQuery.filter, { projection: { _id: 0 } })
        .sort(historyQuery.sort)
        .limit(limit)
        .toArray();

      return res.json({
        userId: req.userId,
        count: history.length,
        items: history,
      });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  });

  // --- Ruta interna: guardar final de partida y actualizar stats ---

  app.post('/internal/v1/matches/finished', requireServiceToken, async (req, res) => {
    // Paso 1: validar entrada
    const validationError = validateFinishedMatchPayload(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    // Paso 2: extraer datos comunes de la partida
    const gameId = req.body.gameId.trim();
    const players = req.body.players;
    const endedAt = req.body.endedAt ? new Date(req.body.endedAt) : new Date();
    const mode = toOptionalString(req.body.mode);
    const reason = toOptionalString(req.body.reason);
    const winnerId = toOptionalString(req.body.winnerId);
    const botId = toOptionalString(req.body.botId);
    const finalBoard = toOptionalObject(req.body.finalBoard);

    if (Number.isNaN(endedAt.getTime())) {
      return res.status(400).json({ message: 'endedAt must be a valid date' });
    }

    let created = 0;
    let duplicates = 0;

    try {
      // Paso 3: procesar cada jugador de la partida
      for (const player of players) {
        const userId = player.userId.trim();
        const result = player.result;

        // 3.1 Guardar partida del jugador (solo si no existia)
        const matchFilter = { gameId, userId };
        const matchOnInsert = {
          gameId,
          userId,
          result,
          mode,
          botId,
          reason,
          winnerId,
          finalBoard,
          endedAt,
          createdAt: new Date(),
        };

        let isDuplicate = false;

        try {
          const dbResult = await playerMatchesCollection.updateOne(
            matchFilter,
            { $setOnInsert: matchOnInsert },
            { upsert: true },
          );

          isDuplicate = dbResult.upsertedCount === 0;
        } catch (error) {
          if (error?.code === 11000) {
            isDuplicate = true;
          } else {
            throw error;
          }
        }

        if (isDuplicate) {
          duplicates += 1;
          continue;
        }

        // 3.2 Si la partida es nueva, actualizar contadores de stats
        created += 1;

        await playerStatsCollection.updateOne(
          { userId },
          {
            $setOnInsert: {
              userId,
            },
            $set: { updatedAt: new Date() },
            $unset: {
              gamesPlayed: '',
              wins: '',
              losses: '',
              draws: '',
            },
            $inc: buildStatsIncrement(result),
          },
          { upsert: true },
        );
      }

      // Paso 4: devolver resumen del procesamiento
      return res.status(202).json({
        gameId,
        processed: players.length,
        created,
        duplicates,
      });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  });

  return app;
}

// --- Arranque del servicio ---

async function start({
  port = DEFAULT_PORT,
  mongoUrl = MONGO_URL,
  mongoDbName = MONGO_DB_NAME,
  internalToken = INTERNAL_TOKEN,
  connect = connectToMongo,
  onStartError = (error) => {
    console.error('Failed to start stats service', error);
    process.exit(1);
  },
} = {}) {
  try {
    const { mongoClient, playerStatsCollection, playerMatchesCollection } = await connect({
      mongoUrl,
      mongoDbName,
    });

    const app = createApp({
      internalToken,
      playerStatsCollection,
      playerMatchesCollection,
    });

    const server = app.listen(port, () => {
      console.log(`Stats Service listening at http://localhost:${port}`);
    });

    return { app, server, mongoClient };
  } catch (error) {
    onStartError(error);
  }

  return null;
}

if (require.main?.filename === __filename) {
  start();
}

module.exports = {
  buildStatsIncrement,
  buildHistoryQuery,
  connectToMongo,
  createApp,
  normalizeStats,
  parseLimit,
  readUserIdFromHeader,
  sanitizeCount,
  start,
  toOptionalObject,
  toOptionalString,
  validateFinishedMatchPayload,
};
