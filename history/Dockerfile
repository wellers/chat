FROM node:18.13.0
WORKDIR /app
EXPOSE 80

COPY .yarn .yarn

RUN corepack enable && yarn set version 3.3.1

# yarn install in a way that allows caching
COPY package.json package.json
COPY yarn.lock yarn.lock
COPY .yarnrc.yml /app/.yarnrc.yml
RUN yarn install

COPY lib lib
COPY tsconfig.json tsconfig.json

CMD ["yarn", "start"]