# Feishu Codex Agent

An early, chat-only prototype of a Feishu teammate powered by Codex.

The pilot intentionally starts with a narrow boundary:

- receives direct messages through the configured Feishu app;
- keeps a persistent Codex conversation for each Feishu chat;
- passes each message directly to the underlying Codex thread without an
  application-written persona or policy prompt;
- replies as the app bot;
- ignores duplicate event deliveries;
- can acquire and retain the pilot user's renewable Feishu login through a
  self-service link and QR flow inside the bot conversation.

The login makes user-context APIs available to `lark-cli`. The actual Codex tool
permissions remain controlled separately by the container and `CODEX_*`
settings below.

## Prerequisites

- Node.js 20 or newer;
- `codex` logged in locally for development, or OpenAI API credentials in deployment;
- `lark-cli` configured with a Feishu self-built app whose bot is enabled;
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

## Authorize the Railway agent

The authorization exchange is handled by the outer bot harness, not by a model
turn, so it remains usable even when Codex itself is unavailable.

1. Send `/authorize` (or plain `authorize`) to the bot.
2. Open the exact Feishu link it replies with, or scan the attached QR code.
3. Finish authorization with the same Feishu account that sent the command.
4. Return to the bot and send `/authorized` (or `authorization complete`).
5. Send `/auth-status` (or `auth status`) at any time to verify the stored login.

`/authorize` requests the domains in `LARK_AUTH_DOMAINS`, which defaults to
`all` for this private single-user pilot. Narrow requests are also supported:

```text
/authorize domain docs,drive
/authorize scope calendar:calendar:readonly
```

The temporary device code is bound to both the Feishu sender and chat, expires
after Feishu's stated lifetime, and is stored in a mode-600 file until the
second command completes it. The resulting renewable login is stored by
`lark-cli`; put its config, data directory, authorization state, and QR
directory on a persistent Railway volume. Startup preserves existing user
logins instead of recreating a bot-only profile.

The bot sends the link before attempting the QR upload. If the app lacks the
`im:resource` bot scope, the link still works; grant that scope to enable the
image attachment.

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
4. Authorize user-context access from the private bot conversation.
5. Add one action family at a time: documents, then calendar, then mail.
6. Put external writes behind an interactive confirmation card and keep an audit log.

For production, use a dedicated Feishu app and service identity rather than a developer's personal login, and store credentials in the hosting platform's secret manager.
