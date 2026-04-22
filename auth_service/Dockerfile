FROM node:22-alpine
WORKDIR /app
RUN chown node:node /app
RUN mkdir -p models && chown node:node models && chmod 555 models
COPY --chown=node:node --chmod=444 package.json package-lock.json ./
USER node
RUN npm ci --omit=dev --silent
COPY --chown=node:node --chmod=444 auth-service.js prometheus-metrics.js ./
COPY --chown=node:node --chmod=444 models/user.js ./models/user.js
EXPOSE 3500
CMD ["node", "auth-service.js"]
