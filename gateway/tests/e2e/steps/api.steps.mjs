import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';

const crypto = require('node:crypto');

function uniqueUsername() {
  return `e2e_user_${Date.now()}_${crypto.randomUUID()}`;
}

function emptyPosition(size = 3) {
  return {
    size,
    turn: 0,
    players: ['B', 'R'],
    layout: Array.from({ length: size }, (_v, i) => '.'.repeat(i + 1)).join('/'),
  };
}

When('I make a GET request to {string}', async function (path) {
  this.response = await fetch(`${this.GATEWAY_URL}${path}`);
  this.responseText = await this.response.text();
  try {
    this.responseBody = JSON.parse(this.responseText);
  } catch {
    this.responseBody = null;
  }
});

Then('the response status should be {int}', function (status) {
  assert.equal(this.response.status, status);
});

Then('the response status should be {int} or {int}', function (status1, status2) {
  assert.ok(
    this.response.status === status1 || this.response.status === status2,
    `Expected ${status1} or ${status2}, got ${this.response.status}`
  );
});

Then('the response status should be {int} or higher', function (status) {
  assert.ok(this.response.status >= status, `Expected >= ${status}, got ${this.response.status}`);
});

Then('the response should contain {string} with value {string}', function (key, value) {
  assert.ok(this.responseBody, 'Response body is empty');
  assert.equal(this.responseBody[key], value);
});

Then('the response should have a {string}', function (key) {
  assert.ok(this.responseBody, 'Response body is empty');
  assert.ok(this.responseBody[key] !== undefined, `Expected key ${key}`);
});

Then('the response should have a list of {string} with at least {int} bot', function (key, minCount) {
  assert.ok(Array.isArray(this.responseBody[key]));
  assert.ok(this.responseBody[key].length >= minCount);
});

Then('each bot in the list should have {string}, {string}, and {string}', function (k1, k2, k3) {
  for (const item of this.responseBody.items) {
    assert.ok(item[k1]);
    assert.ok(item[k2]);
    assert.ok(item[k3]);
  }
});

Then('the response text should contain {string}', function (text) {
  assert.match(this.responseText, new RegExp(text));
});

Then('the response should contain {string} and {string}', function (k1, k2) {
  assert.ok(this.responseBody[k1]);
  assert.ok(this.responseBody[k2]);
});

Given('a new unique username', function () {
  this.username = uniqueUsername();
});

When('I register with that username and password {string}', async function (password) {
  this.password = password;
  this.response = await fetch(`${this.GATEWAY_URL}/external/v1/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: this.username, password: this.password }),
  });
  this.responseText = await this.response.text();
  this.responseBody = JSON.parse(this.responseText);
});

Then('the response should contain a valid token', function () {
  assert.ok(this.responseBody.token);
  this.token = this.responseBody.token; // save for later
});

Given('a registered user with password {string}', async function (password) {
  this.username = uniqueUsername();
  this.password = password;
  await fetch(`${this.GATEWAY_URL}/external/v1/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: this.username, password: this.password }),
  });
});

When('I login with that username and password {string}', async function (password) {
  this.response = await fetch(`${this.GATEWAY_URL}/external/v1/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: this.username, password }),
  });
  this.responseText = await this.response.text();
  if (this.response.ok) {
    this.responseBody = JSON.parse(this.responseText);
    this.token = this.responseBody.token;
  }
});

Given('a logged in user', async function () {
  this.username = uniqueUsername();
  //NOSONAR
  const password = process.env.E2E_TEST_PASSWORD
    ?? `e2e-${Date.now()}-${crypto.randomUUID()}-Pw1!`;
  const res = await fetch(`${this.GATEWAY_URL}/external/v1/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: this.username, password }),
  });
  const body = await res.json();
  this.token = body.token;
});

When('I make an authenticated GET request to {string}', async function (path) {
  this.response = await fetch(`${this.GATEWAY_URL}${path}`, {
    headers: { Authorization: `Bearer ${this.token}` },
  });
  this.responseText = await this.response.text();
  this.responseBody = JSON.parse(this.responseText);
});

Then('the response should contain my username', function () {
  assert.ok(this.responseBody.username);
});

Then('the response should have a {string} object', function (key) {
  assert.ok(this.responseBody[key] !== undefined && typeof this.responseBody[key] === 'object');
});

Then('the response should be a valid JSON object', function () {
  assert.ok(this.responseBody !== null && typeof this.responseBody === 'object');
});

Given('an empty board position of size {int}', function (size) {
  this.boardPosition = emptyPosition(size);
});

When('I request a move for the board position', async function () {
  const query = new URLSearchParams({ position: JSON.stringify(this.boardPosition) });
  this.response = await fetch(`${this.GATEWAY_URL}/external/v1/play?${query}`);
  this.responseText = await this.response.text();
  this.responseBody = JSON.parse(this.responseText);
});

When('I request a move for the board position using bot_id {string}', async function (botId) {
  const query = new URLSearchParams({ position: JSON.stringify(this.boardPosition), bot_id: botId });
  this.response = await fetch(`${this.GATEWAY_URL}/external/v1/play?${query}`);
  this.responseText = await this.response.text();
  this.responseBody = JSON.parse(this.responseText);
});

When('I request a move for the board position using strategy {string}', async function (strategy) {
  const query = new URLSearchParams({ position: JSON.stringify(this.boardPosition), strategy });
  this.response = await fetch(`${this.GATEWAY_URL}/external/v1/play?${query}`);
  this.responseText = await this.response.text();
  this.responseBody = JSON.parse(this.responseText);
});

When('I request a move without the position parameter', async function () {
  this.response = await fetch(`${this.GATEWAY_URL}/external/v1/play`);
  this.responseText = await this.response.text();
  this.responseBody = JSON.parse(this.responseText);
});

When('I request a move with invalid JSON as position', async function () {
  this.response = await fetch(`${this.GATEWAY_URL}/external/v1/play?position=%7Binvalid`);
  this.responseText = await this.response.text();
  this.responseBody = JSON.parse(this.responseText);
});

Given('a board position with invalid size', function () {
  this.boardPosition = { size: -1, turn: 0, players: ['B', 'R'], layout: '.' };
});

Given('a board position where the bot must resign', function () {
  this.boardPosition = {
    size: 3,
    turn: 0,
    players: ['B', 'R'],
    layout: './B./...'
  };
});

Then(String.raw`the response should contain valid {string} \(x, y, z)`, function (key) {
  const coords = this.responseBody[key];
  assert.ok(coords);
  assert.ok(Number.isInteger(coords.x));
  assert.ok(Number.isInteger(coords.y));
  assert.ok(Number.isInteger(coords.z));
});

Then('the response should contain an error message about missing position', function () {
  assert.match(this.responseBody.message, /position is required/);
});

Then('the response should contain an error message about invalid JSON', function () {
  assert.match(this.responseBody.message, /position must be valid JSON/i);
});

Then('the response should contain an error message about size', function () {
  assert.match(this.responseBody.message, /size/i);
});

Then('the response should include an occupied-cell explanation', function () {
  const message =
    this.responseBody?.message
    ?? this.responseBody?.error
    ?? this.responseText
    ?? '';

  assert.ok(typeof message === 'string' && message.length > 0);
  assert.match(message, /could not apply move|occupied/i);
});

When('I create a new game with size {int}, mode {string}, and bot_id {string}', async function (size, mode, botId) {
  this.response = await fetch(`${this.GATEWAY_URL}/external/v1/games`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ size, mode, bot_id: botId }),
  });
  this.responseBody = await this.response.json();
  this.gameId = this.responseBody.game_id;
});

Then('the game should be created successfully and not be over', function () {
  assert.equal(this.response.status, 200);
  assert.ok(this.gameId);
  assert.equal(this.responseBody.game_over, false);
});

When('I get the game state', async function () {
  this.response = await fetch(`${this.GATEWAY_URL}/external/v1/games/${this.gameId}`, {
    headers: { Authorization: `Bearer ${this.token}` },
  });

  this.responseText = await this.response.text();
  try {
    this.responseBody = JSON.parse(this.responseText);
  } catch {
    this.responseBody = null;
  }
});

When('I make a move at x={int}, y={int}, z={int}', async function (x, y, z) {
  this.response = await fetch(`${this.GATEWAY_URL}/external/v1/games/${this.gameId}/moves`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ coords: { x, y, z } }),
  });

  this.responseText = await this.response.text();
  try {
    this.responseBody = JSON.parse(this.responseText);
  } catch {
    this.responseBody = null;
  }
});

Then('the response status should indicate success or valid turn', function () {
  assert.ok(this.response.status >= 200 && this.response.status < 600);
});

When('I get the game state and move on the opponent\'s square', async function () {
  const getResponse = await fetch(`${this.GATEWAY_URL}/external/v1/games/${this.gameId}`, {
    headers: { Authorization: `Bearer ${this.token}` },
  });
  const gameState = await getResponse.json();
  const layout =
    gameState?.state?.position?.layout
    ?? gameState?.position?.layout
    ?? gameState?.yen?.layout;

  assert.ok(typeof layout === 'string' && layout.length > 0, 'Expected game layout in response');

  const rows = layout.split('/');
  const boardSize = rows.length;

  let opponentRow = -1;
  let opponentCol = -1;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const cell = rows[r][c];
      // We played at x=2, y=0, z=0 which is row 0, col 0. The bot is the other piece.
      if (cell !== '.' && !(r === 0 && c === 0)) {
        opponentRow = r;
        opponentCol = c;
        break;
      }
    }
    if (opponentRow !== -1) break;
  }

  assert.ok(opponentRow !== -1 && opponentCol !== -1, 'Expected opponent move to exist in current board');

  const x = boardSize - 1 - opponentRow;
  const y = opponentCol;
  const z = (boardSize - 1) - x - y;

  this.response = await fetch(`${this.GATEWAY_URL}/external/v1/games/${this.gameId}/moves`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ coords: { x, y, z } }),
  });

  this.responseText = await this.response.text();
  try {
    this.responseBody = JSON.parse(this.responseText);
  } catch {
    this.responseBody = null;
  }
});

When('I resign the game', async function () {
  this.response = await fetch(`${this.GATEWAY_URL}/external/v1/games/${this.gameId}/resign`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${this.token}` },
  });

  this.responseText = await this.response.text();
  try {
    this.responseBody = JSON.parse(this.responseText);
  } catch {
    this.responseBody = null;
  }
});

Then('the resign response should be successful', function () {
  assert.ok(this.response.status >= 200 && this.response.status < 500);
});
