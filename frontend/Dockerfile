# syntax=docker/dockerfile:1
# Multi-stage build for the Next.js frontend.
#
# NEXT_PUBLIC_API_URL is baked into the client bundle at build time, so it must
# be the PUBLIC URL the browser uses to reach the API (not the internal service
# name). Override with: docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com

FROM node:20-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["npm", "run", "start"]
