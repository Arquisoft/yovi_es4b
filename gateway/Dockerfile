FROM node:22-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --silent

COPY gateway-service.js ./

EXPOSE 8080
CMD ["node", "gateway-service.js"]
