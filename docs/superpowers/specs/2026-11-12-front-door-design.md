# UC Concierge Front Door — Design

Date: 2026-11-12 · Status: approved in chat, awaiting written-spec review

## 1. Intent

**Goal.** Build one web entry point for the UC Concierge Suite. The user types a request in plain language. The Orchestrator decides which agent should handle it. The front door then opens that agent's own UI in a new tab, with the request already sent. From that point the agent behaves exactly as it does when opened directly.

The model is Skyscanner. Skyscanner finds the right option and redirects you to the provider's site. It does not handle the booking itself.

**Who it is for.** Enterprise users and UC SMEs who should not need to know which of the seven components handles their request.

**Success criteria.**
1. "I want to create a new catalog" opens Onboarding Agent v4 in a new tab, and the request has already been asked there.
2. Routing works without an LLM key (keyword fallback), and it is clearly labelled when it does.
3. The app is hosted on Vercel. Moving to Azure later means changing configuration (agent URLs, LLM provider), not code.
4. It uses the same Aurora / Liquid Glass visual language as uc-agents-concepts.vercel.app/demo.

**User decisions (2026-11-12).**
- This is a real, working app, not a scripted demo.
- The handoff is a Skyscanner-style interstitial plus a new tab.
- The Orchestrator is Claude, called from a Vercel function, behind a provider switch so it can later run on Azure.
- Agents receive the request through `?q=`.
- Data Access shows a "coming soon" landing page.
- The repo is `shivam-ca/uc-concierge-front-door`.
- The app is hosted on Vercel.
- The Knowledge/Owner change ships as a patch in this repo (see §7).

**Assumptions.**
- The Orchestrator and the Shared Validation Service are not destinations. The Orchestrator is this app's routing brain. The Shared Validation Service is listed in the directory as a platform service with no UI.
- Agent UIs run on the user's own machine (`127.0.0.1`) until Azure hosting exists.

## 2. Architecture

```
Browser (Vercel-hosted SPA)                    Vercel Function            LLM
┌──────────────────────────────┐   POST      ┌──────────────┐  HTTPS  ┌─────────────────┐
│ Home → Results card          │──/api/route▶│ route.js     │────────▶│ anthropic (now) │
│   │ submit = window.open      │◀── JSON ────│  provider     │         │ azure-openai    │
│   ▼                           │             │  adapters +   │         │ azure-foundry   │
│ /handoff tab ──BroadcastChannel◀─ decision  │  keyword       │         └─────────────────┘
│   └─ location.replace(agent?q=…)            │  fallback     │
└──────────────┬───────────────┘             └──────────────┘
               ▼ (browser navigation only)
   http://127.0.0.1:8784/?q=…   (Onboarding v4)   etc.
```

Stack: React 19, Vite 6, framer-motion 11, liquid-glass-react, lucide-react. These match `uc-agents-demo` so the Glass components can be reused. A single Vercel Node function is placed at `api/route.js`. Tests use Vitest. There is no router library; routing is two views plus hash, handled in about 30 lines.

## 3. Screens

1. **Home.** An aurora background with a hero line and a single glass search box ("What do you need help with?"). Below it sit example chips taken from the registry, and a row of agent tiles.
2. **Results card.** This replaces the hero after a submit and stays in the front-door tab. It shows:
   - the chosen agent, with its colour, name, confidence bar and a one-line reason;
   - an "Open again" button;
   - up to two alternative agents, each with its own "Open" button.
   A provider badge reads "Claude", "Azure OpenAI", "Azure Foundry" or "Keyword fallback". A "New request" button resets the view.
3. **Handoff tab (`/handoff.html`).** A full-screen aurora with "Routing your request…", then the agent card and "Opening Onboarding Agent…" for about 1.5s, then a redirect. It also provides a "Stay here / choose another" escape.
4. **Agents directory (`#agents`).** Cards for all seven components:
   - Live: Onboarding v4, Tracker v7, Knowledge, Owner.
   - Coming soon: Data Access.
   - Platform: Orchestrator, Shared Validation Service.
   Each card shows what the component handles, example requests and an "Open" link where a UI exists.
5. **Settings (`#settings`).** Editable agent URLs, saved in `localStorage` per browser, with a reset-to-defaults button. A warning appears when two agents share a host:port; Tracker v7 and Knowledge both default to `:8765`.
6. **Coming soon (`#soon/<agent>`).** A glass page showing what the agent will do, the user's request with a copy button, and the interim path. For Data Access, the interim path is "raise a standard access request".

## 4. Handoff flow (popup-safe)

1. When the user submits, and while still inside the click/keypress gesture, the app calls `window.open('/handoff.html#<nonce>', '_blank')`. Browsers allow this because it happens inside the gesture.
2. The front door POSTs `/api/route`. When the decision arrives, it is sent on a `BroadcastChannel('concierge-handoff')` with that nonce. The handoff tab also asks for it again on load, which covers a race where the decision arrives first. The decision is mirrored to `sessionStorage` so it survives a reload.
3. The handoff tab then picks one of three outcomes:
   - **Confidence ≥ 0.6 and the agent has a URL:** show the card, then after 1.5s run `location.replace(buildAgentUrl(agent, query))`.
   - **Confidence < 0.6:** show the top three choices as buttons. There is no automatic redirect.
   - **The agent has no URL (coming soon):** show the coming-soon landing inside the tab.
4. If `window.open` returned `null` (the popup was blocked), the results card shows a prominent "Open <agent>" button instead.
5. `buildAgentUrl` appends `q=<urlencoded query>&from=concierge` to the configured URL. It preserves any existing query string and hash, for example `/v7?q=…#assistant`. The request text is also copied to the clipboard as a fallback (best effort; failures are ignored).

## 5. Orchestrator API — `POST /api/route`

- **Request.** `{ "query": string }`. The query is trimmed and must be 1–1000 characters. If `CONCIERGE_PASSCODE` is set, the header `x-concierge-passcode` must match it.
- **Response.**
  ```json
  { "agent": "onboarding", "confidence": 0.92, "reason": "Creating a catalog is an onboarding request.",
    "alternatives": [{ "agent": "knowledge", "confidence": 0.31, "reason": "…" }],
    "provider": "anthropic", "model": "claude-haiku-5-5", "fallback": false, "ms": 640 }
  ```
- **Routing rules.**
  - Agent IDs are validated against the routable set: `onboarding`, `tracker`, `knowledge`, `ownership`, `access`. Any unknown ID drops that entry.
  - Confidence is clamped to 0–1.
  - There are at most two alternatives.
- **Providers.** `ROUTER_PROVIDER` selects the adapter, and each adapter has the same signature, `classify(query, catalog) → raw decision`:
  - `anthropic` (default) uses the Messages API with one forced tool, `route_request`, and the model from `ROUTER_MODEL` (default `claude-haiku-5-5`). It needs `ANTHROPIC_API_KEY`.
  - `azure-openai` uses chat completions with one forced function. It needs `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_DEPLOYMENT`; `AZURE_OPENAI_API_VERSION` is optional.
  - `azure-foundry` uses Claude on Azure AI Foundry, which speaks the Anthropic Messages format. It needs `AZURE_FOUNDRY_ENDPOINT` and `AZURE_FOUNDRY_API_KEY`.
- **Catalog.** The prompt's catalog is built from the same `agents.js` registry the UI uses (`handles` and `examples`), so the UI and the router cannot drift apart.
- **Fallback.**
  - A missing key, a provider error or an 8s timeout makes the server fall back to the shared keyword router (`src/lib/keywordRouter.js`). The response then carries `fallback: true` and `provider: "keywords"`.
  - If the function itself is unreachable, the browser runs the same keyword router locally.
- **Abuse limits.** There is a best-effort in-memory limit of 20 requests per minute per IP, per function instance; exceeding it returns 429. Request text is never logged. Only the agent, confidence, provider and latency are logged.
- **Errors.** The API returns 400 for bad input, 401 for a wrong passcode and 429 for the rate limit. The UI shows a glass toast for each and never shows a blank screen.

## 6. Agent registry — `src/config/agents.js`

Each entry has these fields: `id`, `name`, `short`, `color`, `kind` (`live` | `soon` | `platform`), `tagline`, `handles` (the text used for routing), `examples[]`, `defaultUrl` and `version`.

| id | Default URL | Notes |
|---|---|---|
| onboarding | `http://127.0.0.1:8784/` | Onboarding Agent v4 Simple Finder |
| tracker | `http://127.0.0.1:8765/v7` | Tracker Agent v7 (Assistant is the default tab) |
| knowledge | `http://127.0.0.1:8765/chat` | Knowledge Agent (package launcher port, which clashes with Tracker; see Settings) |
| ownership | `http://127.0.0.1:8766/stale-owners` | Owner Validation |
| access | — | coming soon |
| orchestrator, validation | — | platform, not routable |

URLs are resolved in this order: Settings (`localStorage`), then `VITE_AGENT_URL_<ID>` set at build time, then `defaultUrl`. For Azure, the plan is to set the env vars in Vercel and redeploy.

## 7. Agent-side `?q=` support

The same small behaviour goes into each agent:
- On load, read `q` (and `from`) and remove both from the address with `history.replaceState`.
- Put `q` into the agent's input and submit it once.
- Show a small "From UC Concierge" chip.

If `q` is missing, nothing changes.

| Agent | Where | Delivery |
|---|---|---|
| Onboarding v4 | `web/app.js`, input `#q` in `#composer` | branch `feat/concierge-prefill` off `feat/simple-finder` in `onboarding-agent-demo`, pushed, not merged |
| Tracker v7 | `web/v7/index.html`, Assistant input `#a-text` | branch `feat/concierge-prefill` off `feat/v7-langsmith` in `uc-concierge`, pushed, not merged |
| Knowledge | `web/chat/index.html`, composer `#msgtext` (new chat) | patch in this repo: `agent-patches/knowledge-agent/` |
| Owner | `web/stale-owners/index.html` | same patch; `q` fills the page's search/filter if one exists, otherwise it is shown as a "Request from UC Concierge" banner (the Owner agent is review-driven, with no chat) |

`agent-patches/knowledge-agent/` contains the changed files, a unified `.patch` against the 6 Nov `KnowledgeAgent.zip`, and a README with apply steps. A rebuilt `Downloads/KnowledgeAgent_prefill.zip` is produced for convenience; it is not committed.

Each agent repo runs its existing test suite, and new tests are added where a JS or HTML test harness exists. Otherwise each change gets a manual check and a headless-browser check.

## 8. Testing

- Vitest:
  - `keywordRouter` (golden prompts → agent; the catalog example in §1 is required);
  - provider adapters, with `fetch` mocked: request shape, tool parsing, error → fallback;
  - `api/route` handler: validation, passcode, rate limit, ID validation and clamping;
  - `buildAgentUrl`, including existing query/hash, encoding and a missing URL;
  - URL-resolution precedence.
- A headless Edge screenshot pass (with `--no-proxy-server`) covers Home, the Results card, Handoff, Agents, Settings and Coming soon, in both light and dark.
- An end-to-end check runs locally with `vercel dev` or Vite plus the function: submit "I want to create a new catalog" with Onboarding v4 running on :8784 and confirm that the new tab asks it automatically.

## 9. Deployment

- The code is pushed to `main` of `shivam-ca/uc-concierge-front-door`.
- Vercel deployment uses `npx vercel@65.12.1 deploy --prod` (CLI, as with the concepts site), with project `uc-concierge-front-door`.
- The user sets `ANTHROPIC_API_KEY`, and optionally `CONCIERGE_PASSCODE`, in Vercel. Claude does not handle keys. Until a key is set, the app runs with keyword fallback.
- The README covers running locally, the env vars, the Azure switch-over steps, and how to run each agent.

## 10. Out of scope (YAGNI)

- User sign-in and SSO.
- Saving request history on a server.
- Calling agent APIs directly.
- Embedding agents in iframes.
- Building the Data Access UI.
- Shared Validation Service behaviour.
- Health-pinging local agents from the Vercel page; Private Network Access rules make this unreliable, so it is left out.
