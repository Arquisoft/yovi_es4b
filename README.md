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

The project is divided into four main components, each in its own directory:

- `gateway/`: A Node.js reverse proxy that routes all incoming requests to the correct microservice.
- `webapp/`: A frontend application built with React, Vite, and TypeScript.
- `users/`: A backend service for managing users, built with Node.js and Express.
- `gamey/`: A Rust game engine and bot service.
- `docs/`: Architecture documentation sources following Arc42 template

Each component includes the scripts/configuration needed to run and test the application.

## Basic Features

- **User Registration**: The web application provides a simple form to register new users.
- **User Service**: The user service receives the registration request, simulates some processing, and returns a welcome message.
- **GameY**: A basic Game engine which only chooses a random piece.

## Components

### Webapp

The `webapp` is a single-page application (SPA) created with [Vite](https://vitejs.dev/) and [React](https://reactjs.org/).

- `src/App.tsx`: The main component of the application.
- `src/RegisterForm.tsx`: The component that renders the user registration form.
- `package.json`: Contains scripts to run, build, and test the webapp.
- `vite.config.ts`: Configuration file for Vite.
- `Dockerfile`: Defines the Docker image for the webapp.

### Users Service

The `users` service is a simple REST API built with [Node.js](https://nodejs.org/) and [Express](https://expressjs.com/).

- `users-service.js`: The main file for the user service. It defines an endpoint `/createuser` to handle user creation.
- `package.json`: Contains scripts to start the service.
- `Dockerfile`: Defines the Docker image for the user service.

### Gateway

The `gateway` service is a Node.js reverse proxy built with [Express](https://expressjs.com/) and [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware).

- `gateway-service.js`: Central route map for forwarding traffic to `webapp`, `users`, and `gamey`.
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

## Running the Project

You can run this project using Docker (recommended) or locally without Docker.

### With Docker

This is the easiest way to get the project running. You need to have [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed.

1. **Build and run the containers:**
    From the root directory of the project, run:

```bash
docker-compose up --build
```

This command will build the Docker images and start the full stack behind the gateway.

2.**Access the application:**
- Web application: [http://localhost](http://localhost)
- User service API (through gateway): [http://localhost/users/createuser](http://localhost/users/createuser)
- Gamey API (through gateway): [http://localhost/api/v1/games](http://localhost/api/v1/games)

### Without Docker

To run the project locally without Docker, you will need to run each component in a separate terminal.

#### Prerequisites

* [Node.js](https://nodejs.org/) and npm installed.
* [Rust](https://www.rust-lang.org/) and Cargo installed (for `gamey`).

#### 1. Running the User Service

Navigate to the `users` directory:

```bash
cd users
```

Install dependencies:

```bash
npm install
```

Run the service:

```bash
npm start
```

The user service will be available at `http://localhost:3000`.

#### 2. Running the GameY Service

Navigate to the `gamey` directory:

```bash
cd gamey
```

Run the service on port `4000`:

```bash
cargo run -- --mode server --port 4000
```

#### 3. Running the Web Application

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

#### 4. Running the Gateway

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
$env:WEBAPP_SERVICE_URL="http://localhost:5173"; $env:USERS_SERVICE_URL="http://localhost:3000"; $env:GAMEY_SERVICE_URL="http://localhost:4000"; npm start
```

The gateway will be available at `http://localhost:8080`.

## Available Scripts

Each component has its own set of scripts defined in its `package.json`. Here are some of the most important ones:

### Webapp (`webapp/package.json`)

- `npm run dev`: Starts the development server for the webapp.
- `npm test`: Runs the unit tests.
- `npm run test:e2e`: Runs the end-to-end tests.
- `npm run start:all`: A convenience script to start both the `webapp` and the `users` service concurrently.

### Users (`users/package.json`)

- `npm start`: Starts the user service.
- `npm test`: Runs the tests for the service.

### Gateway (`gateway/package.json`)

- `npm start`: Starts the reverse proxy gateway.

### Gamey (`gamey/Cargo.toml`)

- `cargo build`: Builds the gamey application.
- `cargo test`: Runs the unit tests.
- `cargo run`: Runs the gamey application.
- `cargo doc`: Generates documentation for the GameY engine application
