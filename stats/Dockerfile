FROM node:22-alpine
WORKDIR /app
RUN chown node:node /app

COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci --omit=dev --silent

COPY --chown=node:node stats-service.js ./
COPY --chown=node:node prometheus-metrics.js ./

EXPOSE 3001
CMD ["node", "stats-service.js"]
