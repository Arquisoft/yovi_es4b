# Yovi_es4b - Game Y at UniOvi

## 
[![Release — Test, Build, Publish, Deploy](https://github.com/arquisoft/yovi_es4b/actions/workflows/release-deploy.yml/badge.svg)](https://github.com/arquisoft/yovi_es4b/actions/workflows/release-deploy.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Arquisoft_yovi_es4b&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Arquisoft_yovi_es4b)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=Arquisoft_yovi_es4b&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Arquisoft_yovi_es4b)

This project is a template with some basic functionality for the ASW labs.

## Team Members
* Julián Fernández Herruzo UO300199@uniovi.es 
* Fernando Begega Suarez UO295286@uniovi.es
* Rodrigo García López UO300548@uniovi.es 
* Adrian Burguet Diego UO294819@uniovi.es

## Project Structure

The project is divided into these main components, each in its own directory:

- `webapp/`: Frontend application built with React, Vite, and TypeScript.
- `gateway/`: Node.js reverse proxy that routes incoming traffic to internal services.
- `auth_service/`: Authentication microservice (register/login/verify) with JWT + MongoDB.
- `gamey/`: Rust game engine and bot service.
- `stats/`: Node.js service for match history and player statistics.
- `load-tests/`: Gatling/Maven load tests and saved execution evidence.
- `docs/`: Architecture documentation sources following Arc42 template.

Each component includes the scripts/configuration needed to run and test the application.

## Basic Features

- **User Registration**: The web application provides a simple form to register new users.
- **GameY**: A basic Game engine which only chooses a random piece.

## Components

### Webapp

The `webapp` is a single-page application (SPA) created with [Vite](https://vitejs.dev/) and [React](https://reactjs.org/).

- `src/App.tsx`: The main component of the application.
- `src/RegisterForm.tsx`: The component that renders the user registration form.
- `package.json`: Contains scripts to run, build, and test the webapp.
- `vite.config.ts`: Configuration file for Vite.
- `Dockerfile`: Defines the Docker image for the webapp.

### Gateway

The `gateway` service is a Node.js reverse proxy built with [Express](https://expressjs.com/) and [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware).

- `gateway-service.js`: Central route map for forwarding traffic to `webapp`, `auth`, `gamey`, and `stats`.
- `package.json`: Contains scripts to start the gateway.
- `Dockerfile`: Defines the Docker image for the gateway service.

### Gamey

The `gamey` component is a Rust-based game engine with bot support, built with [Rust](https://www.rust-lang.org/) and [Cargo](https://doc.rust-lang.org/cargo/).

- `src/main.rs`: Entry point for the application.
- `src/lib.rs`: Library exports for the gamey engine.
- `src/bot/`: Bot implementation and registry.
- `src/core/`: Core game logic including actions, coordinates, game state, and player management.
- `src/notation/`: Game notation support (YEN, YGN).
- `src/web/`: Web interface components.
- `Cargo.toml`: Project manifest with dependencies and metadata.
- `Dockerfile`: Defines the Docker image for the gamey service.

### Auth Service

A dedicated microservice lives under `auth_service/`. It provides user registration and login using
JSON Web Tokens (JWT) and persists accounts in MongoDB. This allows sessions to be
authenticated across the platform.

- `auth-service.js`: main application file, implements `/register`, `/login`, and a
  protected `/verify` endpoint.
- `models/user.js`: Mongoose schema for users (username + passwordHash).
- `package.json` / `package-lock.json`: npm configuration.
- `Dockerfile`: builds the Node.js image for the service.
- `__tests__/auth-service.test.js`: unit tests using Supertest.

#### API endpoints

The API is documented on /external/docs#/

| Path           | Method | Description                       | Auth required |
|---------------|--------|-----------------------------------|---------------|
| `/register`   | POST   | Create account (username+password)| no            |
| `/login`      | POST   | Obtain JWT token                  | no            |
| `/verify`     | GET    | Verify JWT token validity         | yes (Bearer)  |

Example request body for `/register`:
```json
{ "username": "alice", "password": "P@ssw0rd" }
```

Successful login returns:
```json
{ "id": "<userId>", "username": "alice", "token": "<jwt>", "message": "Welcome back alice!" }
```

## Running the Project

You can run this project using Docker (recommended) or locally without Docker.

### With Docker

This is the easiest way to get the project running. You need to have [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed.

The `docker-compose.yml` in this repository is configured to build first-party services (`webapp`, `gateway`, `auth`, `gamey`, `stats`) directly from local source code in this repo.

1. **Build and run the containers:**
    From the root directory of the project, run:

```bash
docker-compose up --build
```

This command will build the Docker images and start the full stack behind the gateway.

2.**Access the application:**
- Web application (default local setup, HTTP): [http://localhost:8080](http://localhost:8080)
- Auth API (through gateway, default local setup): [http://localhost:8080/auth/register](http://localhost:8080/auth/register), [http://localhost:8080/auth/login](http://localhost:8080/auth/login), [http://localhost:8080/auth/verify](http://localhost:8080/auth/verify)
- Gamey API (through gateway, default local setup): [http://localhost:8080/api/v1/games](http://localhost:8080/api/v1/games)
- External bot API documentation (through gateway, default local setup): [http://localhost:8080/external/docs](http://localhost:8080/external/docs)
- External bot OpenAPI contract (through gateway, default local setup): [http://localhost:8080/external/docs/openapi.json](http://localhost:8080/external/docs/openapi.json)
- Prometheus: [http://localhost:9090](http://localhost:9090)
- Grafana: [http://localhost:9091](http://localhost:9091)

### External bot play endpoint

The external bot endpoint accepts a GET request with these query parameters:

- `position` (required): JSON-encoded YEN record for the current board position.
- `bot_id` (optional): explicit bot identifier. If omitted, `random_bot` is used.

Response format:

```json
{ "coords": { "x": 1, "y": 1, "z": 0 } }
```

Example request:

```bash
curl -G "http://localhost:8080/external/v1/play" \
  --data-urlencode 'position={"size":3,"turn":0,"players":["B","R"],"layout":"./../..."}' \
  --data-urlencode 'bot_id=random_bot'
```

### HTTPS certificates

The public entry point is the `gateway`. HTTPS is configured there, while internal traffic to `webapp`, `auth`, `gamey`, and `stats` remains inside Docker.

For local development, the Docker Compose stack now starts the gateway in plain HTTP on `http://localhost:8080` unless you explicitly provide both TLS paths. This keeps Prometheus scraping and manual testing working out of the box.

Certificate placement:

- The public certificate is in `gateway/certs/server.crt`
- The private key is in `gateway/certs/server.key`

These files are mounted into the container at `/app/certs` and loaded by the gateway with the default Docker Compose configuration.

- `HTTPS_CERT_PATH=/app/certs/server.crt`
- `HTTPS_KEY_PATH=/app/certs/server.key`

For local development, self-signed certificates can be used.

If both values are left empty, the gateway falls back to HTTP and Prometheus scrapes `http://gateway:8080/metrics`.

Default Docker ports:

- Host `443` -> gateway HTTPS listener
- Host `8080` -> gateway HTTP listener

Important deployment note:

- If you do not want HTTP at all, set `HTTP_REDIRECT_ENABLED=false` and do not use host port `80`.
- If you want automatic redirect from HTTP to HTTPS, set `HTTP_REDIRECT_ENABLED=true` and map host `80` to the gateway HTTP listener instead of exposing that port from any other service.
- Only the `gateway` should publish public web ports. `webapp` must stay internal to avoid port conflicts.

Recommended VM setup without risking another port-80 collision:

```powershell
$env:HTTP_REDIRECT_ENABLED="false"
$env:GATEWAY_HTTPS_HOST_PORT="443"
$env:GATEWAY_HTTP_HOST_PORT="8080"
docker-compose up --build -d
```

If you want `http://...` to redirect to `https://...`, use:

```powershell
$env:HTTP_REDIRECT_ENABLED="true"
$env:GATEWAY_HTTPS_HOST_PORT="443"
$env:GATEWAY_HTTP_HOST_PORT="80"
docker-compose up --build -d
```

With that configuration there is no duplicate use of port `80`, because the only container binding that host port is the `gateway`.

### Monitoring and dashboards

The Docker Compose environment also provisions a monitoring stack:

- `Prometheus` scrapes `/metrics` from `gateway`, `auth`, `stats`, and `gamey`
- `Grafana` is automatically provisioned with the Prometheus datasource
- A starter dashboard named `Yovi Observability` is loaded on startup

Useful URLs:

- Prometheus UI: `http://localhost:9090`
- Grafana UI: `http://localhost:9091`

The metrics exposed by the services include:

- HTTP traffic counters and request-duration aggregates
- Process uptime and memory gauges for Node.js services
- Gamey domain gauges and counters for active games, matchmaking, and stats reporting

For a simpler explanation of each metric and each Grafana panel, see [monitoring/README.md](monitoring/README.md).

### Load tests

The repository includes a Gatling load-test project in `load-tests/`.
It contains the `YoviSimulation` scenario and the saved execution output in `load-tests/results/resultados.txt`.

Run it against the local gateway:

```powershell
cd load-tests
mvn gatling:test -Dyovi.baseUrl=http://localhost:8080
```

Run it in Docker Compose against the internal gateway service:

```powershell
docker compose -f docker-compose.yml -f docker-compose.load-tests.yml run --rm gatling
```

The simulation accepts `-Dyovi.baseUrl`, `-Dyovi.usersPerSec` and `-Dyovi.durationSeconds`.
Generated Gatling reports are written under `load-tests/target/gatling/`.

### Without Docker

To run the project locally without Docker, you will need to run each component in a separate terminal.

#### Prerequisites

* [Node.js](https://nodejs.org/) and npm installed.
* [Rust](https://www.rust-lang.org/) and Cargo installed (for `gamey`).
* MongoDB available locally if running `auth_service` or `stats` outside Docker.

#### 1. Running the Auth Service

Navigate to the `auth_service` directory:

```bash
cd auth_service
```

Install dependencies:

```bash
npm install
```

Run the service:

```bash
$env:JWT_SECRET="change_this_secret"; $env:MONGO_AUTH_DB="mongodb://localhost:27017/auth"; npm start
```

The auth service will be available at `http://localhost:3500`.

#### 2. Running the Stats Service

Navigate to the `stats` directory:

```bash
cd stats
```

Install dependencies:

```bash
npm install
```

Run the service:

```bash
$env:MONGO_URL="mongodb://localhost:27017"; $env:MONGO_DB_NAME="yovi_stats"; $env:STATS_INTERNAL_TOKEN="stats-internal-token"; npm start
```

The stats service will be available at `http://localhost:3001`.

#### 3. Running the GameY Service

Navigate to the `gamey` directory:

```bash
cd gamey
```

Run the service on port `4000`:

```bash
$env:STATS_SERVICE_URL="http://localhost:3001"; $env:STATS_INTERNAL_TOKEN="stats-internal-token"; cargo run -- --mode server --port 4000
```

#### 4. Running the Web Application

Navigate to the `webapp` directory:

```bash
cd webapp
```

Install dependencies:

```bash
npm install
```

Run the application:

```bash
npm run dev
```

The web application will be available at `http://localhost:5173`.

#### 5. Running the Gateway

Navigate to the `gateway` directory:

```bash
cd gateway
```

Install dependencies:

```bash
npm install
```

Run the gateway:

```bash
$env:WEBAPP_SERVICE_URL="http://localhost:5173"; $env:AUTH_SERVICE_URL="http://localhost:3500"; $env:GAMEY_SERVICE_URL="http://localhost:4000"; $env:STATS_SERVICE_URL="http://localhost:3001"; $env:HTTPS_CERT_PATH="C:\path\to\server.crt"; $env:HTTPS_KEY_PATH="C:\path\to\server.key"; $env:HTTPS_PORT="8443"; $env:PORT="8080"; $env:HTTP_REDIRECT_ENABLED="true"; npm start
```

The gateway will be available at `https://localhost:8443`. If `HTTP_REDIRECT_ENABLED=true`, `http://localhost:8080` will redirect to HTTPS.

## Available Scripts

Each component has its own set of scripts defined in its `package.json`. Here are some of the most important ones:

### Webapp (`webapp/package.json`)

Run these commands from `webapp/` (or from repo root using `npm --prefix webapp ...`).

- `npm run dev`: Starts the development server for the webapp.
- `npm test`: Runs the unit tests in watch mode.
- `npm run test -- --run`: Runs the unit tests once.
- `npm run test -- --run src/__tests__/AppGameExitBehavior.test.tsx`: Runs a specific test file.
- `npm run test:e2e`: Runs the end-to-end tests.
- `npm run start:all`: A convenience script to start `webapp`, `gateway`, and `auth_service` concurrently.

### Auth Service (`auth_service/package.json`)

- `npm start`: Starts the auth service.
- `npm test`: Runs the tests for the service.

### Stats Service (`stats/package.json`)

- `npm start`: Starts the stats service.
- `npm test`: Runs the tests for the service.

### Gateway (`gateway/package.json`)

- `npm start`: Starts the reverse proxy gateway.

### Gamey (`gamey/Cargo.toml`)

- `cargo build`: Builds the gamey application.
- `cargo test`: Runs the unit tests.
- `cargo run`: Runs the gamey application.
- `cargo doc`: Generates documentation for the GameY engine application
