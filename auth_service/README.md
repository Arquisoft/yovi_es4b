# AuthService

Microservicio de autenticación (Express) que guarda usuarios en MongoDB, hashea contraseñas con bcrypt y emite JWT.

Resumen rápido:
- Endpoints: `POST /register`, `POST /login`, `GET /me` (protegido)
- Puerto por defecto: `3500`

Requisitos
- Node.js para desarrollo local
- MongoDB para persistencia (puede correr en Docker)

Variables de entorno
Ver `auth_service/.env.example`:

```
MONGO_URL=mongodb://mongo:27017/auth
JWT_SECRET=REPLACE_THIS_WITH_STRONG_SECRET
JWT_EXPIRES=1h
PORT=3500
```

Instalación y ejecución local (sin Docker)

1. Instala dependencias:

```bash
cd auth_service
npm install
```

2. Arranca MongoDB localmente (o exporta `MONGO_URL` hacia un Mongo accesible).

3. Inicia el servicio en modo desarrollo:

```bash
npm run dev
```

Uso con Docker / docker-compose

Nota importante sobre el `Dockerfile` actual: usa `npm ci --production`. `npm ci` requiere que exista `package-lock.json`. Antes de construir la imagen asegúrate de generar `package-lock.json` ejecutando `npm install` en `auth_service`, o modifica el Dockerfile para usar `npm install` en lugar de `npm ci`.

Para levantar Mongo y el servicio (con rebuild):

```bash
docker-compose up -d --build mongo auth
```

El servicio quedará expuesto en `http://localhost:3500` (según `docker-compose.yml`).

Endpoints

POST /register
- Body JSON: `{ "username": "usuario", "password": "contraseña" }`
- Respuesta 201: `{ "id": "<id>", "username": "usuario" }`

POST /login
- Body JSON: `{ "username": "usuario", "password": "contraseña" }`
- Respuesta 200: `{ "token": "<jwt>", "expires_in": "1h" }`

GET /me
- Requiere header `Authorization: Bearer <token>`
- Respuesta 200: `{ "id": "<id>", "username": "usuario" }`

Pruebas

Las pruebas incluidas ejercitan los endpoints, pero actualmente asumen que hay acceso a MongoDB (la suite no arranca un Mongo en memoria). Para ejecutar las pruebas:

```bash
cd auth_service
npm install
# Asegúrate de tener Mongo corriendo en MONGO_URL
npm test
```

Si prefieres aislamiento, adapta las pruebas para usar `mongodb-memory-server`.

Notas de integración
- En `docker-compose.yml` se añadió un servicio `auth` y `mongo`. El `gateway` fue configurado para depender de `auth`.
- Ajusta el frontend para llamar a `http://<auth-host>:3500` o configura el `gateway` para enrutar `/auth`.

Seguridad
- Las contraseñas se hashean con `bcrypt` (salt rounds: 10)
- Guarda `JWT_SECRET` en un gestor de secretos en producción

Problemas conocidos
- El `Dockerfile` usa `npm ci`; si no hay `package-lock.json` la build fallará. Genera `package-lock.json` localmente o cambie el Dockerfile.
