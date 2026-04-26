const assert = require('node:assert/strict')
const http = require('node:http')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const test = require('node:test')

const GATEWAY_DIR = path.resolve(__dirname, '..', '..')

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseRequestBody(rawBody) {
  if (!rawBody || rawBody.length === 0) {
    return null
  }

  return JSON.parse(rawBody)
}

async function getFreePort() {
  const server = http.createServer()
  server.listen(0)
  await once(server, 'listening')
  const { port } = server.address()
  await new Promise((resolve) => server.close(resolve))
  return port
}

async function startMockGameyService() {
  const calls = []

  const server = http.createServer(async (req, res) => {
    let rawBody = ''
    for await (const chunk of req) {
      rawBody += chunk
    }

    if (req.method === 'POST' && req.url?.startsWith('/v1/ybot/choose/')) {
      const botId = decodeURIComponent(req.url.replace('/v1/ybot/choose/', ''))
      calls.push({
        method: req.method,
        url: req.url,
        body: parseRequestBody(rawBody),
      })

      const coords = botId === 'greedy_bot'
        ? { x: 1, y: 1, z: 0 }
        : { x: 2, y: 0, z: 0 }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        api_version: 'v1',
        bot_id: botId,
        coords,
      }))
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'Not found' }))
  })

  server.listen(0)
  await once(server, 'listening')

  const { port } = server.address()

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    calls,
    async close() {
      server.closeIdleConnections?.()
      server.closeAllConnections?.()
      await new Promise((resolve) => server.close(resolve))
    },
  }
}

async function waitForGatewayReady(baseUrl, gateway, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (gateway.child.exitCode !== null) {
      throw new Error(
        [
          `Gateway exited early with code ${gateway.child.exitCode}`,
          'Captured stdout:',
          gateway.stdout,
          'Captured stderr:',
          gateway.stderr,
        ].join('\n'),
      )
    }

    try {
      const response = await fetch(`${baseUrl}/health`)
      if (response.status === 200) {
        return
      }
    } catch {
      // Keep retrying until timeout.
    }

    await delay(120)
  }

  throw new Error(
    [
      `Gateway did not become ready within ${timeoutMs}ms`,
      'Captured stdout:',
      gateway.stdout,
      'Captured stderr:',
      gateway.stderr,
    ].join('\n'),
  )
}

async function startGatewayProcess({ port, gameyUrl }) {
  const env = {
    ...process.env,
    PORT: String(port),
    GAMEY_SERVICE_URL: gameyUrl,
    HTTP_REDIRECT_ENABLED: 'false',
  }

  const child = spawn(process.execPath, ['gateway-service.js'], {
    cwd: GATEWAY_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''

  child.stdout?.on('data', (chunk) => {
    stdout += chunk.toString()
  })

  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  const gateway = {
    child,
    get stdout() {
      return stdout
    },
    get stderr() {
      return stderr
    },
    async stop() {
      if (child.exitCode !== null) {
        return
      }

      child.kill('SIGTERM')

      await Promise.race([
        once(child, 'exit'),
        (async () => {
          await delay(2_000)
          if (child.exitCode === null) {
            child.kill('SIGKILL')
            await once(child, 'exit')
          }
        })(),
      ])
    },
  }

  await waitForGatewayReady(`http://127.0.0.1:${port}`, gateway)

  return gateway
}

function buildYenPosition() {
  return {
    size: 3,
    turn: 0,
    players: ['B', 'R'],
    layout: './../...',
  }
}

test('GET /external/v1/play uses default bot and returns coords', async () => {
  let mockGamey
  let gateway

  try {
    mockGamey = await startMockGameyService()
    const gatewayPort = await getFreePort()
    gateway = await startGatewayProcess({ port: gatewayPort, gameyUrl: mockGamey.baseUrl })

    const query = new URLSearchParams({
      position: JSON.stringify(buildYenPosition()),
    })

    const response = await fetch(`http://127.0.0.1:${gatewayPort}/external/v1/play?${query.toString()}`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(body, {
      coords: { x: 2, y: 0, z: 0 },
    })

    assert.equal(mockGamey.calls.length, 1)
    assert.equal(mockGamey.calls[0].method, 'POST')
    assert.equal(mockGamey.calls[0].url, '/v1/ybot/choose/random_bot')
    assert.deepEqual(mockGamey.calls[0].body, buildYenPosition())
  } finally {
    if (gateway) await gateway.stop()
    if (mockGamey) await mockGamey.close()
  }
})

test('GET /external/v1/play forwards explicit bot_id to gamey', async () => {
  let mockGamey
  let gateway

  try {
    mockGamey = await startMockGameyService()
    const gatewayPort = await getFreePort()
    gateway = await startGatewayProcess({ port: gatewayPort, gameyUrl: mockGamey.baseUrl })

    const query = new URLSearchParams({
      position: JSON.stringify(buildYenPosition()),
      bot_id: 'greedy_bot',
    })

    const response = await fetch(`http://127.0.0.1:${gatewayPort}/external/v1/play?${query.toString()}`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(body, {
      coords: { x: 1, y: 1, z: 0 },
    })

    assert.equal(mockGamey.calls.length, 1)
    assert.equal(mockGamey.calls[0].url, '/v1/ybot/choose/greedy_bot')
    assert.deepEqual(mockGamey.calls[0].body, buildYenPosition())
  } finally {
    if (gateway) await gateway.stop()
    if (mockGamey) await mockGamey.close()
  }
})

test('GET /external/v1/play maps strategy to bot id before calling gamey', async () => {
  let mockGamey
  let gateway

  try {
    mockGamey = await startMockGameyService()
    const gatewayPort = await getFreePort()
    gateway = await startGatewayProcess({ port: gatewayPort, gameyUrl: mockGamey.baseUrl })

    const query = new URLSearchParams({
      position: JSON.stringify(buildYenPosition()),
      strategy: 'greedy',
    })

    const response = await fetch(`http://127.0.0.1:${gatewayPort}/external/v1/play?${query.toString()}`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(body, {
      coords: { x: 1, y: 1, z: 0 },
    })

    assert.equal(mockGamey.calls.length, 1)
    assert.equal(mockGamey.calls[0].url, '/v1/ybot/choose/greedy_bot')
    assert.deepEqual(mockGamey.calls[0].body, buildYenPosition())
  } finally {
    if (gateway) await gateway.stop()
    if (mockGamey) await mockGamey.close()
  }
})

test('GET /external/v1/play returns 400 when position contains invalid JSON', async () => {
  let mockGamey
  let gateway

  try {
    mockGamey = await startMockGameyService()
    const gatewayPort = await getFreePort()
    gateway = await startGatewayProcess({ port: gatewayPort, gameyUrl: mockGamey.baseUrl })

    const response = await fetch(`http://127.0.0.1:${gatewayPort}/external/v1/play?position=%7Binvalid`)
    const body = await response.json()

    assert.equal(response.status, 400)
    assert.deepEqual(body, {
      message: 'position must be valid JSON object in YEN format',
    })

    assert.equal(mockGamey.calls.length, 0)
  } finally {
    if (gateway) await gateway.stop()
    if (mockGamey) await mockGamey.close()
  }
})

test('GET /external/v1/play returns 400 when position is missing', async () => {
  let mockGamey
  let gateway

  try {
    mockGamey = await startMockGameyService()
    const gatewayPort = await getFreePort()
    gateway = await startGatewayProcess({ port: gatewayPort, gameyUrl: mockGamey.baseUrl })

    const response = await fetch(`http://127.0.0.1:${gatewayPort}/external/v1/play`)
    const body = await response.json()

    assert.equal(response.status, 400)
    assert.deepEqual(body, {
      message: 'position is required',
    })

    assert.equal(mockGamey.calls.length, 0)
  } finally {
    if (gateway) await gateway.stop()
    if (mockGamey) await mockGamey.close()
  }
})

test('GET /external/v1/play returns 502 when gamey service is unavailable', async () => {
  let gateway

  try {
    const gatewayPort = await getFreePort()
    gateway = await startGatewayProcess({ port: gatewayPort, gameyUrl: 'http://127.0.0.1:1' })

    const query = new URLSearchParams({
      position: JSON.stringify(buildYenPosition()),
    })

    const response = await fetch(`http://127.0.0.1:${gatewayPort}/external/v1/play?${query.toString()}`)
    const body = await response.json()

    assert.equal(response.status, 502)
    assert.deepEqual(body, {
      message: 'Bad Gateway: gamey service unavailable',
    })
  } finally {
    if (gateway) await gateway.stop()
  }
})
