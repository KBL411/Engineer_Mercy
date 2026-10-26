# Data Contract

This document defines which files belong to the **system** (the tool itself) and which belong to the **user** (your data, never overwritten by the tool).

## User Layer

These files contain your personal data, customizations, and work product. Updates preserve user-owned files. The updater may create or replace only these system-owned `.gitkeep` scaffolds inside user-layer directories: `data/.gitkeep`, `data/offers/.gitkeep`, `data/parser-output/.gitkeep`, `jds/.gitkeep`, `output/.gitkeep`, and `reports/.gitkeep`. It never checks out or modifies any other user file in those directories.

| File | Purpose |
|------|---------|
| `cv.md` | Your CV in markdown |
| `config/profile.yml` | Your identity, targets, comp range |
| `config/cv-facts.json` | Your CV fact-check allowlist and forbidden phrases |
| `config/benchmarks.yml` | Your market calibration benchmark overrides (optional; copy `templates/benchmarks.yml` here and edit — read by `funnel-velocity.mjs`) |
| `modes/_profile.md` | Your archetypes, narrative, negotiation scripts |
| `modes/_custom.md` | Your house rules, custom workflows & output preferences (procedural) |
| `modes/_brief.md` | Your compact profile brief (~1.5–2K tokens) read by the two-pass triage first pass |
| `voice-dna.md` | Your writing voice guardrail — banned words, anti-AI-slop rules, tone (optional) |
| `article-digest.md` | Your proof points from portfolio |
| `interview-prep/story-bank.md` | Your accumulated STAR+R stories |
| `interview-prep/{company}-{role}.md` | Company-specific interview prep reports (written by `/career-ops interview-prep`) |
| `interview-prep/sessions/*.md` | Interview sessions — real transcripts + mock sessions (sensitive: real names/companies; gitignored except scaffold). Drives `patterns` Step 1b targeting signal and `interview-redflag` analysis. Scaffold files (`README.md`, `.gitkeep`) are system-owned. |
| `documents/*` | Your profile intake sources — master CV, LinkedIn export, diplomas, reference letters (PII — gitignored except scaffold; read locally by `intake.mjs`, see `modes/intake.md`). Scaffold files (`README.md`, `.gitkeep`) are system-owned. |
| `data/.gitkeep` | System-owned empty directory scaffold; all other user files in `data/` are preserved |
| `data/offers/.gitkeep` | System-owned empty directory scaffold; all other user files in `data/offers/` are preserved |
| `data/parser-output/.gitkeep` | System-owned empty directory scaffold; all other user files in `data/parser-output/` are preserved |
| `data/intake-state.json` | Fingerprints of already-ingested intake sources (written by `node intake.mjs --commit`; makes re-runs propose only new material — safe to delete, next intake re-proposes everything) |
| `portals.yml` | Your customized company list |
| `config/plugins.yml` | Your plugin activation toggles (opt-in; seeded from `config/plugins.example.yml`) |
| `plugins.local/` | Your own / private plugins |
| `plugins.lock` | Integrity pins + recorded consent for your enabled plugins (generated) |
| `data/applications.md` | Your application tracker (source of truth) |
| `data/career-profile.yml` | Your source-backed Master Career Profile; written only after explicit review of imported CV facts |
| `data/applications.db` | Derived query index over `applications.md` (SQLite, rebuilt by `node tracker.mjs sync` — safe to delete) |
| `data/pipeline.md` | Your URL inbox |
| `data/scan-history.tsv` | Your scan history: one tab-separated row per posting the scanners have seen. Columns are append-only — a new column goes at the end and existing ones never move — so older rows may have fewer columns, and a missing cell reads as empty. The column order is declared in `lib/scan-history-columns.mjs`; what each column holds is in the Scan History table of `modes/scan.md`. A cell that would run as a spreadsheet formula is stored with one extra leading `'`; `parseScanHistoryLine` removes it. |
| `data/scan-runs.tsv` | Your per-run scan counters (appended by `scan.mjs`, read by `stats.mjs`) |
| `data/portal-health.tsv` | Consecutive reachability status for scanned portals (appended by `scan.mjs`; statuses: `reachable`, `empty`, `slug_gone`, `network`, `auth`, `server`, `unknown`, `unverified_zero` — the last four joined the vocabulary later, so older files carry only the first four; `unverified_zero` means a provider returned no jobs without any observed successful HTTP response and counts toward the failure streak) |
| `data/dead-boards.tsv` | Boards that returned three consecutive 404s during mass reverse ATS sweeps (written by `scan-ats-full.mjs`; unlike `data/portal-health.tsv`, this does not track the user's configured portals; re-probed after 30 days — safe to delete, the next sweep rebuilds it) |
| `data/follow-ups.md` | Your follow-up history |
| `data/active-interviews.md` | Your active interview processes, incl. inline `[process-friction]` notes (read by `process-quality.mjs`) |
| `data/agent-inbox.md` | Your append-only request queue drained at session start (written by `agent-inbox.mjs`) |
| `data/reply-candidates.json` | Your normalized employer-reply candidates (subject, body, sender, signal, plus optional `received_at`/`date` — read by `reply-watch.mjs`; a reliable received date is required for date-guarded company-wide rejection suggestions) |
| `data/reply-proposals/*.json` | Local integration status proposals with quoted evidence; read-only until explicit review in `reply-watch.mjs`. Acceptance writes status plus a `[reply-proposal:<digest>]` Notes receipt atomically through `set-status.mjs`; keep receipts to prevent replay. See `docs/REPLY_PROPOSALS.md` for the v1 draft contract; the format may change until a real producer writes to the directory. |
| `data/pdf-index.tsv` | PDF↔report linkage manifest (written by `generate-pdf.mjs`, read by `find.mjs` and the `email` mode) |
| `data/offers/*` | Your received offers/contracts, promise notes, prep reports, and reply drafts (PII — gitignored, written by the `offer-prep` mode) |
| `data/outcomes/*` | Your application outcome logs and archived application artifacts (written by the `outcome` mode) |
| `data/salary-observations.tsv` | Your append-only compensation observation log: `{tracker#}\t{date}\t{desired\|advertised\|actual}\t{amount}\t{currency}\t{source}\t{note}`. Written by interactive modes when a figure is stated/confirmed; never edited in place. Column 1 is a **tracker#** — the `#` of the row in the active tracker file (`data/applications.md` in the default layout), not a report number. The two counters diverge permanently once any row exists without a report, so a number copied off a `reports/{###}-*.md` filename can name a different application; padding is not identity, so `29` and `029` are the same row. Advertised figures come from reports' `advertised_comp` instead — reports are themselves observation sources, reached through the tracker row's Report link rather than by matching numbers. Read by `salary-gap.mjs` |
| `status-log.tsv` (sibling of the active tracker file — `data/status-log.tsv` in the default layout) | Your append-only status transition ledger: `{tracker#}\t{date}\t{from}\t{to}\t{source}\t{note}`. Appended by `set-status.mjs` next to wherever the tracker lives, on every real status change (the tracker stays the source of truth for *state*; the ledger records *when* transitions happened); never edited in place — corrections are new `correction`-source lines. An unknown from- or to-state is the sentinel `-`, never an empty cell; the two columns then diverge, with a from of `-` parsing to null (no prior state) and a to of `-` preserved as the literal unknown-target sentinel, while an empty cell is rejected as `unknown from-state ""` or `unknown to-state ""` for its own column. The source column is a closed set whose members are `VALID_SOURCES` in `funnel-velocity.mjs` — that declaration is the authority, so this contract points at it rather than restating a list that goes stale the next time a writer is added. Any value outside the set parses but is counted as an unknown source and excluded from the funnel, so per-writer detail belongs in the note column rather than namespaced onto the source. Read by `funnel-velocity.mjs` and `company-history.mjs` |
| `data/upskill/*` | Your skill-gap analysis reports (written by the `upskill` mode) |
| `data/blacklist.md` | Your do-not-apply list (opt-in — absence = no filtering; never auto-populated: only you, or the agent on your explicit instruction, write to it. Its `Scope` is `company` (default: normalized feed company name) or `domain` (the Company cell is a hostname suffix matched to the posting URL); no parent/subsidiary relationship is inferred. Respected by `scan.mjs` and the `auto-pipeline`/`oferta`/`apply` gates; never a scoring input) |
| `data/assessments.tsv` | Your append-only skills-assessment log: `{date}\t{company}\t{report#\|-}\t{platform}\t{subject}\t{threshold%\|-}\t{score%\|-}\t{stale_note}`. Appended by `node assessment-log.mjs add`; never edited in place. Empty stale_note = no staleness observed. Read by `assessment-log.mjs` |
| `data/contacts.tsv` | Your job-search phonebook (third-party PII — gitignored): `{name}\t{company}\t{type}\t{title}\t{phone}\t{email}\t{linkedin}\t{tracker#\|-}\t{notes}`. `type` optional; when present must be one of the enum (recruiter\|hiring-manager\|peer\|interviewer\|internal-referral\|other), else flagged in `quality`. Written by the `contacto` mode only after you confirm; lines are updated in place when a contact's details change (unlike the append-only salary log). Read by `contacts.mjs` |
| `data/Connections.csv` | Your LinkedIn connections export (third-party PII — gitignored, never committed). Placed here by you: LinkedIn → Settings → Data Privacy → Get a copy of your data → Connections. Read fresh on every run by `linkedin-join.mjs`, which writes no cache, index or sidecar state, so the file is disposable — delete it after use and re-export when you need it again. Never enters a prompt and never leaves the machine; only rows you paste by hand reach `data/contacts.tsv` |
| `writing-samples/*` | Your personal writing samples for style calibration (except `writing-samples/README.md`, which is system-owned documentation) |
| `reports/*` | Your evaluation reports; `reports/.gitkeep` is the system-owned directory scaffold |
| `output/*` | Your generated PDFs; `output/.gitkeep` is the system-owned directory scaffold |
| `jds/*` | Your saved job descriptions; `jds/.gitkeep` is the system-owned directory scaffold |
| `templates/cv-{candidate}-{company-slug}.html`, `templates/cover-{candidate}-{company-slug}.html` | Your per-application generated CVs/cover letters, for installs that save the HTML twin under `templates/` instead of `output/` (#3636). `templates/` is otherwise system-owned (base CV/cover templates), so these are recognized by name rather than directory: anything under `templates/` starting with `cv-` or `cover-` that is NOT one of the shipped `cv-template*.html` / `cover-letter-template*.html` files is treated as your data |
| `templates/cv-template.{name}.html` / `.tex`, `templates/cover-letter-template.{name}.html` / `.tex` | Your own named CV/cover-letter template variant, when `{name}` matches `config/profile.yml`'s `cv.template` / `cover_letter.template` (the convention `cv-templates.mjs`'s `resolveTemplate()` reads — see its `KINDS`). `templates/` is otherwise system-owned, and a variant file this install created shares that directory and naming shape with the real shipped variants (`cv-template.zh-minimal.html`, ...), so it is recognized by cross-referencing the configured template name rather than by directory. An unconfigured or differently-named `cv-template.*.html` file is not covered by this carve-out and is a system file. This is distinct from `templates/cv-{candidate}-{company-slug}.html` / `templates/cover-{candidate}-{company-slug}.html`, which is generated per-application *output*, not an authored template *variant*. |

## System Layer

These files contain system logic, scripts, templates, and instructions. Never put user data in them.

| File | Purpose |
|------|---------|
| `modes/_shared.md` | Eval-core: scoring system, global rules, tools |
| `modes/_writing.md` | Writing guardrails (Voice DNA / Writing Style / ATS) — loaded by the CV/cover/apply writing modes, not by evaluation (#1710) |
| `modes/_custom.template.md` | Template seed for the user's `modes/_custom.md` |
| `modes/_profile.template.md` | Template seed for the user's `modes/_profile.md` |
| `modes/_brief.template.md` | Template seed for the user's `modes/_brief.md` |
| `modes/oferta.md` | Evaluation mode instructions |
| `modes/pdf.md` | PDF generation instructions |
| `modes/cover.md` | Cover letter generation instructions |
| `modes/latex.md` | LaTeX/Overleaf CV export instructions |
| `modes/text.md` | Tailored markdown CV instructions |
| `modes/add.md` | CV addition (project/paper/role) instructions |
| `modes/scan.md` | Portal scanner instructions |
| `modes/batch.md` | Batch processing instructions |
| `modes/apply.md` | Application assistant instructions |
| `modes/auto-pipeline.md` | Auto-pipeline instructions |
| `modes/contacto.md` | LinkedIn outreach instructions |
| `modes/email.md` | Formal application email draft instructions |
| `modes/deep.md` | Research prompt instructions |
| `modes/regional/*` | Regional market calibration modes |
| `modes/ofertas.md` | Comparison instructions |
| `modes/pipeline.md` | Pipeline processing instructions |
| `modes/project.md` | Project evaluation instructions |
| `modes/tracker.md` | Tracker instructions |
| `modes/training.md` | Training evaluation instructions |
| `modes/patterns.md` | Pattern analysis instructions |
| `modes/titles.md` | Adjacent job-title suggestion instructions |
| `modes/upskill.md` | Skill-gap analysis instructions |
| `modes/followup.md` | Follow-up cadence instructions |
| `modes/offer-prep.md` | Offer-stage contract reading companion instructions |
| `modes/interview.md` | Interactive profile/CV onboarding interview instructions |
| `modes/interview-prep.md` | Company-specific interview prep instructions |
| `modes/interview-redflag.md` | Company red-flag detection instructions |
| `modes/outcome.md` | Application outcome instructions |
| `modes/interview/*` | Interview prep planning, practice, and debrief skills |
| `modes/agent-inbox.md` | Agent inbox (queued requests) instructions |
| `modes/reply-watch.md` | Employer reply classification instructions |
| `modes/fr/*` | French language modes |
| `modes/heuristics/*` | Shared candidate-facing application heuristics |
| `CLAUDE.md` | Agent instructions (Claude Code) |
| `AGENTS.md` | Canonical agent instructions (imported by `CLAUDE.md`) |
| `*.mjs` | Utility scripts |
| `providers/` | Job-source provider modules for the zero-token scanner |
| `plugins/` | Bundled plugins + the plugin engine (opt-in external integrations) |
| `plugins.mjs` | Plugin CLI (list/run/available/add/new/enable/skill/trust/remove) |
| `plugins-registry/` | Curated community plugins, one `<id>.json` per plugin (the trust root) |
| `plugin-install.mjs` / `plugin-audit.mjs` / `validate-plugin-registry.mjs` | Plugin install/audit/registry-validation utilities |
| `config/plugins.example.yml` | Plugin activation template (seed for `config/plugins.yml`) |
| `batch/batch-prompt.md` | Batch worker prompt |
| `batch/batch-runner.sh` | Batch orchestrator |
| `templates/*` | Base templates |
| `fonts/*` | Self-hosted fonts |
| `.claude/skills/*` | Skill definitions (Claude Code) |
| `docs/*` | Documentation |
| `VERSION` | Current version number |
| `DATA_CONTRACT.md` | This file |
| `writing-samples/README.md` | System-owned onboarding documentation for the writing-samples directory |
| `test-fixtures/*` | Test fixtures (system layer; fictional data, never user data) |

## The Rule

**If a file is user-owned, nothing in the tool may modify or delete it.** The only files the tool writes inside user-layer directories are the exact system-owned `.gitkeep` scaffolds listed above.

**If a file is in the System Layer, it belongs to the tool: change it in the repo, never keep user data in it.**

## Custom Data Directory

By default, all User Layer files reside inside the project repository root. You can configure a separate, external directory for your personal data.

### Resolution Precedence:
1. **Environment Variables (`CAREER_OPS_ROOT` or `CAREER_OPS_DATA_DIR`):** Set this to the absolute or relative path of your custom data directory.
2. **Marker File (`.career-ops-data`):** A repository-level marker file named `.career-ops-data` containing the path (absolute or relative) to the user data directory.
3. **Repository Default:** Defaults to the codebase/repository root directory.

When resolved, all User Layer files/directories (e.g. `cv.md`, `config/profile.yml`, `modes/_profile.md`, `modes/_custom.md`, `data/`, `reports/`, `output/`, `portals.yml`) will be resolved relative to that path. System Layer files continue to be resolved relative to the codebase/repository root, keeping code and personal data completely separate.

### Tracker Path & Writes:
- **`CAREER_OPS_TRACKER`** can be set to override the applications tracker file path directly (relative paths are resolved relative to the repository root).
- **Read Resolution:** If no tracker override is set, reading resolves to `{DATA_ROOT}/data/applications.md` if it exists; otherwise falls back to `{DATA_ROOT}/applications.md`.
- **Write Resolution:** All writes (including merge operations and first-run creation) target the canonical location `{DATA_ROOT}/data/applications.md`.
