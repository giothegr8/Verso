# Verso App Flow, Pages, And Roles

This document describes the current app map. For technical implementation
details, use `docs/CURRENT_STATE.md`.

## Current Navigation

Implemented bottom navigation:

- Home
- Memorize
- Cards
- Paths
- Saved

Implemented overlays/gates:

- Settings overlay
- Onboarding
- Paywall
- Product Tour
- Active-attempt confirmation dialog

This replaces the older four-tab MVP recommendation. Paths is part of launch
and remains premium-gated.

## Page Roles

### Home

Status: implemented.

Purpose:

- daily/current verse entry point
- current translation/memorization context
- start memorization
- search or choose another verse
- show path/custom path context when active
- open sharing flow

Risk:

- Home must not desynchronize the active verse, selected translations, or share
  snapshot from Memorize and Cards.

### Memorize

Status: implemented.

Purpose:

- primary staged memorization flow
- Spanish-only, English-only, and bilingual practice
- active-attempt creation/protection
- completion tracking

Required behavior:

- Spanish appears before English in bilingual mode.
- stage and typing state remain stable across expected navigation/reload cases.
- completion cannot duplicate progress.

### Cards

Status: implemented with launch blocker.

Purpose:

- citation recall challenge for the active/review verse
- clues, attempts, feedback, flip/review, and completion

Launch blocker:

Bilingual Cards cross-language keyboard navigation remains unresolved. Previous
experimental Left/Right and Up/Down approaches were reverted because they
caused sticky focus, swallowed first-character input, row skipping, or caret
flicker. The repository is currently clean at e578706. Another implementation
must begin with an architectural diagnosis of the hidden-input, focus,
cursor-ref, cursor-state, and visible-caret model.

### Paths

Status: implemented and launch-scoped.

Purpose:

- premium memorization series
- preset paths
- custom paths
- path day progress
- path review/share

Access:

- premium-gated for launch.

Planned gaps:

- Custom Path search preview before insertion.
- Preview shows localized reference, selected translation, and full verse.
- Explicit Add to Path confirmation.
- Cancel/search-again without mutation.
- Duplicate-verse policy requires a decision.
- Translation selector/favorites behavior depends on confirmed translation
  availability.
- Full Path/Series completion celebration remains future work.

### Saved

Status: implemented.

Purpose:

- intentionally saved verses
- review saved verses
- share saved/reviewed verses

Rule:

- Saved must remain distinct from the active daily/path source, even when a
  saved verse is reviewed.

### Settings

Status: implemented.

Purpose:

- interface language
- memorization mode
- translation preferences
- appearance
- reminder preference
- product tour access

Rule:

- App language, memorization mode, and Bible translation selection are separate
  concepts.

### Onboarding

Status: implemented.

Purpose:

- set initial preferences
- collect auth when configured
- move user toward paywall/main app

### Paywall

Status: partially implemented.

Purpose:

- present premium value and current plan/pricing/trial values
- gate premium access such as Paths

Launch requirement:

- replace development-only simulated checkout with real RevenueCat/Stripe web
  entitlement behavior.
- disable or production-gate test-premium bypass.

## User Roles

### Standard User

Status: implemented.

Access:

- onboarding
- Home
- Memorize
- Cards
- Saved
- Settings
- paywall

Premium access:

- Paths and custom Paths after entitlement.

### Admin Or Content Manager

Status: planned/future consideration.

No admin/content manager interface is implemented in the repository.

## Source-Of-Truth Rules

- Active verse and selected translation state must stay consistent across Home,
  Memorize, Cards, Saved review, and Paths.
- Share output must use a resolved snapshot, not silently rederive content from
  current global settings.
- Share composition polish remains planned work.
- Saved verses remain separate from daily/path source.
- Saved bilingual typography polish remains planned work.
- Spanish appears before English in bilingual mode.
- Cards keyboard behavior must be diagnosed architecturally before the launch
  blocker is repaired.
- Cards/Memorize caret consistency remains planned work.
- Home long-reference/button collision remains planned work.

## Primary Journeys

### Daily Memorization

Status: implemented.

Home -> Memorize -> Cards -> Saved/progress.

### Path Memorization

Status: implemented with premium gating.

Paths -> select preset/custom path -> Memorize active day -> Cards -> complete
path day.

### Save And Review

Status: implemented.

Save verse -> Saved -> review in Memorize or Cards -> optional share.

### Change Preferences

Status: implemented.

Settings -> change app language, mode, translations, appearance, or reminders.

### Subscribe

Status: partially implemented.

Paywall -> simulated development checkout today -> intended RevenueCat/Stripe
web entitlement before launch.
