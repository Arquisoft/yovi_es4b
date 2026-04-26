# Yovi Load Tests

Pruebas de carga de Yovi con Gatling, Java y Maven.

## Contenido

- `test/YoviSimulation.java`: simulacion que registra usuarios, hace login, crea una partida contra bot, se rinde y consulta stats.
- `results/resultados.txt`: salida de la ejecucion de referencia del 20/04/2026.
- `pom.xml`: configura Gatling y Maven para ejecutar la simulacion.

## Ejecucion local con Maven

Con Maven instalado y el despliegue local levantado en `http://localhost:8080`:

```powershell
cd load-tests
mvn gatling:test -Dyovi.baseUrl=http://localhost:8080
```

La URL tambien se puede indicar por variable de entorno:

```powershell
$env:YOVI_BASE_URL = "http://localhost:8080"
mvn gatling:test
```

Los informes HTML se generan en `load-tests/target/gatling/.../index.html`.

## Ejecucion con Docker

Sin Maven instalado en la maquina:

```powershell
cd load-tests
docker run --rm -it -v ${PWD}:/work -v yovi-gatling-m2:/root/.m2 -w /work maven:3-eclipse-temurin-17 mvn -B gatling:test -Dyovi.baseUrl=http://host.docker.internal:8080
```

## Ejecucion junto al despliegue Compose

Desde la raiz del proyecto, usando la red de `docker-compose.yml`:

```powershell
docker compose -f docker-compose.yml -f docker-compose.load-tests.yml run --rm gatling
```

Por defecto apunta a `http://gateway:8080`, que es el nombre interno del gateway dentro de Docker Compose.
En un servidor puedes cambiarlo asi:

```powershell
$env:GATLING_BASE_URL = "http://gateway:8080"
docker compose -f docker-compose.yml -f docker-compose.load-tests.yml run --rm gatling
```

## Parametros utiles

- `-Dyovi.baseUrl=http://...`: URL base contra la que se ejecuta la prueba.
- `-Dyovi.usersPerSec=2`: usuarios por segundo.
- `-Dyovi.durationSeconds=60`: duracion de la carga constante.

Ejemplo:

```powershell
mvn gatling:test -Dyovi.baseUrl=http://localhost:8080 -Dyovi.usersPerSec=5 -Dyovi.durationSeconds=120
```
