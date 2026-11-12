# Knowledge + Owner Agent: UC Concierge hand-off

This patch lets UC Concierge open two pages with the user's request already handed over, using the address form `?q=<request>&from=concierge`:

- **Knowledge Agent chat (`/chat`).** The question is asked once, as a new chat.
- **Owner page (`/stale-owners`).** The request appears in a banner and the search box gets focus. The page does not filter on it, because the page is review-driven and a whole sentence would match nothing.

In both pages, the request is removed from the address after it is read, so reloading the page never re-asks it.

**Base:** the `KnowledgeAgent.zip` package dated 2026-11-06. It has no git history.

**Changed files:** `web/chat/index.html` and `web/stale-owners/index.html`. Each file gains about 30 lines, and nothing else changes.

The two helper functions are byte-for-byte the canonical copy in `../prefill/concierge-prefill.js`. The front door's tests check this.

## Apply

Pick one of these:

- Copy the two files from `web/` over the same paths in your KnowledgeAgent folder.
- From inside the KnowledgeAgent folder, apply the patch:

  ```bash
  git apply path/to/concierge-prefill.patch
  ```

  `git apply` works without a repository. You can also use `patch -p1 < concierge-prefill.patch`.

Then restart the agents with `restart_agent.bat` (Knowledge) and `restart_owner.bat` (Owner).

A patched copy of the whole package is also available as `KnowledgeAgent_prefill.zip` in Downloads. That zip is not committed to this repo.

## Check

1. Open `http://127.0.0.1:8765/chat?q=What%20are%20the%20catalog%20naming%20standards%3F&from=concierge`.
   The question should be asked once, a "From UC Concierge" toast should appear, and `q` should disappear from the address.
2. Open `http://127.0.0.1:8766/stale-owners?q=Who%20owns%20the%20sales%20schema%3F&from=concierge`.
   The banner should show the request, and the search box should have focus.

**Port clash:** the Knowledge Agent and Tracker v7 both default to port 8765. If you run both, start one of them on another port. Then enter that agent's new address in UC Concierge under **Settings**.
