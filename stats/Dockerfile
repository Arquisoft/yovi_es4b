FROM node:22-alpine
WORKDIR /app
RUN chown node:node /app

COPY --chown=root:root --chmod=444 package.json package-lock.json ./
USER node
RUN npm ci --omit=dev --silent

USER root
COPY --chown=root:root --chmod=444 stats-service.js ./
COPY --chown=root:root --chmod=444 prometheus-metrics.js ./
RUN chown -R root:root /app && chmod -R a-w /app
USER node

EXPOSE 3001
CMD ["node", "stats-service.js"]
