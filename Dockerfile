FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.js build.js ./
COPY public/ ./public/
COPY sample.md ./

# Mount /app/data for persistent comments.db
VOLUME /app/data
ENV DB_PATH=/app/data/comments.db

EXPOSE 3000

CMD ["node", "server.js"]
