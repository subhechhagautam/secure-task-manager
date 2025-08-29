
FROM node:18-alpine AS builder


RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs


WORKDIR /app


COPY app/package*.json ./


RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf /tmp/*


FROM node:18-alpine AS production


RUN apk update && apk upgrade && \
    apk add --no-cache curl && \
    rm -rf /var/cache/apk/*


RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs


WORKDIR /app


COPY --from=builder /app/node_modules ./node_modules


COPY app/ .


RUN chown -R nodeuser:nodejs /app


USER nodeuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1


ENV NODE_ENV=production


CMD ["npm", "start"]
