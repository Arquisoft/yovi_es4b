FROM node:22-alpine
WORKDIR /app
RUN chown node:node /app

COPY --chown=node:node --chmod=444 package.json package-lock.json ./
USER node
RUN npm ci --omit=dev --silent

COPY --chown=node:node --chmod=444 gateway-service.js ./
COPY --chown=node:node --chmod=444 prometheus-metrics.js ./
COPY --chown=node:node --chmod=444 external-api-spec.json ./

EXPOSE 8080
CMD ["node", "gateway-service.js"]
