FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl git \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# Feishu skills invoke lark-cli by name. Expose only that project-local binary
# through the container's standard PATH instead of all of node_modules/.bin.
RUN ln -sfn /app/node_modules/.bin/lark-cli /usr/local/bin/lark-cli \
    && test -x /usr/local/bin/lark-cli

# Official Lark/Feishu Agent Skills installation channel. The global installer
# writes to /root/.agents/skills, which Codex scans for user-level skills.
RUN npx --yes skills add larksuite/cli --yes --global \
    && test -f /root/.agents/skills/lark-shared/SKILL.md \
    && test -f /root/.agents/skills/lark-calendar/SKILL.md \
    && test -f /root/.agents/skills/lark-im/SKILL.md

COPY tsconfig.json tsconfig.build.json ./
COPY AGENTS.md ./AGENTS.md
COPY src ./src
COPY skills ./skills
RUN npm run build \
    && npm prune --omit=dev \
    && chmod 0755 /app/dist/registry-cli.js \
    && ln -sfn /app/dist/registry-cli.js /usr/local/bin/case-registry \
    && mkdir -p /root/.agents/skills/case-registry \
    && cp /app/skills/case-registry/SKILL.md /root/.agents/skills/case-registry/SKILL.md \
    && test -x /usr/local/bin/case-registry \
    && test -f /root/.agents/skills/case-registry/SKILL.md

ENV NODE_ENV=production

CMD ["npm", "start"]
