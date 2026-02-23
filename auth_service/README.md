# AuthService

Microservicio de autenticación con JWT y MongoDB.

## Características

- Registro de usuarios con bcrypt hash
- Login con JWT tokens
- Endpoint protegido `/me` para obtener info del usuario actual
- Integración con MongoDB
- Métricas de Prometheus

## Instalación local

```bash
npm install
```

## Variables de entorno

Ver `.env.example`:

```
MONGO_URL=mongodb://mongo:27017/auth
JWT_SECRET=REPLACE_THIS_WITH_STRONG_SECRET
JWT_EXPIRES=1h
PORT=3500
```

## Endpoints

### POST /register
Registra un nuevo usuario.

```json
{
  "username": "usuario",
  "password": "contraseña"
}
```

Respuesta (201):
```json
{
  "id": "user_id",
  "username": "usuario"
}
```

### POST /login
Autentica un usuario y retorna JWT.

```json
{
  "username": "usuario",
  "password": "contraseña"
}
```

Respuesta (200):
```json
{
  "token": "eyJhbGc...",
  "expires_in": "1h"
}
```

### GET /me
Endpoint protegido. Requiere header:
```
Authorization: Bearer <token>
```

Respuesta (200):
```json
{
  "id": "user_id",
  "username": "usuario"
}
```

## Desarrollo

```bash
npm run dev
```

## Docker

```bash
docker-compose up auth
```

El servicio estará disponible en `http://localhost:3500`.
