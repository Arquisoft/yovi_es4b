FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production --silent
COPY . .
EXPOSE 3500
CMD ["node", "auth-service.js"]
