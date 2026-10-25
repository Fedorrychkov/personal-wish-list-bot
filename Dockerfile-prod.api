# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml ./
RUN npm install --global pnpm@9.15.9 && HUSKY=0 pnpm install --frozen-lockfile
COPY . .
RUN npm run build:prod
RUN pnpm prune --prod --ignore-scripts

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production API_ENV=prod PORT=8080
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/uploads /app/data
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s CMD node -e "fetch('http://127.0.0.1:8080/v1/healthcheck').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
EXPOSE 8080
CMD ["node", "dist/main"]
