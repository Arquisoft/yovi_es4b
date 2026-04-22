FROM node:22-alpine
WORKDIR /app
RUN chown node:node /app

COPY --chown=root:root --chmod=444 package.json package-lock.json ./
USER node
RUN npm ci --omit=dev --ignore-scripts --silent

USER root
COPY --chown=root:root --chmod=444 gateway-service.js ./
COPY --chown=root:root --chmod=444 prometheus-metrics.js ./
COPY --chown=root:root --chmod=444 external-api-spec.json ./
RUN chown -R root:root /app && chmod -R a-w /app
USER node

EXPOSE 8080
CMD ["node", "gateway-service.js"]
