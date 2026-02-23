const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../auth-service');
const User = require('../models/user');

describe('AuthService', () => {
  beforeAll(async () => {
    // Use in-memory MongoDB or test DB
    // Could use mongodb-memory-server for true in-memory testing
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe('POST /register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/register')
        .send({ username: 'testuser', password: 'test123' });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.username).toBe('testuser');
    });

    it('should fail if username already exists', async () => {
      await request(app)
        .post('/register')
        .send({ username: 'duplicate', password: 'test123' });

      const res = await request(app)
        .post('/register')
        .send({ username: 'duplicate', password: 'test456' });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toBe('username already exists');
    });

    it('should fail if username or password missing', async () => {
      const res = await request(app)
        .post('/register')
        .send({ username: 'nopass' });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/register')
        .send({ username: 'logintest', password: 'password123' });
    });

    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/login')
        .send({ username: 'logintest', password: 'password123' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('expires_in');
    });

    it('should fail with wrong password', async () => {
      const res = await request(app)
        .post('/login')
        .send({ username: 'logintest', password: 'wrongpass' });

      expect(res.statusCode).toBe(401);
    });

    it('should fail with non-existent user', async () => {
      const res = await request(app)
        .post('/login')
        .send({ username: 'nosuchuser', password: 'test' });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /me', () => {
    let validToken;

    beforeEach(async () => {
      await request(app)
        .post('/register')
        .send({ username: 'metest', password: 'password123' });

      const loginRes = await request(app)
        .post('/login')
        .send({ username: 'metest', password: 'password123' });

      validToken = loginRes.body.token;
    });

    it('should get user info with valid token', async () => {
      const res = await request(app)
        .get('/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.username).toBe('metest');
    });

    it('should fail without token', async () => {
      const res = await request(app).get('/me');
      expect(res.statusCode).toBe(401);
    });

    it('should fail with invalid token', async () => {
      const res = await request(app)
        .get('/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.statusCode).toBe(401);
    });
  });
});
