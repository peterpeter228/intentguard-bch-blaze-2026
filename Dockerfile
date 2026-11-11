FROM node:24.22.2-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -r /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-fund --no-audit && npm rebuild sqlite3 better-sqlite3
COPY tsconfig.json ./
COPY core ./core
COPY probes ./probes
COPY preseason ./preseason
COPY scripts ./scripts
COPY review/post-argon/LICENSE-WizardConnect-upstream.txt review/post-argon/license-evidence.json ./review/post-argon/
RUN npm run build:production && npm prune --omit=dev --ignore-scripts
FROM node:24.22.2-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9
WORKDIR /app
COPY --from=build /app/dist/production/ ./
COPY --from=build /app/node_modules/ ./node_modules/
ENV INTENTGUARD_PUBLIC_ROOT=./public INTENTGUARD_PAYMENT_DIR=/data/intentguard-payments INTENTGUARD_MODE=public-demo PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
