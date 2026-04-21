FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --silent

COPY gateway-service.js ./
COPY prometheus-metrics.js ./
COPY external-api-spec.json ./

EXPOSE 8080
CMD ["node", "gateway-service.js"]
