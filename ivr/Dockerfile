FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY agi.js ./
# root: writes into the sounds volume Asterisk created
CMD ["node", "agi.js"]
