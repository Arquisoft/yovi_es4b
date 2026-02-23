require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const promBundle = require('express-prom-bundle');

const User = require('./models/user');

const app = express();
app.use(express.json());
app.use(promBundle({ includeMethod: true }));

const MONGO_URL = process.env.MONGO_URL ?? 'mongodb://mongo:27017/auth';
const JWT_SECRET = process.env.JWT_SECRET ?? 'change_this_secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES ?? '1h';

mongoose.connect(MONGO_URL, { autoIndex: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => {
    console.error('Mongo connection error', err);
    process.exit(1);
  });

// Helpers
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Missing token' });
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Routes
app.post('/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'username and password required' });

  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ message: 'username already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash });
    return res.status(201).json({ id: user._id.toString(), username: user.username });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'username and password required' });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'invalid credentials' });

    const token = signToken({ sub: user._id.toString(), username: user.username });
    return res.json({ token, expires_in: JWT_EXPIRES });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
});

// Protected endpoint example
app.get('/me', authMiddleware, async (req, res) => {
  const { sub, username } = req.user;
  res.json({ id: sub, username });
});

// Export app for testing and integration
module.exports = app;

if (require.main === module) {
  const port = process.env.PORT ? Number(process.env.PORT) : 3500;
  app.listen(port, () => console.log(`AuthService listening on http://0.0.0.0:${port}`));
}
