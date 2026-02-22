const express = require('express');
const { MongoClient } = require('mongodb');

const port = Number(process.env.PORT ?? 3001);
const mongoUrl = process.env.MONGO_URL ?? 'mongodb://localhost:27017';
const dbName = process.env.MONGO_DB_NAME ?? 'yovi_stats';
const internalToken = process.env.STATS_INTERNAL_TOKEN ?? 'stats-internal-token';

const app = express();
app.use(express.json());

let mongoClient;
let db;
let playerStatsCollection;
let playerMatchesCollection;

function parseLimit(raw, defaultValue = 20, maxValue = 100) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    return defaultValue;
  }
  return Math.min(value, maxValue);
}

function userIdFromHeader(req) {
  const userId = req.get('x-user-id');
  return typeof userId === 'string' && userId.trim().length > 0 ? userId.trim() : null;
}

function requireInternalToken(req, res, next) {
  const token = req.get('x-service-token');
  if (token !== internalToken) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
}

function requireUserHeader(req, res, next) {
  const userId = userIdFromHeader(req);
  if (!userId) {
    return res.status(401).json({ message: 'Missing x-user-id header' });
  }
  req.userId = userId;
  next();
}

function validateMatchPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Body must be a JSON object';
  }
  if (typeof payload.gameId !== 'string' || payload.gameId.trim().length === 0) {
    return 'gameId is required';
  }
  if (!Array.isArray(payload.players) || payload.players.length === 0) {
    return 'players must be a non-empty array';
  }
  const validResults = new Set(['win', 'loss', 'draw']);
  for (const player of payload.players) {
    if (!player || typeof player !== 'object') {
      return 'Each player must be an object';
    }
    if (typeof player.userId !== 'string' || player.userId.trim().length === 0) {
      return 'Each player.userId is required';
    }
    if (!validResults.has(player.result)) {
      return "Each player.result must be one of: 'win', 'loss', 'draw'";
    }
  }
  return null;
}

function toIncrement(result) {
  return {
    gamesPlayed: 1,
    wins: result === 'win' ? 1 : 0,
    losses: result === 'loss' ? 1 : 0,
    draws: result === 'draw' ? 1 : 0,
  };
}

async function connectToMongo() {
  mongoClient = new MongoClient(mongoUrl);
  await mongoClient.connect();
  db = mongoClient.db(dbName);
  playerStatsCollection = db.collection('player_stats');
  playerMatchesCollection = db.collection('player_matches');

  await Promise.all([
    playerStatsCollection.createIndex({ userId: 1 }, { unique: true }),
    playerStatsCollection.createIndex({ wins: -1, gamesPlayed: -1 }),
    playerMatchesCollection.createIndex({ gameId: 1, userId: 1 }, { unique: true }),
    playerMatchesCollection.createIndex({ userId: 1, endedAt: -1 }),
  ]);
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/v1/me', requireUserHeader, async (req, res) => {
  try {
    const stats = await playerStatsCollection.findOne(
      { userId: req.userId },
      { projection: { _id: 0 } },
    );

    if (!stats) {
      return res.json({
        userId: req.userId,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        updatedAt: null,
      });
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/v1/me/history', requireUserHeader, async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 20, 100);
    const history = await playerMatchesCollection
      .find({ userId: req.userId }, { projection: { _id: 0 } })
      .sort({ endedAt: -1 })
      .limit(limit)
      .toArray();

    res.json({ userId: req.userId, count: history.length, items: history });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/v1/leaderboard', async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 20, 100);
    const leaderboard = await playerStatsCollection
      .find({}, { projection: { _id: 0 } })
      .sort({ wins: -1, gamesPlayed: -1, updatedAt: 1 })
      .limit(limit)
      .toArray();

    res.json({ count: leaderboard.length, items: leaderboard });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/internal/v1/matches/finished', requireInternalToken, async (req, res) => {
  const validationError = validateMatchPayload(req.body);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const gameId = req.body.gameId.trim();
  const endedAt = req.body.endedAt ? new Date(req.body.endedAt) : new Date();
  const mode = typeof req.body.mode === 'string' ? req.body.mode : null;
  const reason = typeof req.body.reason === 'string' ? req.body.reason : null;
  const winnerId = typeof req.body.winnerId === 'string' ? req.body.winnerId : null;

  if (Number.isNaN(endedAt.getTime())) {
    return res.status(400).json({ message: 'endedAt must be a valid date' });
  }

  let created = 0;
  let duplicates = 0;

  try {
    for (const player of req.body.players) {
      const userId = player.userId.trim();
      const result = player.result;
      const matchFilter = { gameId, userId };
      const matchUpdate = {
        $setOnInsert: {
          gameId,
          userId,
          result,
          mode,
          reason,
          winnerId,
          endedAt,
          createdAt: new Date(),
        },
      };

      try {
        const upsertResult = await playerMatchesCollection.updateOne(matchFilter, matchUpdate, {
          upsert: true,
        });

        if (upsertResult.upsertedCount === 0) {
          duplicates += 1;
          continue;
        }
      } catch (error) {
        if (error && error.code === 11000) {
          duplicates += 1;
          continue;
        }
        throw error;
      }

      created += 1;
      await playerStatsCollection.updateOne(
        { userId },
        {
          $setOnInsert: { userId },
          $set: { updatedAt: new Date() },
          $inc: toIncrement(result),
        },
        { upsert: true },
      );
    }

    res.status(202).json({
      gameId,
      processed: req.body.players.length,
      created,
      duplicates,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

async function start() {
  try {
    await connectToMongo();
    app.listen(port, () => {
      console.log(`Stats Service listening at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start stats service', error);
    process.exit(1);
  }
}

start();
