OPEN SOURCE

A ledger for people who build by prompting.

If you code by directing an AI, your real history isn't the commits — it's the directives: what you told the agent, and why. OPEN SOURCE records each one as a signed, hash-chained node mapped to the branch it produced, so your build has a spine you can walk back through instead of a pile of prompts you'll never find again.

Every directive links to a real GitHub branch and can be verified live against the public API — green check, real commit, no trust required. Add margin notes to any node or open the Notebook to write and learn, not just log. Tag directives by phase, search everything you've ever written, and export the whole workspace anytime.

Navigate fast: the wordmark is Home, the rail always highlights the project you're in, and `Esc` / `Alt+←` step back to the ledger while `j` / `k` jump between directives. Manage projects two ways — **Archive** hides a project reversibly, and **Delete** removes it permanently (guarded: you type the project's name to confirm, because localStorage is the only copy). The in-app **Guide** covers branch verification, what stays private, and a full set of Git commands for operating a repo behind your directives.

It's a single static file. Drop it in any repo's /docs, enable Pages, and it auto-pins to that repo. No account, no backend, no build step — your workspace lives in your browser and nothing leaves it unless you publish.

How the trust works
content_hash = sha256([prompt, reasoning, branch]) → chain_hash = sha256(content ‖ parent) → head signed with a per-device key. Verification recomputes the whole chain and is fail-closed: a tampered trail collapses instead of rendering. Your private notes, journal, and checklist are never chained and never published — private by construction.

Part of the Aletheia stack. Verify, fail closed.
