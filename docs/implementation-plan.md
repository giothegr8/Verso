# Verso Implementation Plan

This plan starts from the verified checkpoint at HEAD `e578706`. It replaces
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

Launch blocker:

- bilingual Cards cross-language keyboard navigation

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

Status: planned.

Scope:

- Cards keyboard/focus architecture.
- Cards long bilingual responsive layout.
- Home long-reference/button collision.
- Share composition polish.
- Saved bilingual typography polish.
- Cards/Memorize caret consistency.
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

### 1. Cards Keyboard Architecture

Status: launch blocker.

Goal: repair bilingual cross-language keyboard navigation without sticky focus,
first-character loss, row skipping, or caret flicker.

Required first step:

- Diagnose hidden inputs, focus timing, active language, cursor refs, cursor
  state, rendered slot order, browser selection range, and visible caret.

Do not begin with another boundary-only patch.

Acceptance:

- final Spanish slot plus ArrowRight reaches first English slot.
- first English slot plus ArrowLeft reaches final Spanish slot.
- planned vertical behavior is implemented only after the architecture is
  proven.
- character strings, attempts, clues, submission, validation, and completion are
  unchanged by navigation.

### 2. Cards Responsive Layout

Status: planned after keyboard blocker.

Goal: support short and long bilingual references without clipping or overlap.

Known stress case:

- `1 Tesalonicenses / 1 Thessalonians 5:16`

Acceptance:

- card grows or redistributes space.
- attempts and feedback remain inside the card.
- bottom action does not overlap content.
- short references do not gain excessive empty space.

### 2B. Remaining App UX Completion

Status: planned.

Scope:

- Home long-reference/button collision.
- Share composition polish.
- Saved bilingual typography polish.
- Cards/Memorize caret consistency.
- Custom Path search preview before insertion.
- Preview shows localized reference, selected translation, and full verse.
- User explicitly selects Add to Path.
- Cancel/search-again returns without mutating the path.
- Duplicate-verse policy is decided.
- Translation selector/favorites behavior follows confirmed translation
  availability.
- Full Path/Series completion celebration is larger than daily completion,
  supports reduced motion, shows meaningful completion data, and never blocks
  progress if animation fails.

### 3. Payment And Entitlements

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

### 4. Cloudflare PWA Launch Path

Status: partially implemented.

Required:

- confirm Cloudflare Pages project/configuration.
- configure production environment variables.
- validate `functions/api/bible/verse.ts`.
- verify PWA manifest and icon assets.
- run production deployment smoke test.

### 5. API.Bible And Translation Rights

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

### 5B. Colombian Spanish And Localization Governance

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

### 6. Legal Readiness

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

### 7. Production QA

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
- audio Bible support
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
