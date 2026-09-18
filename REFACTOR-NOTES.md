# Prompt / code review refactor

## Pre-edit inventory (main 280af7ea45208bb48367d2cd62a9430deb37af98)

Read all 1,445 lines of index.html and the README before changing application code.

- `os-local-v1`: `{projects, order, handle, seeded, metaSeeded}`. Projects contain id, title, repoUrl, createdAt, directives, forkOf, ancestry, publishedAt; optional journal, checklist, archived, drafts. Directives contain prompt, reasoning, branch, contentHash, chainHash, ts, plus private note, phase, deps and branch verification metadata. Drafts contain id, prompt, why, branch, phase, fromScan.
- `proj:<id>`: local sealed snapshot with author, public JWK, signature, headChain, timestamps, core directives and fork/ancestry context. Explicit resealing replaces that project's snapshot. No automatic migration is needed.
- `os-key-v1`: extractable ECDSA P-256 private/public JWK pair. Keep this mechanism; describe it as a local/device signature, not identity attestation.
- Legacy canonical body is exactly `JSON.stringify([prompt, reasoning, branch])`. Content uses SHA-256; chain uses SHA-256 of the content hex concatenated with parent hex. Genesis is 64 zeroes; forks start at the source chain hash. ECDSA/SHA-256 signs the head hex. Notes, journal, checklist, phase, dependency tags, GitHub observations, timestamps, and project metadata are not in the hash body.
- `verifyRecord` recomputes chain and signature; sealed rendering collapses on failure. Before refactor, sealing did not first verify the editable chain. Add that gate without changing legacy canonicalization.
- Publishing language appears in header/home, rail, project actions/status, notebook privacy copy, checklist, deletion dialogs, Guide, sealing dialog/toasts and boot. Internal names and historical seed prompts can remain.
- Scanner: `scanRepo` fetches first 30 branches and default-branch commits, caches ten minutes; `scanReview` selects candidates; `stageDrafts` currently synthesizes prompts. Replace those synthesized prompts with empty fields, retain commit messages as source context, add editable SHA pairs. `chainDraft` remains explicit.
- Brief: `buildBrief`, `agentBrief`, text copy, JSON export; derived from project plus branch observations and open drafts. Extend with anchors and clearly identified optional private context, never mutate chain.
- Map: inline SVG only, no graph library. Phase colors, local dependency tags, package.json lookup, fork links and clickable nodes stay.
- Seeds: HOROS_SEED and META_SEED; locally hashed/signed at first run, guarded by seeded/metaSeeded. Preserve historical prompt text and existing stored seed records.
- Network: two Google font links (remove); GitHub API branch lookup with repo fallback, scanner branches/commits, optional package.json. GitHub hyperlinks/API entry points in brief are navigation only. No other network dependency.
- Existing backup v1 exports only editable local data, not sealed snapshots or keys. Preserve importing this format; include sealed snapshots in new backups so review/export carries signatures. Never export the private key.

## Compatibility design

Missing schemaVersion means legacy, using the exact three-item hash body. New records use schemaVersion 2 and canonical array `[2, prompt, reasoning, branch, baseCommit, resultCommit]`. Both anchors are empty for an unanchored manual change or both are full 40-character Git SHA-1 values. Reject unknown versions and anchor fields on legacy records; do not reinterpret or rewrite history. Mixed legacy/v2 chains are supported. Sealing copies each record's original version and anchors. Existing localStorage keys and internal directive names remain.

## API reference

GitHub compare endpoint: https://docs.github.com/en/rest/commits/commits#compare-two-commits . Public comparisons need no token. File lists are limited to 300 entries and patches can be absent. Present these limits; use immutable full SHAs, request caching, clear offline/rate-limit errors, and links to GitHub. Comparisons with a merge base different from the requested base must be labeled as GitHub merge-base comparisons rather than exact endpoint diffs.

## Implementation and verification report — 2026-09-18

Branch: `refactor/prompt-diff-workflow`, based on `280af7ea45208bb48367d2cd62a9430deb37af98`. The delivery message records the final commit SHA. Main was not changed or merged; the work is local for review.

### Files and behavior

- `index.html`: all runtime changes remain in the original static file. New home thesis and repository-first action; Changes/History/Map/Notes; versioned commit anchoring; prompt diff; lazy GitHub code comparison; editable detection candidates with blank prompts; preview before saving; local Seal Review; expanded Continue with AI; commit labels in Map; updated Guide and system fonts.
- `README.md`: product flow, privacy/storage, canonical schemas, trust boundaries, limitations, deployment and test commands.
- `REFACTOR-NOTES.md`: pre-edit inventory, compatibility design and this report.
- `.gitignore`: excludes test dependencies and generated acceptance artifacts.
- `package.json`, `package-lock.json`: reproducible development-only Playwright dependency and test commands; no runtime dependency or application build step.
- `tests/harness.cjs`, `tests/legacy.cjs`, `tests/refactor.test.cjs`, `tests/browser.cjs`, `tests/github-live.cjs`: isolated regression, legacy compatibility, browser acceptance and public-API tests.

Preserved: static/local-first deployment, original storage keys, legacy hash body, linked SHA-256 chains, ECDSA P-256 signing, signature verification and fail-closed rendering; branch checks, local notes/journal/checklist/phase/dependency metadata, project management, two fork modes, lineage, map, seeds and text/JSON context output. Historical seed prompt text was not rewritten.

No storage migration runs. Legacy records retain missing schemaVersion and their original bytes. New records use version 2; old and new records can coexist in one chain. New backups add sealed snapshots without exporting the private key; old backup imports still work. Import retains existing sealed snapshots. Explicit resealing retains the original app's replacement behavior, now disclosed in the dialog and Guide.

### Results

| Area | Result and evidence |
| --- | --- |
| Legacy | PASS. Records created and signed by the original pre-refactor code verify in the new code and Chromium. Original stored sealed JSON remains byte-for-byte unchanged on load. Editable history, private notes, journal and v1 backup import survive. Tests use isolated generated fixtures; they do not access the user's actual browser storage. |
| Provenance | PASS. Mixed legacy/v2 history verifies and reseals. Altered prompt, intent, branch, base SHA, result SHA and schema fail chain verification. Bad signatures collapse sealed content; invalid sealed history cannot fork/clone or generate context. |
| Prompt Diff | PASS. Initial prompt, additions, removals, context, multiline, empty, unchanged, CRLF normalization, HTML escaping, repeated lines, 300 deterministic randomized reconstruction cases and bounded large-edit fallback. |
| Code Diff | PASS. SHA-addressed comparison, file stats/patch display, identical commits, invalid base/result, omitted patch, diverging merge base, 300-file notice, request deduplication/cache and operation independent of a deleted branch. |
| Public API | PASS live. Compared `9e6e6c953c2a1319676efef35cf6ff60cba93342` → `280af7ea45208bb48367d2cd62a9430deb37af98` in this public repository: index.html and its patch returned. Identical and invalid SHA checks passed. The actual app's comparison also loaded in Chromium using GitHub CORS, without credentials or an API proxy. |
| Failure handling | PASS with controlled responses. 403/429 provide retry time and cooldown; invalid SHA, offline, timeout, HTTP failure and missing patch remain legible. A failed local write leaves the reviewed draft available instead of reporting a successful save. Branch rechecks remove stale positive observations after a missing-branch response. |
| Detection | PASS. Staging does not append provenance; actual prompt is required; commit message stays source context; candidate base/result remain editable. Double save is guarded. |
| Seal/privacy | PASS. Current provenance is verified before signing. Private notes, journal, checklist, drafts, phases and dependency tags are absent from the snapshot. UI explicitly describes a local snapshot. |
| Continue with AI | PASS. Text/JSON includes prompts, intents, commits, provenance/branch observations, drafts and labeled private context. Generation leaves project data and storage unchanged. Browser JSON download passed. |
| Backup | PASS. Export contains editable/private data and sealed snapshots, no private key. Import restores absent seals, keeps existing ones and retains notes; reload passes. |
| Map/History/Notes | PASS. Commit labels, history anchors, local dependency/phase metadata, fork source hashes, private journal and note rendering retained. |
| Browser acceptance | PASS in headless Chromium at desktop 1440×1000 and mobile 390×844. Connect → detect → attach → preview → save → repeat → inspect both diffs → verify branch → history/map/notes → context JSON → seal → backup/import → reload. No page errors or third-party boot requests. Screenshots inspected. |

Final automated suite: original-app legacy compatibility script, **14 passing Node regression tests**, **two passing browser scenarios** (full flow and legacy fixture), and **live GitHub checks including browser CORS**. `git diff --check` passed.

### Exact verification commands

Working directory: `C:\Users\SuperAdmin\.vscode\Open-source`.

```powershell
# Development dependency setup actually used (Chromium already installed):
npm install --ignore-scripts --no-audit --no-fund

# Targeted checks during implementation:
node tests/legacy.cjs
node --test tests/refactor.test.cjs

# Final suites:
npm test
npm run test:browser
npm run test:github
git diff --check
```

Runtime: Node v24.19.0; Playwright 1.63.0. Browser tests create their own ephemeral loopback server and isolated contexts. `test-results/` contains generated screenshots plus synthetic backup/brief artifacts and is deliberately not committed.

### Limitations, deferred work and merge assessment

Public API limits, omitted/partial patches, merge-base semantics, first-parent candidate selection, root-commit/manual handling, full SHA requirements and bounded diff fallback are disclosed in the app and README. GitHub errors were simulated where triggering real failures would be unreliable; live public comparisons and browser CORS were checked separately. Chromium was exercised; Firefox/WebKit were not. The original sidebar limit of 20 recent seals remains, while backup exports all seals.

Key custody hardening and broader browser certification remain future work. No backend, authentication, token requirement, LLM, framework, database, new agent or Git implementation was added. No required directive feature is deferred.

**GO for review and merge**, based on the passing compatibility, provenance, API and browser checks. No merge or push was performed.
