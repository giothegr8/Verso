# Verso Implementation Plan

This plan starts from the verified checkpoint at HEAD `435cb55`. It replaces
the older prebuild phase plan with the current launch sequence.

Branch status:

- Current work is on `fix/p0-cards-crash-reference-language`.
- This branch has not been merged into `main`.
- `main` remains untouched.
- The future merge decision is a separate checkpoint after app completion and
  regression QA.

## Source Of Truth

Use this order:

1. current code and configuration
2. Git history
3. existing documentation
4. locked owner decisions

Do not use stale docs to override implemented behavior.

## Current Baseline

Implemented:

- React/Vite/Tailwind app
- Express local/prod server
- Cloudflare-style Bible verse function
- Supabase scaffolding
- Home, Memorize, Cards, Paths, Saved, Settings, Onboarding, Paywall, Product
  Tour, Share
- localStorage-based app persistence
- API.Bible service/proxy/cache scaffolding

Partially implemented:

- production payment architecture
- Supabase-backed app persistence
- production reminder delivery
- Cloudflare deployment configuration
- PWA readiness
- commercial Bible licensing

Completed on this branch:

- `530b9fe`: repaired Cards keyboard navigation and the shared
  keyboard/cursor/caret model.
- `435cb55`: repaired bilingual Memorize attempt persistence with
  attempt-scoped state and UI-language-derived bilingual order.

## Authoritative Sequence

### Checkpoint 1: Documentation And Successor Handoff

Status: in progress in this documentation package.

Goals:

- authoritative repository entry point
- engineering operating rules
- current-state record
- QA checklist
- launch handoff
- product/design roadmap alignment
- active branch preserved as the recoverable checkpoint

### Checkpoint 2: App Completion

Status: in progress.

Scope:

- Memorize Enter-key continuity.
- Cards responsive/control collision.
- Home long-reference/button collision.
- Paths functional audit.
- Saved/Harvest audit.
- Onboarding and Product Tour audit.
- Design foundation / cinematic reskin.
- Full Checkpoint 2 regression.
- Share composition polish.
- Custom Path preview before insertion.
- Path duplicate-verse policy.
- full Path/Series completion celebration.
- remaining approved visual/product gaps.

### Checkpoint 3: Web/PWA Launch Infrastructure

Status: planned after app completion.

Scope:

- Cloudflare production setup.
- PWA readiness.
- Stripe plus RevenueCat implementation.
- production premium entitlement handling.
- test-premium bypass removal.
- API.Bible commercial and translation decisions.
- legal documents.
- production environment and security.

### Checkpoint 4: Production Web/PWA QA And Launch

Status: planned after infrastructure.

Scope:

- full web/PWA QA matrix.
- production deployment smoke test.
- rollback checkpoint.
- launch/go-no-go decision.

### Later: Capacitor And iOS

Status: future phase.

Scope:

- Capacitor wraps the existing React/Vite app.
- no Swift rewrite.
- separate native branch and checkpoint.
- Xcode build/sign/device/archive/submission workflow.
- TestFlight and App Store release after web/PWA checkpoint.

## Detailed Implementation Sequence

### 1. Memorize Enter-Key Continuity

Status: open.

Goal: repair the pre-existing fresh Step 1 issue where Enter does not continue
until the visible arrow is clicked.

Acceptance:

- fresh Step 1 responds to Enter when the expected next action is available.
- visible arrow behavior remains unchanged.
- typing, attempt persistence, bilingual order, and active-attempt guard remain
  stable.
- no Path/Home or Saved/Home attempt state collision is reintroduced.

### 2. Cards Responsive And Control Collision

Status: open.

Goal: support short and long bilingual references without clipping or control
overlap.

Known stress case:

- `1 Tesalonicenses / 1 Thessalonians 5:16`

Acceptance:

- card grows or redistributes space.
- attempts, feedback, completion, and controls remain inside the card.
- bottom action does not overlap content.
- short references do not gain excessive empty space.

### 3. Home Long-Reference/Button Collision

Status: open.

Goal: prevent long bilingual references from colliding with Home controls.

Acceptance:

- long references wrap or reflow without overlapping buttons.
- path/custom path context remains readable.
- mobile bottom navigation does not cover primary actions.

### 4. Paths Functional Audit

Status: open.

Scope:

- preset path progress.
- custom path create/edit/reorder/delete/reopen.
- active path verse flow into Memorize and Cards.
- path review/share.
- duplicate-verse policy.
- search preview before insertion.
- explicit Add to Path confirmation.
- cancel/search-again without mutating the path.

### 5. Saved/Harvest Audit

Status: open.

Goal: preserve existing Saved behavior while preparing the direction toward
Harvest, the long-term review and retention system.

Scope:

- saved verse add/remove/review/share.
- saved/review snapshots remain distinct from active daily/path state.
- future Harvest language belongs in review, reminders, milestones, retention,
  and emotional storytelling.
- do not rename mechanical controls prematurely.

### 6. Onboarding And Product Tour Audit

Status: open.

Scope:

- onboarding preference flow.
- product tour completion/reopen behavior.
- app language, memorization mode, and translation preferences remain separate.
- no teen-only repositioning.

### 7. Design Foundation / Cinematic Reskin

Status: planned after functional audits.

Scope:

- preserve Verso as a focused Scripture memorization product, not a generic
  Bible app.
- no paid AI dependency.
- no speech-recitation feature.
- avoid new recurring APIs unless unavoidable.
- use garden/harvest language for progress, review, reminders, milestones, Path
  completion, and emotional storytelling rather than every mechanic.

### 8. Full Checkpoint 2 Regression

Status: required before PR/merge.

Acceptance:

- run the relevant checklist in `docs/QA_CHECKLIST.md`.
- do not open a PR or merge until the owner explicitly authorizes it.

### 9. Future Practice Ladder

Status: conceptual only, not immediate implementation scope.

- Match.
- Build.
- Fill.
- Recall.
- Citation.

### 10. Payment And Entitlements

Status: partially implemented.

Intended architecture:

- web/PWA: RevenueCat entitlement management plus Stripe web billing
- later iOS: RevenueCat plus Apple in-app purchases

Required:

- preserve current plan/pricing/trial values from app/code and approved price
  sheet.
- implement real web checkout.
- sync entitlement state to app/Supabase.
- remove, disable, or production-gate test-premium bypass.
- confirm web refund policy with owner/legal.

### 11. Cloudflare PWA Launch Path

Status: partially implemented.

Required:

- confirm Cloudflare Pages project/configuration.
- configure production environment variables.
- validate `functions/api/bible/verse.ts`.
- verify PWA manifest and icon assets.
- run production deployment smoke test.

### 12. API.Bible And Translation Rights

Status: launch blocker for monetization.

Required:

- confirm commercial-use rights.
- confirm translation rights and attribution requirements.
- reduce launch translations to approximately two or three viable bilingual
  pairs.
- treat Reina-Valera as direct-rights/licensing inquiry until confirmed.
- document cache policy: 14-day clearing recommendation; cached content must be
  checked or updated at least every 30 days.
- create a production translation registry based on actual access and
  licensing.
- preserve canonical reference identity independent from abbreviated API display
  strings.
- keep translation label, Bible ID, source, and content aligned.
- prevent failed fetches from replacing valid visible or saved snapshots.

### 13. Colombian Spanish And Localization Governance

Status: planned launch work.

Required:

- full inventory of English source, current Spanish, proposed Colombian Spanish,
  context, variables, status, and notes.
- coverage for Home, Cards, Memorize, Paths, Saved, Settings, Share,
  onboarding, paywall, notifications, and legal surfaces.
- coverage for buttons, instructions, errors, clues, celebrations, empty states,
  and accessibility labels.
- singular/plural handling, accents, punctuation, Bible book names, and
  theological/product consistency.
- Colombian naturalness without overly narrow slang.
- future localization dictionary or structured source of truth.
- automated hard-coded-string scan.
- final mobile-width visual QA.

### 14. Legal Readiness

Status: launch blocker.

Required owner/legal decisions:

- operator/legal name
- public support email
- privacy email
- website/domain
- jurisdiction
- effective date
- final web refund language

Do not invent legal identity, address, jurisdiction, or refund promises.

### 15. Production QA

Status: required before launch.

Use `docs/QA_CHECKLIST.md`.

Minimum categories:

- typecheck
- production build
- Home
- Memorize
- Cards
- Saved
- Settings
- Paths
- custom Paths
- onboarding/auth
- paywall
- Share
- API.Bible
- bilingual mode
- responsive behavior
- mobile/PWA
- production deployment smoke test

## Later Phases

Future consideration:

- production reminders
- future audio Bible exploration only after licensing and product-fit review
- expanded path library
- Capacitor/App Store release
- RevenueCat plus Apple in-app purchases

Do not plan a Swift rewrite unless the owner explicitly changes direction.

Future documentation/engineering deliverables:

- Bible API and translation-source architecture decision record.
- web-to-iOS packaging architecture decision record.
- state-model and migration guide.
- caching and failure-behavior guide.
- localization source of truth.
- security and secrets inventory.
- deployment and rollback runbook.
- App Store and TestFlight runbook.
- coded design-system specification.
