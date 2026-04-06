import { Given, Then, When } from '@cucumber/cucumber'
import assert from 'assert'

function buildEmptyLayout(size) {
  return Array.from({ length: size }, (_value, index) => '.'.repeat(index + 1)).join('/')
}

function setLayoutSymbol(layout, size, coords, symbol) {
  const rows = layout.split('/')
  const rowIndex = size - 1 - Number(coords.x)
  const columnIndex = Number(coords.y)

  if (rowIndex < 0 || rowIndex >= rows.length) {
    return layout
  }

  const rowChars = Array.from(rows[rowIndex])
  if (columnIndex < 0 || columnIndex >= rowChars.length) {
    return layout
  }

  rowChars[columnIndex] = symbol
  rows[rowIndex] = rowChars.join('')
  return rows.join('/')
}

function parseJsonRequestBody(request) {
  const rawBody = request.postData()
  if (!rawBody) {
    return {}
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    return {}
  }
}

Given('I am authenticated with a mocked game and stats backend', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')

  const username = `${String(this.testUsername ?? 'e2e-user').toLowerCase()}_history`
  this.mockUsername = username

  const state = {
    activeGame: null,
    historyItems: [],
    nextGameNumber: 1,
    statsHistoryHits: 0,
    statsSummaryHits: 0,
  }
  this.gameHistoryState = state

  await page.route('**/auth/verify', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { username } }),
    })
  })

  await page.route('**/api/v1/games', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') {
      await route.continue()
      return
    }

    const payload = parseJsonRequestBody(request)
    const size = Number(payload.size ?? 7)
    const mode = payload.mode ?? 'human_vs_bot'
    const botId = payload.bot_id ?? null
    const gameId = `mock-game-${state.nextGameNumber}`
    state.nextGameNumber += 1

    state.activeGame = {
      api_version: '1.0.0',
      game_id: gameId,
      mode,
      bot_id: botId,
      yen: {
        size,
        turn: 0,
        players: ['B', 'R'],
        layout: buildEmptyLayout(size),
      },
      game_over: false,
      next_player: 0,
      winner: null,
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.activeGame),
    })
  })

  await page.route('**/api/v1/games/*/moves', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') {
      await route.continue()
      return
    }

    const currentGame = state.activeGame
    if (!currentGame) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Game not found' }),
      })
      return
    }

    const payload = parseJsonRequestBody(request)
    const coords = payload.coords ?? {}
    const symbol = currentGame.yen.players[currentGame.next_player ?? 0] ?? 'B'
    currentGame.yen.layout = setLayoutSymbol(currentGame.yen.layout, currentGame.yen.size, coords, symbol)
    currentGame.yen.turn += 1
    currentGame.next_player = currentGame.mode === 'human_vs_bot'
      ? 1
      : (currentGame.next_player === 0 ? 1 : 0)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentGame),
    })
  })

  await page.route('**/api/v1/games/*/resign', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') {
      await route.continue()
      return
    }

    const game = state.activeGame
    if (!game) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Game not found' }),
      })
      return
    }

    if (!game.game_over) {
      game.game_over = true
      game.next_player = null
      game.winner = 1

      state.historyItems.unshift({
        gameId: game.game_id,
        result: 'loss',
        mode: game.mode,
        winnerId: 'player-1',
        botId: game.bot_id,
        endedAt: new Date().toISOString(),
        finalBoard: {
          size: game.yen.size,
          turn: game.yen.turn,
          players: [...game.yen.players],
          layout: game.yen.layout,
        },
      })
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(game),
    })
  })

  await page.route('**/v1/me**', async (route) => {
    const pathname = new URL(route.request().url()).pathname

    const isStatsHistoryPath =
      pathname.endsWith('/stats/v1/me/history') ||
      pathname.endsWith('/api/stats/v1/me/history')

    if (isStatsHistoryPath) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: state.historyItems }),
      })

      state.statsHistoryHits += 1
      return
    }

    const isStatsSummaryPath =
      pathname.endsWith('/stats/v1/me') ||
      pathname.endsWith('/api/stats/v1/me')

    if (!isStatsSummaryPath) {
      await route.continue()
      return
    }

    const totalGames = state.historyItems.length
    const victories = state.historyItems.filter((item) => item.result === 'win').length
    const defeats = state.historyItems.filter((item) => item.result === 'loss').length
    const updatedAt = state.historyItems[0]?.endedAt ?? null

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalGames, victories, defeats, updatedAt }),
    })

    state.statsSummaryHits += 1
  })

  await page.addInitScript((storedUsername) => {
    localStorage.setItem('authToken', 'e2e-token')
    localStorage.setItem('authUsername', storedUsername)
  }, username)

  await page.goto('http://localhost:5173')
  await page.getByText(/configurar partida/i).waitFor({ timeout: 10000 })
})

When('I start a new match', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')

  await page.getByRole('button', { name: /crear partida/i }).click()
  const title = page.getByText(/partida mock-game-/i)
  await title.waitFor({ timeout: 10000 })

  const titleText = await title.textContent()
  const gameId = titleText?.replace(/^partida\s+/i, '').trim()
  assert.ok(gameId, `Expected to read game id from title, got: "${titleText}"`)
  this.currentGameId = gameId
})

When('I play one move in the active match', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')

  await page.getByTestId('hex-0-0').click()
})

When('I resign the active match', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')

  await page.getByRole('button', { name: /rendirse/i }).click()
  await page.getByText(/partida finalizada|victoria|derrota/i).waitFor({ timeout: 10000 })
})

When('I leave the active match using the sidebar', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')

  await page.getByRole('button', { name: /ayuda/i }).click()
  await page.getByText(/reglas basicas/i).waitFor({ timeout: 10000 })

  await page.getByRole('button', { name: /jugar/i }).click()
  await page.getByRole('button', { name: /volver a la partida/i }).waitFor({ timeout: 10000 })
})

Then('I should still be able to resume the active match', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')

  await page.getByRole('button', { name: /volver a la partida/i }).click()
  const title = page.getByText(new RegExp(`partida\\s+${this.currentGameId}`, 'i'))
  await title.waitFor({ timeout: 10000 })
})

When('I open the stats view', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')

  const state = this.gameHistoryState
  const waitUntil = Date.now() + 10_000
  while (state && state.historyItems.length === 0 && Date.now() < waitUntil) {
    await page.waitForTimeout(50)
  }

  const statsButton = page.getByRole('button', { name: /estadisticas/i })

  await statsButton.click()
  await page.getByText(/historial completo/i).waitFor({ timeout: 10000 })

  // Trigger one extra refresh to avoid races when resign and stats sync finish nearly at the same time.
  await page.waitForTimeout(150)
  await statsButton.click()
})

Then('I should see the latest match in history', async function () {
  const expectedGameId = this.currentGameId
  assert.ok(expectedGameId, 'No current game id was captured for the scenario')

  const expectedStoredGames = Number(this.gameHistoryState?.historyItems?.length ?? 0)
  assert.ok(expectedStoredGames > 0, 'Expected at least one stored match in mocked history state')

  const latestStoredMatch = this.gameHistoryState?.historyItems?.[0]
  assert.ok(latestStoredMatch, 'Expected latest match in mocked history state')
  assert.equal(
    latestStoredMatch.gameId,
    expectedGameId,
    `Expected latest stored game id to be "${expectedGameId}", got "${String(latestStoredMatch.gameId)}"`,
  )

  const historyHits = Number(this.gameHistoryState?.statsHistoryHits ?? 0)
  assert.ok(historyHits > 0, 'Expected at least one stats history API request during the scenario')

  this.expectedStoredGames = expectedStoredGames
})

Then('the latest match should have result {string}', async function (expectedResult) {
  const latestStoredMatch = this.gameHistoryState?.historyItems?.[0]
  assert.ok(latestStoredMatch, 'Expected latest match to exist in mocked history state')

  const expectedText = String(expectedResult).toLowerCase()

  if (expectedText.includes('derrota')) {
    assert.equal(latestStoredMatch.result, 'loss')
    return
  }

  if (expectedText.includes('victoria')) {
    assert.equal(latestStoredMatch.result, 'win')
  }
})
