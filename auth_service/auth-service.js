require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const promBundle = require('express-prom-bundle');

const User = require('./models/user');

const app = express();
const port = Number(process.env.PORT ?? 3500);

app.use(express.json());
app.use(promBundle({ includeMethod: true }));

const MONGO_AUTH_DB = process.env.MONGO_AUTH_DB ?? 'mongodb://mongo:27017/auth';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}
const JWT_EXPIRES = process.env.JWT_EXPIRES ?? '24h';

mongoose.connect(MONGO_AUTH_DB, { autoIndex: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => {
    console.error('Mongo connection error', err);
    process.exit(1);
  });

// --- Helpers ---

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing token' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// --- Routes ---

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth' });
});

// Register
app.post('/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'username and password required' });
  }

  try {
    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash });

    const token = signToken({ id: user._id.toString(), username: user.username });

    return res.status(201).json({
      id: user._id.toString(),
      username: user.username,
      token,
      message: `User ${user.username} registered successfully`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'username and password required' });
  }

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'invalid username or password' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: 'invalid username or password' });
    }

    const token = signToken({ id: user._id.toString(), username: user.username });

    return res.json({
      id: user._id.toString(),
      username: user.username,
      token,
      message: `Welcome back ${user.username}!`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
});

// Verify token
app.get('/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// --- Start ---

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Auth Service listening at http://localhost:${port}`);
  });
}

module.exports = app;
