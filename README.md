# UC Concierge: Front Door

One front door for the UC Concierge Suite. You type what you need in plain language. The **Orchestrator**, an LLM, decides which agent owns that kind of request. The front door then opens **that agent's own app in a new tab**, with your request already asked, and the agent takes it from there. It works the way Skyscanner does: Skyscanner finds the right provider and hands you over, and it never sells the ticket itself.

```
 you ──► front door ──► POST /api/route ──► Orchestrator (Claude / Azure)
            │                                   │ {agent, confidence, reason, alternatives}
            │◄──────────────────────────────────┘
            ├─ results card in this tab (best match, confidence, other options)
            └─ new tab /handoff.html ──► agent app ?q=<request>&from=concierge ──► the agent asks it
```

| Component | What the front door does |
|---|---|
| Onboarding Agent v4 | Opens `/onboarding-agent?q=…`. The request is asked straight away. |
| Tracker Agent v7 | Opens `/v7?q=…`. The Assistant asks the request. |
| Knowledge Agent | Opens `/chat?q=…`. The request is asked as a new chat. |
| Owner Agent | Opens `/stale-owners?q=…`. The request is shown in a banner and the search box gets focus. |
| Data Access Agent | Shows a "coming soon" page with interim steps. This changes automatically once a URL is configured. |
| Orchestrator, Shared Validation Service | Platform pieces. They are listed on the Agents page and are never routed to. |

**Safety behaviour:**

- **Low confidence (below 0.6):** nothing opens automatically. You choose from every agent, starting with the Orchestrator's best guess.
- **LLM unavailable:** if the LLM can't be reached, or no key is set, deterministic keyword rules route the request. The page labels this as "Keyword fallback".
- **Logging:** request text is never logged.

## Run locally

```bash
npm install
npm run dev            # http://localhost:5173  (the dev server also serves /api/route)
npm test               # unit tests (Vitest)
npm run build          # production build into dist/
```

To use Claude locally, create `.env.local` with the variables from `.env.example`, for example `ANTHROPIC_API_KEY=…`. Without a key, the app still works on the keyword fallback.

## Start the agents (local)

| Agent | How | Default address |
|---|---|---|
| Onboarding v4 | `onboarding-agent` repo, branch `feat/concierge-prefill`. Run `.venv\Scripts\python -m onboarding serve --port 8784`, or use `start_versions.bat`. | `http://127.0.0.1:8784/onboarding-agent` |
| Tracker v7 | `uc-concierge` repo, branch `feat/concierge-prefill`. Run `start_v7.ps1 serve`. | `http://127.0.0.1:8765/v7` |
| Knowledge | `KnowledgeAgent` package with [agent-patches/knowledge-agent](agent-patches/knowledge-agent/README.md) applied. Run `start_knowledge.bat`. | `http://127.0.0.1:8765/chat` |
| Owner | Same package. Run `start_owner.bat`. | `http://127.0.0.1:8766/stale-owners` |

**Port clash:** Tracker v7 and the Knowledge Agent both default to port 8765. If you need both, run one of them on another port. Then enter its address under **Settings** in the front door. Settings are saved per browser, and the page warns you about clashes.

The front door only *navigates* to these addresses. Your browser opens them, so a Vercel-hosted front door works with agents running on your own machine.

## Deploy (Vercel)

```bash
npx vercel@65.12.1 link --yes --project uc-concierge-front-door     # once
npx vercel@65.12.1 env add ANTHROPIC_API_KEY production              # you paste the key; it is never committed
npx vercel@65.12.1 deploy --prod --yes
```

| Variable | Purpose |
|---|---|
| `ROUTER_PROVIDER` | `anthropic` (default), `azure-openai` or `azure-foundry`. |
| `ROUTER_MODEL` | The model or deployment for the Claude providers. The default is `claude-haiku-5-5`. |
| `ANTHROPIC_API_KEY` | Required for `anthropic`. |
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` | Required for `azure-openai`. |
| `AZURE_FOUNDRY_RESOURCE`, `AZURE_FOUNDRY_API_KEY` | Required for `azure-foundry` (Claude on Microsoft Foundry). |
| `CONCIERGE_PASSCODE` | Optional. When set, `/api/route` requires it. Users enter it under Settings. |
| `VITE_AGENT_URL_ONBOARDING`, `…_TRACKER`, `…_KNOWLEDGE`, `…_OWNERSHIP`, `…_ACCESS` | Optional agent addresses, applied at build time. A user's own Settings override them. |

## Moving to Azure

You don't need to change any code:

1. Set `ROUTER_PROVIDER=azure-openai` plus the `AZURE_OPENAI_*` variables, or `ROUTER_PROVIDER=azure-foundry` plus the `AZURE_FOUNDRY_*` variables.
2. Point `VITE_AGENT_URL_*` at the Azure-hosted agents.
3. Redeploy.

The routing prompt and the agent list come from the same registry, [src/config/agents.js](src/config/agents.js), so the UI, the keyword fallback and the LLM can't drift apart.

## Security notes

- The production URL is public. Set `CONCIERGE_PASSCODE` if the key should only be used by your team.
- Rate limiting is 20 requests per minute per IP, per function instance. It is best effort.
- The request text is sent to the configured LLM provider. It is not stored or logged by the front door; logs hold only the chosen agent, confidence, provider and latency.

## Layout

```
api/route.js             Vercel function (adapter only)
src/server/              handleRoute, orchestrate (timeout + fallback), providers, prompt, rate limit
src/lib/                 agent URLs, keyword router, normalizer, route client, handoff channel, submit flow, choices
src/views/, src/handoff/ React UI (Aurora Glass); handoff.html is the redirect tab
agent-patches/           canonical ?q= helper + the Knowledge/Owner patch
docs/superpowers/        design spec and implementation plan
```
