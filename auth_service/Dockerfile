FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
# `npm ci` requires a package-lock.json, which may not exist in development.
# `npm install --production` works in all cases and installs only runtime
# dependencies. It is slightly slower but more robust for Docker builds.
RUN npm install --production --silent
COPY . .
EXPOSE 3500
CMD ["node", "auth-service.js"]
