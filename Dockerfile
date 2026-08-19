ARG UV_VERSION=0.12.5
FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv

FROM node:24-bookworm-slim

ARG HARBOR_VERSION=0.21.0
ARG MODAL_VERSION=1.5.4

COPY --from=uv /uv /uvx /usr/local/bin/

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl git \
    && rm -rf /var/lib/apt/lists/*

# Harbor requires Python 3.12+. Keep the upstream binaries outside PATH so the
# public `harbor` command can apply CASE's credential and remote-execution
# boundary. Modal is also installed directly so its CLI remains available for
# authentication checks and provider diagnostics.
ENV UV_PYTHON_INSTALL_DIR=/opt/uv/python \
    UV_TOOL_DIR=/opt/uv/tools \
    UV_CACHE_DIR=/tmp/uv-cache
RUN mkdir -p /opt/harbor-bin /opt/modal-bin \
    && uv python install 3.12 \
    && UV_TOOL_BIN_DIR=/opt/harbor-bin uv tool install --python 3.12 "harbor[modal]==${HARBOR_VERSION}" \
    && UV_TOOL_BIN_DIR=/opt/modal-bin uv tool install --python 3.12 "modal==${MODAL_VERSION}" \
    && ln -sfn /opt/uv/tools/harbor/bin/python /usr/local/bin/python3 \
    && /opt/harbor-bin/harbor --version \
    && /opt/modal-bin/modal --version \
    && python3 --version \
    && ln -sfn /opt/modal-bin/modal /usr/local/bin/modal \
    && rm -rf /tmp/uv-cache

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
COPY scripts ./scripts
COPY skills ./skills
RUN npm run build \
    && npm prune --omit=dev \
    && chmod 0755 /app/scripts/case-task-package.py \
    && chmod 0755 /app/dist/registry-cli.js /app/dist/intake-plan-cli.js /app/dist/mail-intake-plan-cli.js /app/dist/harbor-cli.js \
    && ln -sfn /app/dist/registry-cli.js /usr/local/bin/case-registry \
    && ln -sfn /app/dist/intake-plan-cli.js /usr/local/bin/case-intake \
    && ln -sfn /app/dist/mail-intake-plan-cli.js /usr/local/bin/case-mail-intake \
    && ln -sfn /app/dist/harbor-cli.js /usr/local/bin/harbor \
    && ln -sfn /app/dist/harbor-cli.js /usr/local/bin/case-harbor \
    && ln -sfn /app/scripts/case-task-package.py /usr/local/bin/case-task-package \
    && mkdir -p /root/.agents/skills \
    && cp -R /app/skills/. /root/.agents/skills/ \
    && test -x /usr/local/bin/case-registry \
    && test -x /usr/local/bin/case-intake \
    && test -x /usr/local/bin/case-mail-intake \
    && test -x /usr/local/bin/harbor \
    && test -x /usr/local/bin/case-harbor \
    && test -x /usr/local/bin/case-task-package \
    && test -x /usr/local/bin/modal \
    && test -f /root/.agents/skills/case-registry/SKILL.md \
    && test -f /root/.agents/skills/case-registry/agents/openai.yaml \
    && test -f /root/.agents/skills/case-registry/references/source-envelope.md \
    && test -f /root/.agents/skills/case-sample-registration/SKILL.md \
    && test -f /root/.agents/skills/case-sample-registration/agents/openai.yaml \
    && test -f /root/.agents/skills/case-sample-registration/references/registry-recording.md \
    && test -f /root/.agents/skills/case-sample-registration/references/runtime-evidence.md \
    && test -f /root/.agents/skills/case-sample-registration/references/harbor-contract.md \
    && test -f /root/.agents/skills/case-sample-registration/references/interpretation.md

ENV NODE_ENV=production \
    CASE_HARBOR_BIN=/opt/harbor-bin/harbor \
    CASE_HARBOR_WORKDIR=/data/evaluations \
    CASE_HARBOR_HOME=/data/harbor-home

CMD ["npm", "start"]
