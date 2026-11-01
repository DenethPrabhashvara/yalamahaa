FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY ai-assistant/server.js ai-assistant/
USER node
EXPOSE 5050
CMD ["node", "ai-assistant/server.js"]
