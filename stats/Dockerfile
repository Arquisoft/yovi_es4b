FROM node:22-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --silent

COPY stats-service.js ./

EXPOSE 3001
CMD ["node", "stats-service.js"]
