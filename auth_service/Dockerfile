FROM node:22-alpine
WORKDIR /app
RUN chown node:node /app
COPY --chown=root:root --chmod=444 package.json package-lock.json ./
USER node
RUN npm ci --omit=dev --silent
USER root
RUN mkdir -p models && chown root:root models && chmod 555 models
COPY --chown=root:root --chmod=444 auth-service.js prometheus-metrics.js ./
COPY --chown=root:root --chmod=444 models/user.js ./models/user.js
RUN chown -R root:root /app && chmod -R a-w /app
USER node
EXPOSE 3500
CMD ["node", "auth-service.js"]
