FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl git \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# Official Lark/Feishu Agent Skills installation channel. The global installer
# writes to /root/.agents/skills, which Codex scans for user-level skills.
RUN npx --yes skills add larksuite/cli --yes --global \
    && test -f /root/.agents/skills/lark-shared/SKILL.md \
    && test -f /root/.agents/skills/lark-calendar/SKILL.md \
    && test -f /root/.agents/skills/lark-im/SKILL.md

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build \
    && npm prune --omit=dev

ENV NODE_ENV=production

CMD ["npm", "start"]
