# Configuración AuthService

## Estructura creada

```
auth_service/
├── auth-service.js       # Servidor Express con endpoints auth
├── package.json          # Dependencias
├── Dockerfile           # Imagen Docker
├── .env.example         # Variables de entorno
├── .gitignore
├── README.md            # Documentación del servicio
├── models/
│   └── user.js          # Esquema MongoDB (username, passwordHash)
└── __tests__/
    └── auth-service.test.js
```

## Cambios realizados

1. **Añadido servicio auth en docker-compose.yml**:
   - Servicio `mongo` (MongoDB 6.0) en puerto 27017
   - Servicio `auth` en puerto 3500
   - Volumen `mongo-data` para persistencia
   - Gateway ahora depende de `auth`

## Cómo usar

### 1. Inicia los servicios
```bash
docker-compose up -d mongo auth
```

### 2. Endpoints disponibles

**Registro:**
```bash
curl -X POST http://localhost:3500/register \
  -H "Content-Type: application/json" \
  -d '{"username":"user1","password":"pass123"}'
```

**Login:**
```bash
curl -X POST http://localhost:3500/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user1","password":"pass123"}'
```

Respuesta: `{"token":"eyJ...", "expires_in":"1h"}`

**Info del usuario (protegido):**
```bash
curl -X GET http://localhost:3500/me \
  -H "Authorization: Bearer eyJ..."
```

### 3. Integración en frontend/gateway (LoginView.tsx)

Ejemplo React:
```javascript
async function login(username, password) {
  const res = await fetch('http://localhost:3500/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const { token } = await res.json();
  localStorage.setItem('authToken', token);
  return token;
}

// Para peticiones autenticadas:
const token = localStorage.getItem('authToken');
fetch('http://localhost:3500/me', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### 4. Variables de entorno para producción

Edita `auth_service/.env.example` o pasa variables en docker-compose:
- `JWT_SECRET`: Cambia a un valor seguro (p.ej. con `openssl rand -hex 32`)
- `MONGO_URL`: URL de MongoDB (default: mongodb://mongo:27017/auth)
- `JWT_EXPIRES`: Expiración del token (default: 1h)

## Seguridad

- ✓ Contraseñas hasheadas con bcrypt (salt rounds: 10)
- ✓ JWT para autenticación stateless
- ✓ Validation de input en endpoints
- ⚠️ En producción: cambiar JWT_SECRET y usar HTTPS

## Pruebas

```bash
cd auth_service
npm install
npm test
```

## Notas

- Las contraseñas NO se devuelven en respuestas
- Los tokens expiran según JWT_EXPIRES
- MongoDB debe estar corriendo antes de iniciar auth
- Gateway puede reenviar `/auth/*` a este servicio configurando proxy
