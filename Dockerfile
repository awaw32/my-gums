FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
# FIXED: build متكرر وآمن مع npm ci --omit=dev
