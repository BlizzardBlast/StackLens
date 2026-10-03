ARG STACKLENS_RUNTIME=worker

FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS build
RUN npm install --global pnpm@12.4.2
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@stacklens/api... --filter=@stacklens/worker...
RUN pnpm --filter @stacklens/api deploy --prod --ignore-scripts /release/api
RUN pnpm --filter @stacklens/worker deploy --prod --ignore-scripts /release/worker

FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS runtime
ENV NODE_ENV=production
WORKDIR /app
USER node

FROM runtime AS api
COPY --from=build --chown=node:node /release/api /app
COPY --chown=node:node scripts/container-health.mjs /app/container-health.mjs
EXPOSE 3000
CMD ["node", "--enable-source-maps", "dist/main.js"]

FROM runtime AS worker
COPY --from=build --chown=node:node /release/worker /app
COPY --chown=node:node scripts/container-health.mjs /app/container-health.mjs
CMD ["node", "--enable-source-maps", "dist/main.js"]

# Hosts without a target-stage setting can select api or worker with a build argument.
FROM ${STACKLENS_RUNTIME} AS hosted
