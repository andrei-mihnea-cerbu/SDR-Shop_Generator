# ---------------------------
# Stage 1: Build
# ---------------------------
FROM node:20-alpine AS builder

RUN apk add --no-cache tini ca-certificates tzdata

WORKDIR /home/node/app
RUN mkdir -p /home/node/app && chown node:node /home/node/app
USER node

COPY --chown=node:node package*.json ./
RUN npm ci --prefer-offline --no-audit

COPY --chown=node:node . .
RUN npm run build


# ---------------------------
# Stage 2: Production
# ---------------------------
FROM node:20-alpine

RUN apk add --no-cache tini ca-certificates tzdata curl wget \
 && update-ca-certificates \
 && rm -rf /var/cache/apk/*

WORKDIR /home/node/app
RUN mkdir -p /home/node/app && chown -R node:node /home/node/app
USER node

COPY --from=builder /home/node/app/package*.json ./
COPY --from=builder /home/node/app/dist ./dist
COPY --from=builder /home/node/app/node_modules ./node_modules
COPY --from=builder /home/node/app/static ./static
COPY --from=builder /home/node/app/views ./views

EXPOSE 3006

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--enable-source-maps", "dist/backend/server.js"]
