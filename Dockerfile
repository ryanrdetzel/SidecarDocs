FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.js build.js ./
COPY lib/ ./lib/
COPY public/ ./public/
COPY sample.md ./

# Mount /app/docs for markdown files with sidecar comment files
VOLUME /app/docs

EXPOSE 3000

CMD ["node", "server.js"]
