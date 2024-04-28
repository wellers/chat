FROM node:20.12.2-alpine
WORKDIR /app
EXPOSE 80

RUN corepack enable pnpm

# pnpm install in a way that allows caching
COPY package.json /app/package.json
COPY pnpm-lock.yaml /app/pnpm-lock.yaml
RUN pnpm i

COPY public /app/public

COPY lib /app/lib
COPY tsconfig.json /app/tsconfig.json

CMD ["pnpm", "start"]