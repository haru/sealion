FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client

COPY package.json package-lock.json ./
COPY prisma/ ./prisma/
COPY prisma.config.ts ./prisma.config.ts
RUN npm ci

COPY . .
RUN npm run build

COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER node

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node_modules/.bin/next", "start"]
