FROM node:24-alpine
WORKDIR /app
RUN npm install --global pnpm@11.25.0 --ignore-scripts
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts
COPY account-mail.cjs Dockerfile .dockerignore verify-package.cjs server.cjs social-server.cjs social-store.cjs rankings-rules.js rankings-store.cjs achievement-requirements.json arcade-unlocks.js arcade.js snake.js bonus-games.js minigolf.js neon-salvage-challenges.js neon-salvage-model.js index.html ./
COPY royal-cards ./royal-cards
RUN node verify-package.cjs
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
USER node
EXPOSE 8080
CMD ["node", "server.cjs"]
