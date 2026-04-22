FROM node:22-alpine
WORKDIR /app
RUN chown node:node /app

COPY --chown=node:node --chmod=444 package.json package-lock.json ./
USER node
RUN npm ci --omit=dev --silent

COPY --chown=node:node --chmod=444 stats-service.js ./
COPY --chown=node:node --chmod=444 prometheus-metrics.js ./

EXPOSE 3001
CMD ["node", "stats-service.js"]
