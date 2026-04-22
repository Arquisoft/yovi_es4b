# Guia de Monitorizacion

Esta carpeta contiene la configuracion de monitorizacion local del proyecto:

- `Prometheus` recoge metricas de `gateway`, `auth`, `stats` y `gamey`
- `Grafana` muestra esas metricas en el dashboard `Yovi Observability`

URLs utiles al ejecutar con Docker:

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:9091`

## Que recoge Prometheus

Todos los servicios monitorizados exponen un endpoint `/metrics`.

Prometheus consulta estos destinos internos de Docker:

- `gateway:8080/metrics`
- `auth:3500/metrics`
- `stats:3001/metrics`
- `gamey:4000/metrics`

Importante:

- esos nombres son internos de Docker
- funcionan entre contenedores
- no tienen por que funcionar en el navegador de Windows
- si `gamey:4000/metrics` falla en el navegador pero aparece como `UP` en Prometheus, eso es normal

## Metricas comunes

`gateway`, `auth`, `stats` y `gamey` exponen metricas HTTP:

- `yovi_http_requests_total`
  Numero total de peticiones atendidas
- `yovi_http_request_duration_seconds_sum`
  Suma del tiempo total invertido en atender peticiones
- `yovi_http_request_duration_seconds_count`
  Numero de peticiones usadas para calcular latencia
- `yovi_process_uptime_seconds`
  Tiempo que lleva levantado el servicio

`gateway`, `auth` y `stats` tambien exponen metricas del proceso Node.js:

- `yovi_process_resident_memory_bytes`
  Memoria residente usada por el proceso
- `yovi_process_heap_used_bytes`
  Heap de V8 usado en ese momento

## Metricas de Gamey

`gamey` expone metricas de dominio relacionadas con partidas y emparejamiento:

- `yovi_gamey_ongoing_games`
  Partidas que siguen en curso en memoria
- `yovi_gamey_finished_games_in_memory`
  Partidas terminadas que siguen almacenadas en memoria
- `yovi_gamey_matchmaking_queue_size`
  Tamano actual de la cola de matchmaking
- `yovi_gamey_matchmaking_tickets`
  Tickets de matchmaking por estado: `waiting`, `matched`, `cancelled`
- `yovi_gamey_games_created_total`
  Total de partidas creadas
- `yovi_gamey_moves_played_total`
  Total de movimientos jugados
- `yovi_gamey_resignations_total`
  Total de rendiciones
- `yovi_gamey_turn_passes_total`
  Total de turnos pasados
- `yovi_gamey_matchmaking_enqueued_total`
  Total de solicitudes anadidas a la cola
- `yovi_gamey_matchmaking_cancelled_total`
  Total de cancelaciones en matchmaking
- `yovi_gamey_stats_report_attempts_total`
  Intentos de envio de resultados a `stats`
- `yovi_gamey_stats_report_failures_total`
  Fallos al enviar resultados a `stats`

## Dashboard de Grafana

El dashboard `Yovi Observability` contiene estos paneles:

- `Requests by Service`
  Tasa de peticiones por servicio. Si esta cerca de `0`, normalmente significa que en ese momento apenas hay trafico.
- `Average Latency by Service`
  Tiempo medio de respuesta por servicio. Cuanto mas bajo, mejor.
- `5xx Rate by Service`
  Errores de servidor. Lo ideal es que se mantenga en `0` o vacio.
- `Resident Memory by Service`
  Memoria usada por los servicios Node.js.
- `Scrape Health`
  Indica si Prometheus puede leer las metricas de cada servicio. `1` significa correcto, `0` significa que Prometheus no puede scrapear ese servicio.
- `Gamey Games in Memory`
  Partidas en curso y partidas ya terminadas que siguen guardadas en memoria.
- `Gamey Matchmaking`
  Tamano de la cola y estado de los tickets de matchmaking.
- `Gamey Activity in Last 5m`
  Actividad de juego en los ultimos 5 minutos: partidas creadas, movimientos, rendiciones y turnos pasados.

## Como interpretar el dashboard

Algunas reglas rapidas para no confundirse:

- `0` no siempre significa error. Muchas veces solo significa que no ha habido actividad reciente.
- `No data` en `5xx Rate by Service` suele ser buena senal si no ha habido errores de servidor.
- `Scrape Health = 1` significa que Prometheus esta llegando bien al servicio.
- Si el rango temporal es muy grande, puedes ver errores antiguos mezclados con datos actuales correctos.

Configuracion recomendada al probar manualmente:

- rango temporal: `Last 5 minutes`
- refresco: `10s`

## Comprobacion manual rapida

Para generar algo de trafico en local:

```powershell
Invoke-WebRequest https://localhost/health -SkipCertificateCheck
Invoke-WebRequest http://localhost:3500/health
Invoke-WebRequest http://localhost:3001/health
```

Despues revisa:

- pagina de targets de Prometheus: `http://localhost:9090/targets`
- dashboard de Grafana: `http://localhost:9091`

Si todo esta bien:

- todos los servicios monitorizados aparecen como `UP` en Prometheus
- `Scrape Health` muestra `1`
- `Requests by Service` cambia despues de hacer peticiones
