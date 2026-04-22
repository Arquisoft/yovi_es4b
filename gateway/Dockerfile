FROM node:22-alpine
WORKDIR /app
RUN chown node:node /app

COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci --omit=dev --silent

COPY --chown=node:node gateway-service.js ./
COPY --chown=node:node prometheus-metrics.js ./
COPY --chown=node:node external-api-spec.json ./

EXPOSE 8080
CMD ["node", "gateway-service.js"]
