# Documentacion personal para la presentacion

Esta carpeta contiene una guia de estudio pensada para preparar la defensa de `yovi_es4b`.

No intenta explicar el proyecto linea por linea. La idea es darte una vision completa de:

- como esta montado el sistema
- que responsabilidad tiene cada microservicio
- como funciona el modo online
- donde vive cada dato
- que puntos fuertes y limitaciones tiene la arquitectura
- como contarlo bien en una presentacion

## Por donde empezar

Abre `index.adoc`.

Si no quieres construir nada, los ficheros `.adoc` se leen bastante bien en crudo.

## Estructura

- `index.adoc`: indice general
- `src/01_vision_general.adoc`: mapa completo del proyecto
- `src/02_microservicios.adoc`: analisis detallado de los servicios
- `src/03_online_y_matchmaking.adoc`: flujo online paso a paso
- `src/04_datos_estado_y_persistencia.adoc`: estado, persistencia e identidades
- `src/05_despliegue_y_operacion.adoc`: Docker, red, monitorizacion y pruebas
- `src/06_claves_para_presentar.adoc`: guion, fortalezas, limites y preguntas

## Construccion opcional

La carpeta sigue una idea parecida a `docs/`, pero sin parte de despliegue a GitHub.

Si ya tienes instalado lo mismo que usa `docs/`:

1. Entra en `docpresentacion`
2. Ejecuta `npm install`
3. Ejecuta `npm run build`

Se generara HTML en `docpresentacion/build`.
