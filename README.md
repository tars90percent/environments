# Feishu Codex Agent

An early, chat-only prototype of a Feishu teammate powered by Codex.

The pilot intentionally starts with a narrow boundary:

- receives direct messages through the configured Feishu app;
- keeps a persistent Codex conversation for each Feishu chat;
- passes each message directly to the underlying Codex thread without an
  application-written persona or policy prompt;
- replies as the app bot;
- ignores duplicate event deliveries;
- includes the official Lark/Feishu Agent Skills so Codex can operate
  `lark-cli` and handle authentication conversationally.

The login makes user-context APIs available to `lark-cli`. The actual Codex tool
permissions remain controlled separately by the container and `CODEX_*`
settings below.

## Prerequisites

- Node.js 20 or newer;
- `codex` logged in locally for development, or OpenAI API credentials in deployment;
- `lark-cli` configured with a Feishu self-built app whose bot is enabled;
- the official Lark skills installed locally with `npx skills add larksuite/cli -y -g`;
- the app subscribed to `im.message.receive_v1` with the required IM scopes.

## Run locally

```sh
npm install
cp .env.example .env
npm run check
npm start
```

Then send the bot a direct message in Feishu. Stop the service with Ctrl-C.

Send `/new` as a message, or select the app's native `/new` slash command, to
disconnect that Feishu chat from its current Codex thread. The next ordinary
message starts a fresh Codex session with no prior conversation context. The old
Codex transcript remains on disk but is no longer used by the chat.

## Feishu capabilities and authorization

The deployment image installs the official Lark skill bundle with:

```sh
npx skills add larksuite/cli -y -g
```

The skills teach Codex how to select user or bot identity, operate Feishu
services, diagnose missing scopes, and complete the split device-code login
flow. Authentication is ordinary agent work rather than a special harness
command: ask the agent whether it can access a calendar, document, mailbox, or
other Feishu resource, then follow its explanation.

The resulting renewable user login is stored by `lark-cli` under its configured
directory. On Railway, `LARKSUITE_CLI_CONFIG_DIR` points to `/data/lark-cli`, so
the login survives image rebuilds and service restarts. The outer harness only
handles message transport and `/new`; phrases such as `authorize`,
`authorization complete`, and `auth status` are passed directly to Codex.

The checked-in example is safe by default. The local ignored `.env` currently
allowlists only the developer's Feishu `open_id`; group messages remain disabled.

## Agent permissions

The inner Codex process is read-only and offline by default. For an isolated
cloud container that should act as the agent's machine, configure:

```env
CODEX_SANDBOX_MODE=danger-full-access
CODEX_NETWORK_ACCESS=true
CODEX_WEB_SEARCH_MODE=live
CODEX_APPROVAL_POLICY=on-request
CODEX_APPROVALS_REVIEWER=auto_review
```

With this profile, Codex does not apply its own filesystem or network sandbox.
The container, its Unix user, mounted volumes, and injected credentials become
the security boundary. Persist important working data under `AGENT_WORKSPACE`
(on Railway, under `/data`); files elsewhere may disappear on redeploy.

`on-request` lets Codex raise approval requests for actions that use the
approval mechanism. `auto_review` has an additional model review those requests
instead of waiting for a person in the Feishu chat. Full-access actions do not
need sandbox-escalation approval, so the Railway container remains the effective
boundary for ordinary commands and file changes.

User authorization alone does not grant the inner Codex process network or
filesystem access. Those permissions must still be enabled deliberately with
the `CODEX_*` variables above.

## Pilot sequence

1. Run the service locally and verify a private conversation.
2. Register a separate production app and a dedicated `lark-cli` profile.
3. Deploy the same chat loop as an always-on service.
4. Ask the agent to authorize user-context access from the private bot conversation.
5. Add one action family at a time: documents, then calendar, then mail.
6. Put external writes behind an interactive confirmation card and keep an audit log.

For production, use a dedicated Feishu app and service identity rather than a developer's personal login, and store credentials in the hosting platform's secret manager.
