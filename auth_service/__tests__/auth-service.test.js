import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import request from 'supertest'

// Use mongodb-memory-server so tests don't need a real MongoDB
const { MongoMemoryServer } = await import('mongodb-memory-server')
const mongoose = await import('mongoose')

let mongoServer
let app

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  process.env.MONGO_AUTH_DB = mongoServer.getUri()
  process.env.JWT_SECRET = 'test-secret'

  // import app after environment variables are configured
  app = (await import('../auth-service.js')).default
})

afterAll(async () => {
  await mongoose.default.disconnect()
  if (mongoServer) await mongoServer.stop()
})

describe('POST /register', () => {
  it('returns 400 when username or password is missing', async () => {
    const res = await request(app)
      .post('/register')
      .send({ username: 'Juan' })
      .set('Accept', 'application/json')

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/password required/i)
  })

  it('registers a new user and returns a token', async () => {
    const res = await request(app)
      .post('/register')
      .send({ username: 'TestUser', password: 'secret123' })
      .set('Accept', 'application/json')

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('token')
    expect(res.body.username).toBe('testuser') // lowercase
    expect(res.body.message).toMatch(/registered successfully/i)
  })

  it('returns 409 when username already exists', async () => {
    const res = await request(app)
      .post('/register')
      .send({ username: 'TestUser', password: 'other123' })
      .set('Accept', 'application/json')

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/already exists/i)
  })
})

describe('POST /login', () => {
  it('returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/login')
      .send({})
      .set('Accept', 'application/json')

    expect(res.status).toBe(400)
  })

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/login')
      .send({ username: 'TestUser', password: 'wrongpass' })
      .set('Accept', 'application/json')

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid/i)
  })

  it('logs in an existing user and returns a token', async () => {
    const res = await request(app)
      .post('/login')
      .send({ username: 'TestUser', password: 'secret123' })
      .set('Accept', 'application/json')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.username).toBe('testuser')
  })
})

describe('GET /verify', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/verify')
    expect(res.status).toBe(401)
  })

  it('returns valid:true with a good token', async () => {
    // First login to get a token
    const loginRes = await request(app)
      .post('/login')
      .send({ username: 'TestUser', password: 'secret123' })

    const { token } = loginRes.body

    const res = await request(app)
      .get('/verify')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(true)
    expect(res.body.user.username).toBe('testuser')
  })
})

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})

describe('GET /metrics', () => {
  it('returns Prometheus metrics after serving traffic', async () => {
    await request(app).get('/health')

    const res = await request(app).get('/metrics')

    expect(res.status).toBe(200)
    expect(res.text).toMatch(/# TYPE yovi_http_requests_total counter/)
    expect(res.text).toMatch(/yovi_http_requests_total\{service="auth",method="GET",route="\/health",status="200"\} 1/)
    expect(res.text).toMatch(/yovi_process_resident_memory_bytes\{service="auth"\}/)
  })
})
