# Single-service image: static client + Bun WebSocket server on one PORT.
# Railway auto-detects this Dockerfile; no other config needed.
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-slim AS run
WORKDIR /app
ENV NODE_ENV=production
# Runtime needs only the built client, the server and its engine imports.
# No node_modules: the server has zero runtime dependencies (Bun runs TS).
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json
EXPOSE 3001
CMD ["bun", "run", "server/ws-server.ts"]
