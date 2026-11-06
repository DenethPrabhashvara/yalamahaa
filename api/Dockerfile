FROM node:24-alpine
WORKDIR /app
COPY api/package*.json ./
RUN npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000 && \
    npm ci --omit=dev
COPY api/ ./
RUN mkdir -p logs uploads/reports assets/voice/generated && chown -R node:node logs uploads assets/voice/generated
USER node
EXPOSE 8005
CMD ["node", "server.js"]
