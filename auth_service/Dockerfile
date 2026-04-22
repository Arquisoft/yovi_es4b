FROM node:22-alpine
WORKDIR /app
RUN chown node:node /app
COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci --omit=dev --silent
COPY --chown=node:node auth-service.js prometheus-metrics.js ./
COPY --chown=node:node models ./models
EXPOSE 3500
CMD ["node", "auth-service.js"]
