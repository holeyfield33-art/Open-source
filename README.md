# OPEN SOURCE

**DON'T JUST DIFF THE CODE. DIFF THE PROMPTS.**

Git tells you what changed. OPEN SOURCE tells you what you told the AI that caused it.

When you develop with an AI, a commit often loses the instruction and intent behind the code. OPEN SOURCE keeps that account alongside the resulting Git change, so you can review how the prompts evolved, understand the decisions, and carry useful context into your next coding session.

It is a static, browser-local development history and change-review tool. No account, backend, database, token, or AI service is required.

## How it works

1. **Connect a public GitHub repository**, or create a project manually.
2. **Detect Changes** to stage an editable code transition, or enter the base/result commit SHAs yourself.
3. **Attach the actual AI instruction** and your intent. Detection never invents prompts.
4. **Review Prompt Diff beside Code Diff**, then save the AI Change to provenance.
5. Repeat to build the history. Use **Continue with AI** for the next session.
6. **Seal Review** to sign a local snapshot; export your workspace when needed.

The first change shows its complete initial instruction. Later changes compare their prompt with the preceding change in that project. Saved changes are immutable: record another change to correct or extend the history.

## Core capabilities

- **Prompt Diff:** line-oriented additions, removals and unchanged context, with no runtime diff dependency.
- **Code Diff:** public GitHub comparisons between full base/result SHAs, changed files, additions/deletions, available patches and a comparison link. Cards fetch as they become visible; successful results cache in memory for ten minutes.
- **AI Change History:** prompts, intent, branch context and immutable commit anchors in the primary Changes view. Manual changes may leave both anchors empty.
- **Provenance:** deterministic hashes, parent-linked history, local/device signatures, verification before sealing and fail-closed sealed rendering.
- **Continue with AI:** portable text and JSON containing changes, prompts, intents, commits, verification state, open drafts and private notes/next work. Generating it does not alter provenance.
- **Development Map:** clickable change/commit nodes, phases, fork lineage and local dependency tags, including suggestions from a repository's package.json.
- **Private Notes:** per-change notes, a project journal and a checklist outside the sealed payload.
- **Project management:** search, archive/unarchive, guarded deletion, **Try Alternative** from an earlier sealed change, and **Clone History** from a sealed project's head.

Navigation is **Changes | History | Map | Notes**. History exposes full hashes and commit anchors. The wordmark returns home; Esc / Alt+← step back and j/k move between changes when you are not typing.

## Privacy and storage

All workspace data is stored in this browser's localStorage on this origin. Other visitors cannot see it. **Seal Review does not publish or upload anything.** It creates a local signed snapshot. As in the original app, explicitly resealing replaces that project's current local snapshot; export first if you need to retain a previous snapshot.

GitHub requests contain repository names, branch names or commit SHAs. Prompt text and notes are not sent to GitHub. There are no remote fonts, analytics, LLM calls or external runtime scripts. Links open GitHub only when followed.

Workspace backups include **private notes, journal, drafts, checklist, editable history and sealed snapshots**. Continue with AI also includes private context and labels it clearly before copying/exporting. Treat those outputs accordingly. The private signing key is never exported in a workspace backup; imported snapshots verify using their embedded public key. A different browser uses its own key for future seals.

Clearing browser data loses the workspace and signing key. Export regularly. Backups retain the `vibe-ledger-backup` format identifier for compatibility. Version 2 adds sealed snapshots; version 1 backups remain importable. Import explicitly merges editable projects by id and restores only absent sealed snapshots. Existing sealed snapshots are not overwritten by import.

## Technical trust model

Legacy changes retain their original canonical body, byte for byte:

```js
JSON.stringify([prompt, reasoning, branch])
```

New changes carry `schemaVersion: 2` and hash:

```js
JSON.stringify([2, prompt, reasoning, branch, baseCommit, resultCommit])
```

Both anchors must be full 40-character hexadecimal SHAs, or both must be empty. The chain algorithm remains:

```text
contentHash = SHA-256(canonical body)
chainHash   = SHA-256(contentHash hex + parent chainHash hex)
signature   = ECDSA P-256 / SHA-256 over the head chainHash hex
```

Genesis is 64 zeroes; a fork starts at its source change's chain hash. Mixed legacy/new chains verify without rewriting old records. Unknown schemas and anchor fields attached to legacy records fail verification. Storage keys remain `os-local-v1`, `proj:<id>` and `os-key-v1`; there is **no data migration**.

The app verifies history before appending or sealing, and checks both chain and signature when opening sealed history. Invalid sealed content collapses and cannot be cloned or used to generate AI context. Private notes and journal, phases, dependency tags, checklists, drafts and GitHub observations are outside the hash body and sealed payload. Timestamps, project title, repository URL and descriptive ancestry are context, not authenticated by the head signature.

The signing key is an extractable key stored in localStorage. This is a local/device provenance signature, not enterprise identity, hardware-backed custody or proof of authorship. Provenance detects changes to the recorded instruction and commit anchors; it does not prove that a prompt caused the code or that the code is correct. Key custody hardening is deferred.

## Limitations

- Only public GitHub resources can be checked without authentication. Branch verification confirms a branch exists when checked; it is separate from commit anchoring. Saved branch observations are historical. A deleted branch does not prevent comparisons using reachable commit SHAs.
- Detect Changes samples the first 30 branches and eight recent default-branch commits. Commit candidates use the first parent as a proposed base, including merges. Branch candidates need a user-selected base. Root commits have no parent: choose another transition or save an unanchored manual change.
- The [GitHub compare API](https://docs.github.com/en/rest/commits/commits#compare-two-commits) limits comparison file lists to 300 and may omit patches. Results at the cap are labeled potentially incomplete. GitHub's merge-base comparisons are labeled when the merge base differs from the requested base; these are not presented as exact endpoint diffs.
- Offline, invalid SHA, timeout, HTTP and rate-limit errors do not invalidate local provenance. Retry guidance is shown; comparison rate-limit responses establish a cooldown and successful comparisons are cached. This phase adds no token flow.
- Very large prompt edits use a bounded block replacement inside the common prefix/suffix instead of allocating an unbounded line-diff matrix.
- Sealed snapshots omit private phases/dependency tags as before; their map still shows the history and fork lineage. The sidebar shows the 20 most recent sealed snapshots as before; backup export includes every stored snapshot.
- No merge, checkout, code editing or AI execution happens in this app. The built-in examples are recorded prompt histories, not proof of the original authors' identities.

## Static deployment

Serve **index.html** over HTTPS or localhost so Web Crypto is available. There is no application build step and no runtime package dependency.

For local use:

```sh
python -m http.server 8768 --bind 127.0.0.1
```

Open `http://127.0.0.1:8768`. For GitHub Pages, deploy the repository root or place index.html in `/docs` and select that folder in Pages settings. On a project Pages URL the app pre-fills `owner/repo`; `PINNED_REPO` can also be configured in the file. Each origin has separate browser storage; moving a deployment requires an explicit backup/import.

## Verification

Node 20+ runs the dependency-free regression tests. Playwright is a **development-only** dependency for browser acceptance tests; it is not shipped by the app.

```sh
npm ci
npx playwright install chromium
npm test
npm run test:browser
npm run test:github
git diff --check
```

`npm test` verifies legacy compatibility against the actual pre-refactor source at commit `280af7ea45208bb48367d2cd62a9430deb37af98` (Git history must include that commit), plus prompt diff, provenance, privacy, backup, scanner and mocked GitHub failure cases. Browser tests use an isolated ephemeral localhost origin and synthetic GitHub responses, exercise the full flow and retain screenshots in ignored `test-results/`. The separate live GitHub test uses five anonymous public API requests, including a real browser comparison to verify CORS, and may fail when offline or rate-limited.

See [REFACTOR-NOTES.md](REFACTOR-NOTES.md) for the pre-edit inventory and verification report.
