FROM node:24.20.0-bookworm-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile && pnpm local:build

RUN mkdir -p /app/.lorestra/state && chown -R node:node /app
USER node

ENV LORESTRA_LOCAL_STATE=/app/.lorestra/state \
    LORESTRA_LOCAL_ORIGIN=http://127.0.0.1:4173 \
    LORESTRA_LOCAL_WEB_PORT=4173

EXPOSE 4173
CMD ["node", "scripts/local-start.mjs"]
