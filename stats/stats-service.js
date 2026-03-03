const express = require('express');
const { MongoClient } = require('mongodb');

// 1) Configuracion basica
const PORT = Number(process.env.PORT ?? 3001);
const MONGO_URL = process.env.MONGO_URL ?? 'mongodb://localhost:27017';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME ?? 'yovi_stats';
const INTERNAL_TOKEN = process.env.STATS_INTERNAL_TOKEN ?? 'stats-internal-token';

const app = express();
app.use(express.json());

// 2) Referencias a Mongo
let mongoClient;
let db;
let playerStatsCollection;
let playerMatchesCollection;

// --- Helpers de validacion y normalizacion ---

function parseLimit(rawLimit, defaultValue = 20, maxValue = 100) {
  const parsed = Number(rawLimit);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.min(parsed, maxValue);
}

function readUserIdFromHeader(req) {
  const userId = req.get('x-user-id');

  if (typeof userId !== 'string') {
    return null;
  }

  const cleanUserId = userId.trim();
  return cleanUserId.length > 0 ? cleanUserId : null;
}

function requireServiceToken(req, res, next) {
  const token = req.get('x-service-token');

  if (token !== INTERNAL_TOKEN) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  next();
}

function requireUserIdHeader(req, res, next) {
  const userId = readUserIdFromHeader(req);

  if (!userId) {
    return res.status(401).json({ message: 'Missing x-user-id header' });
  }

  req.userId = userId;
  next();
}

function validateFinishedMatchPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Body must be a JSON object';
  }

  if (typeof payload.gameId !== 'string' || payload.gameId.trim().length === 0) {
    return 'gameId is required';
  }

  if (!Array.isArray(payload.players) || payload.players.length === 0) {
    return 'players must be a non-empty array';
  }

  if (payload.finalBoard !== undefined && payload.finalBoard !== null) {
    if (typeof payload.finalBoard !== 'object' || Array.isArray(payload.finalBoard)) {
      return 'finalBoard must be an object';
    }
  }

  for (const player of payload.players) {
    if (!player || typeof player !== 'object') {
      return 'Each player must be an object';
    }

    if (typeof player.userId !== 'string' || player.userId.trim().length === 0) {
      return 'Each player.userId is required';
    }

    if (player.result !== 'win' && player.result !== 'loss') {
      return "Each player.result must be one of: 'win', 'loss'";
    }
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

// --- Conexion a Mongo e indices ---

async function connectToMongo() {
  mongoClient = new MongoClient(MONGO_URL);
  await mongoClient.connect();

  db = mongoClient.db(MONGO_DB_NAME);
  playerStatsCollection = db.collection('player_stats');
  playerMatchesCollection = db.collection('player_matches');

  await Promise.all([
    playerStatsCollection.createIndex({ userId: 1 }, { unique: true }),
    playerMatchesCollection.createIndex({ gameId: 1, userId: 1 }, { unique: true }),
    playerMatchesCollection.createIndex({ userId: 1, endedAt: -1 }),
  ]);
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

    const history = await playerMatchesCollection
      .find({ userId: req.userId }, { projection: { _id: 0 } })
      .sort({ endedAt: -1 })
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
        if (error && error.code === 11000) {
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

// --- Arranque del servicio ---

async function start() {
  try {
    await connectToMongo();

    app.listen(PORT, () => {
      console.log(`Stats Service listening at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start stats service', error);
    process.exit(1);
  }
}

start();

