# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- prisma CLI (runs "migrate deploy" at start-up; installed with all its dependencies) ----
FROM node:22-alpine AS prisma-cli
WORKDIR /opt/prisma-cli
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules/prisma/package.json /tmp/prisma-package.json
RUN npm init -y >/dev/null \
 && npm install --omit=dev --no-audit --no-fund "prisma@$(node -p "require('/tmp/prisma-package.json').version")"

# ---- runtime ----
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl && addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=prisma-cli /opt/prisma-cli/node_modules /opt/prisma-cli/node_modules
RUN mkdir -p /app/storage/uploads && chown -R app:app /app/storage
USER app
EXPOSE 3000
# Apply pending migrations, then start the server.
CMD ["sh", "-c", "node /opt/prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma && node server.js"]
