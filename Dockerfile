# Two stages: build with all dependencies, then ship only the built site and production
# dependencies. The runtime image leaves out dev tooling and source, so it's smaller and
# Cloud Run cold-starts faster. Node 24 (Astro 7 needs >= 22.23.4; 22 was the bare minimum).

# ── Build ────────────────────────────────────────────────────────────────────
FROM node:24-slim AS build
WORKDIR /app

# package files first: Docker reuses the install layer until dependencies change.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Astro's Node adapter listens on PORT; 0.0.0.0 accepts connections from outside the container.
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321

# Run as the image's unprivileged user.
USER node
CMD ["node", "./dist/server/entry.mjs"]
