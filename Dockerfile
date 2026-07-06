FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# تثبيت build tools لتجميع better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# إنشاء مجلد البيانات
RUN mkdir -p /app/data

USER node
EXPOSE 3000
CMD [ "node", "server.js" ]
