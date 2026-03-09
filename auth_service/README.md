# Auth Service

Authentication micro-service for the Yovi GameY platform.

## Features

- **Register** – `POST /register` creates a new user in MongoDB with a hashed password and returns a JWT.
- **Login** – `POST /login` verifies credentials and returns a JWT.
- **Verify** – `GET /verify` (requires `Authorization: Bearer <token>`) checks token validity.
- **Health** – `GET /health` returns service status.

## Tech stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js 22 |
| Framework | Express 5 |
| Database | MongoDB (via Mongoose) |
| Auth | bcrypt + JSON Web Tokens |
| Metrics | express-prom-bundle (Prometheus) |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3500` | HTTP listen port |
| `MONGO_AUTH_DB` | `mongodb://mongo-auth:27017/auth` | MongoDB connection string |
| `JWT_SECRET` | `change_this_secret` | Secret key for signing JWTs |
| `JWT_EXPIRES` | `1h` | Token expiry (e.g. `1h`, `7d`) |

## Running locally

```bash
npm install
npm start          # production
npm run dev        # with nodemon (if installed)
```

## Running tests

```bash
npm test                # run tests
npm run test:coverage   # with coverage report
```

## Docker

```bash
docker build -t auth-service .
docker run -p 3500:3500 \
  -e MONGO_AUTH_DB=mongodb://mongo-auth:27017/auth \
  -e JWT_SECRET=my_secret \
  auth-service
```

## API examples

### Register

```bash
curl -X POST http://localhost:3500/register \
  -H "Content-Type: application/json" \
  -d '{"username":"juan","password":"123456"}'
```

### Login

```bash
curl -X POST http://localhost:3500/login \
  -H "Content-Type: application/json" \
  -d '{"username":"juan","password":"123456"}'
```

### Verify token

```bash
curl http://localhost:3500/verify \
  -H "Authorization: Bearer <token>"
```
