const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');

const {
  buildStatsIncrement,
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
} = require('./stats-service');

function createInMemoryCollections() {
  const statsByUser = new Map();
  const matchesByGameAndUser = new Map();

  const playerStatsCollection = {
    async findOne(filter) {
      const doc = statsByUser.get(filter.userId);
      return doc ? structuredClone(doc) : null;
    },

    async updateOne(filter, update) {
      const userId = filter.userId;
      const exists = statsByUser.has(userId);
      const doc = exists ? structuredClone(statsByUser.get(userId)) : {};

      if (!exists && update.$setOnInsert) {
        Object.assign(doc, structuredClone(update.$setOnInsert));
      }

      if (update.$set) {
        Object.assign(doc, structuredClone(update.$set));
      }

      if (update.$unset) {
        for (const field of Object.keys(update.$unset)) {
          delete doc[field];
        }
      }

      if (update.$inc) {
        for (const [field, increment] of Object.entries(update.$inc)) {
          doc[field] = Number(doc[field] ?? 0) + Number(increment);
        }
      }

      statsByUser.set(userId, doc);
      return { upsertedCount: exists ? 0 : 1 };
    },
  };

  const playerMatchesCollection = {
    async updateOne(filter, update) {
      const key = `${filter.gameId}::${filter.userId}`;

      if (matchesByGameAndUser.has(key)) {
        return { upsertedCount: 0 };
      }

      const toInsert = structuredClone(update.$setOnInsert ?? {});
      matchesByGameAndUser.set(key, toInsert);
      return { upsertedCount: 1 };
    },

    find(filter) {
      let rows = [...matchesByGameAndUser.values()]
        .filter((item) => item.userId === filter.userId)
        .map((item) => structuredClone(item));

      return {
        sort(sortSpec) {
          if (sortSpec.endedAt === -1) {
            rows.sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt));
          }
          return this;
        },

        limit(limitValue) {
          rows = rows.slice(0, limitValue);
          return this;
        },

        async toArray() {
          return rows;
        },
      };
    },
  };

  return { playerStatsCollection, playerMatchesCollection };
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

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return { status: response.status, body };
}

function finishedMatchPayload(gameId = 'game-1') {
  return {
    gameId,
    endedAt: '2026-03-03T10:00:00.000Z',
    mode: 'human_vs_human',
    winnerId: 'alice',
    players: [
      { userId: 'alice', result: 'win' },
      { userId: 'bob', result: 'loss' },
    ],
    finalBoard: {
      size: 3,
      turn: 0,
      players: ['B', 'R'],
      layout: 'B/R./...',
    },
  };
}

// parseLimit handles defaults and max cap.
test('parseLimit handles defaults and max cap', () => {
  assert.equal(parseLimit('invalid'), 20);
  assert.equal(parseLimit('0'), 20);
  assert.equal(parseLimit('15'), 15);
  assert.equal(parseLimit('300', 20, 100), 100);
});

// readUserIdFromHeader trims values and rejects missing header.
test('readUserIdFromHeader trims values and rejects missing header', () => {
  assert.equal(
    readUserIdFromHeader({ get: (name) => (name === 'x-user-id' ? '  user-1  ' : null) }),
    'user-1',
  );
  assert.equal(readUserIdFromHeader({ get: () => '   ' }), null);
  assert.equal(readUserIdFromHeader({ get: () => undefined }), null);
});

// validateFinishedMatchPayload checks required fields.
test('validateFinishedMatchPayload checks required fields', () => {
  assert.equal(validateFinishedMatchPayload(null), 'Body must be a JSON object');
  assert.equal(validateFinishedMatchPayload({ players: [] }), 'gameId is required');
  assert.equal(validateFinishedMatchPayload({ gameId: 'g1', players: [] }), 'players must be a non-empty array');
  assert.equal(
    validateFinishedMatchPayload({
      gameId: 'g1',
      players: [{ userId: '', result: 'win' }],
    }),
    'Each player.userId is required',
  );
  assert.equal(
    validateFinishedMatchPayload({
      gameId: 'g1',
      players: [{ userId: 'u1', result: 'draw' }],
    }),
    "Each player.result must be one of: 'win', 'loss'",
  );
  assert.equal(
    validateFinishedMatchPayload({
      gameId: 'g1',
      players: [{ userId: 'u1', result: 'win' }],
      finalBoard: [],
    }),
    'finalBoard must be an object',
  );
  assert.equal(
    validateFinishedMatchPayload({
      gameId: 'g1',
      players: [{ userId: 'u1', result: 'win' }],
      finalBoard: { size: 3 },
    }),
    null,
  );
});

// stats helper functions normalize and sanitize values.
test('stats helper functions normalize and sanitize values', () => {
  assert.deepEqual(buildStatsIncrement('win'), { totalGames: 1, victories: 1, defeats: 0 });
  assert.deepEqual(buildStatsIncrement('loss'), { totalGames: 1, victories: 0, defeats: 1 });

  assert.equal(sanitizeCount(-2), 0);
  assert.equal(sanitizeCount('3.8'), 3);

  assert.equal(toOptionalString('mode'), 'mode');
  assert.equal(toOptionalString(10), null);
  assert.equal(toOptionalObject({ value: 1 }).value, 1);
  assert.equal(toOptionalObject([]), null);

  assert.deepEqual(
    normalizeStats(
      {
        gamesPlayed: 4,
        wins: 2,
        losses: 1,
      },
      'player-x',
    ),
    {
      userId: 'player-x',
      totalGames: 4,
      victories: 2,
      defeats: 1,
      updatedAt: null,
    },
  );
});

// createApp requires injected collections.
test('createApp requires injected collections', () => {
  assert.throws(() => createApp({}), /Stats collections are required/);
});

// connectToMongo builds collections and indexes with injected client.
test('connectToMongo builds collections and indexes with injected client', async () => {
  const createIndexCalls = [];

  const fakeCollections = {
    player_stats: {
      async createIndex(index, options) {
        createIndexCalls.push({ collection: 'player_stats', index, options });
      },
    },
    player_matches: {
      async createIndex(index, options) {
        createIndexCalls.push({ collection: 'player_matches', index, options });
      },
    },
  };

  const fakeClient = {
    connected: false,
    async connect() {
      this.connected = true;
    },
    db(name) {
      assert.equal(name, 'stats_test_db');
      return {
        collection(collectionName) {
          return fakeCollections[collectionName];
        },
      };
    },
  };

  const result = await connectToMongo({
    mongoUrl: 'mongodb://fake-host:27017',
    mongoDbName: 'stats_test_db',
    mongoClientFactory: (url) => {
      assert.equal(url, 'mongodb://fake-host:27017');
      return fakeClient;
    },
  });

  assert.equal(result.mongoClient, fakeClient);
  assert.equal(fakeClient.connected, true);
  assert.equal(createIndexCalls.length, 3);
});

// start returns app and server when connect succeeds.
test('start returns app and server when connect succeeds', async () => {
  const collections = createInMemoryCollections();

  const started = await start({
    port: 0,
    internalToken: 'test-token',
    connect: async () => ({
      mongoClient: { id: 'fake-mongo' },
      ...collections,
    }),
  });

  assert.ok(started);
  assert.equal(started.mongoClient.id, 'fake-mongo');
  assert.ok(started.server);

  await new Promise((resolve) => started.server.close(resolve));
});

// start calls onStartError when connect fails.
test('start calls onStartError when connect fails', async () => {
  let capturedError = null;

  const result = await start({
    connect: async () => {
      throw new Error('connect failed');
    },
    onStartError: (error) => {
      capturedError = error;
    },
  });

  assert.equal(result, null);
  assert.equal(capturedError.message, 'connect failed');
});

// rejects match persistence without internal token.
test('rejects match persistence without internal token', async () => {
  const collections = createInMemoryCollections();
  const app = createApp({ internalToken: 'test-token', ...collections });

  await withServer(app, async (baseUrl) => {
    const response = await requestJson(baseUrl, '/internal/v1/matches/finished', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(finishedMatchPayload()),
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.message, 'Unauthorized');
  });
});

// stores a finished match and exposes stats/history.
test('stores a finished match and exposes stats/history', async () => {
  const collections = createInMemoryCollections();
  const app = createApp({ internalToken: 'test-token', ...collections });

  await withServer(app, async (baseUrl) => {
    const save = await requestJson(baseUrl, '/internal/v1/matches/finished', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-service-token': 'test-token',
      },
      body: JSON.stringify(finishedMatchPayload()),
    });

    assert.equal(save.status, 202);
    assert.equal(save.body.gameId, 'game-1');
    assert.equal(save.body.created, 2);
    assert.equal(save.body.duplicates, 0);

    const aliceStats = await requestJson(baseUrl, '/v1/me', {
      headers: { 'x-user-id': 'alice' },
    });

    assert.equal(aliceStats.status, 200);
    assert.equal(aliceStats.body.userId, 'alice');
    assert.equal(aliceStats.body.totalGames, 1);
    assert.equal(aliceStats.body.victories, 1);
    assert.equal(aliceStats.body.defeats, 0);

    const history = await requestJson(baseUrl, '/v1/me/history?limit=5', {
      headers: { 'x-user-id': 'alice' },
    });

    assert.equal(history.status, 200);
    assert.equal(history.body.userId, 'alice');
    assert.equal(history.body.count, 1);
    assert.equal(history.body.items[0].gameId, 'game-1');
    assert.equal(history.body.items[0].result, 'win');
    assert.equal(history.body.items[0].winnerId, 'alice');
  });
});

// returns zeroed stats for users without matches.
test('returns zeroed stats for users without matches', async () => {
  const collections = createInMemoryCollections();
  const app = createApp({ internalToken: 'test-token', ...collections });

  await withServer(app, async (baseUrl) => {
    const response = await requestJson(baseUrl, '/v1/me', {
      headers: { 'x-user-id': 'new-user' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.totalGames, 0);
    assert.equal(response.body.victories, 0);
    assert.equal(response.body.defeats, 0);
  });
});

// does not increment stats when the same game result is reported twice.
test('does not increment stats when the same game result is reported twice', async () => {
  const collections = createInMemoryCollections();
  const app = createApp({ internalToken: 'test-token', ...collections });
  const payload = finishedMatchPayload('game-duplicate');

  await withServer(app, async (baseUrl) => {
    await requestJson(baseUrl, '/internal/v1/matches/finished', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-service-token': 'test-token',
      },
      body: JSON.stringify(payload),
    });

    const secondSave = await requestJson(baseUrl, '/internal/v1/matches/finished', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-service-token': 'test-token',
      },
      body: JSON.stringify(payload),
    });

    assert.equal(secondSave.status, 202);
    assert.equal(secondSave.body.created, 0);
    assert.equal(secondSave.body.duplicates, 2);

    const aliceStats = await requestJson(baseUrl, '/v1/me', {
      headers: { 'x-user-id': 'alice' },
    });

    assert.equal(aliceStats.body.totalGames, 1);
    assert.equal(aliceStats.body.victories, 1);
    assert.equal(aliceStats.body.defeats, 0);
  });
});

// accepts Mongo duplicate-key errors as duplicates during match save.
test('accepts Mongo duplicate-key errors as duplicates during match save', async () => {
  const collections = createInMemoryCollections();
  let shouldThrowDuplicate = true;

  const app = createApp({
    internalToken: 'test-token',
    playerStatsCollection: collections.playerStatsCollection,
    playerMatchesCollection: {
      async updateOne() {
        if (shouldThrowDuplicate) {
          throw { code: 11000 };
        }
        return { upsertedCount: 1 };
      },
      find: collections.playerMatchesCollection.find,
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await requestJson(baseUrl, '/internal/v1/matches/finished', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-service-token': 'test-token',
      },
      body: JSON.stringify(finishedMatchPayload('game-dup-key')),
    });

    assert.equal(response.status, 202);
    assert.equal(response.body.created, 0);
    assert.equal(response.body.duplicates, 2);

    shouldThrowDuplicate = false;
  });
});

// returns 400 for invalid finished match payload.
test('returns 400 for invalid finished match payload', async () => {
  const collections = createInMemoryCollections();
  const app = createApp({ internalToken: 'test-token', ...collections });

  await withServer(app, async (baseUrl) => {
    const response = await requestJson(baseUrl, '/internal/v1/matches/finished', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-service-token': 'test-token',
      },
      body: JSON.stringify({ gameId: 'g1', players: [] }),
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.message, 'players must be a non-empty array');
  });
});

// validates endedAt format when persisting a finished match.
test('validates endedAt format when persisting a finished match', async () => {
  const collections = createInMemoryCollections();
  const app = createApp({ internalToken: 'test-token', ...collections });

  const invalidPayload = finishedMatchPayload('game-invalid-date');
  invalidPayload.endedAt = 'not-a-date';

  await withServer(app, async (baseUrl) => {
    const response = await requestJson(baseUrl, '/internal/v1/matches/finished', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-service-token': 'test-token',
      },
      body: JSON.stringify(invalidPayload),
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.message, 'endedAt must be a valid date');
  });
});

// returns 500 if collections fail while saving a finished match.
test('returns 500 if collections fail while saving a finished match', async () => {
  const app = createApp({
    internalToken: 'test-token',
    playerStatsCollection: {
      async updateOne() {
        return { upsertedCount: 1 };
      },
    },
    playerMatchesCollection: {
      async updateOne() {
        throw new Error('match update failed');
      },
      find() {
        return {
          sort() {
            return this;
          },
          limit() {
            return this;
          },
          async toArray() {
            return [];
          },
        };
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await requestJson(baseUrl, '/internal/v1/matches/finished', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-service-token': 'test-token',
      },
      body: JSON.stringify(finishedMatchPayload('game-fail')),
    });

    assert.equal(response.status, 500);
    assert.equal(response.body.message, 'match update failed');
  });
});

// returns 500 if stats query fails.
test('returns 500 if stats query fails', async () => {
  const app = createApp({
    internalToken: 'test-token',
    playerStatsCollection: {
      async findOne() {
        throw new Error('stats read failed');
      },
      async updateOne() {
        return { upsertedCount: 1 };
      },
    },
    playerMatchesCollection: {
      async updateOne() {
        return { upsertedCount: 1 };
      },
      find() {
        return {
          sort() {
            return this;
          },
          limit() {
            return this;
          },
          async toArray() {
            return [];
          },
        };
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await requestJson(baseUrl, '/v1/me', {
      headers: { 'x-user-id': 'alice' },
    });

    assert.equal(response.status, 500);
    assert.equal(response.body.message, 'stats read failed');
  });
});

// returns 500 if history query fails.
test('returns 500 if history query fails', async () => {
  const app = createApp({
    internalToken: 'test-token',
    playerStatsCollection: {
      async findOne() {
        return null;
      },
      async updateOne() {
        return { upsertedCount: 1 };
      },
    },
    playerMatchesCollection: {
      async updateOne() {
        return { upsertedCount: 1 };
      },
      find() {
        throw new Error('history failed');
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await requestJson(baseUrl, '/v1/me/history', {
      headers: { 'x-user-id': 'alice' },
    });

    assert.equal(response.status, 500);
    assert.equal(response.body.message, 'history failed');
  });
});

// requires x-user-id header for /v1/me.
test('requires x-user-id header for /v1/me', async () => {
  const collections = createInMemoryCollections();
  const app = createApp({ internalToken: 'test-token', ...collections });

  await withServer(app, async (baseUrl) => {
    const response = await requestJson(baseUrl, '/v1/me');

    assert.equal(response.status, 401);
    assert.equal(response.body.message, 'Missing x-user-id header');
  });
});
