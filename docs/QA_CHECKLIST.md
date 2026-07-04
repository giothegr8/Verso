# Verso QA Checklist

Use this checklist before launch and after meaningful feature patches. Do not
mark unresolved items as passing.

## Automated Checks

Run when allowed by the task:

```bash
npx tsc --noEmit
npm run build
git diff --check
git status --short --untracked-files=all
git diff --stat
```

For docs-only work:

```bash
git diff --check
git status --short --untracked-files=all
git diff --stat
```

## Home

- Implemented: app loads the Home tab after onboarding/paywall conditions are
  satisfied.
- Verify active verse displays in the selected language mode.
- Verify Spanish-only, English-only, and bilingual display.
- Verify translation chips match the rendered verse text.
- Verify search/another verse flow does not desynchronize Home, Memorize, and
  Cards.
- Verify full-name and abbreviation search.
- Verify Quick Switch and Settings synchronization.
- Verify slow or failed fetch preserves valid visible content.
- Verify Home long-reference/button collision remains resolved after future
  repair.
- Verify share modal opens and uses the current verse snapshot.
- Verify path/custom path context displays correctly when active.
- Verify mobile layout does not overlap bottom navigation.

## Memorize

- Implemented: staged memorization flow.
- Verify each stage order.
- Verify Spanish-only, English-only, and bilingual modes.
- Verify bilingual order follows UI language: English UI starts English then
  Spanish then Cards; Spanish UI starts Spanish then English then Cards.
- Verify Cards unlocks only after both required bilingual language passes are
  complete.
- Verify Path/Home and Saved/Home attempt state do not collide.
- Verify mode, translation, UI-language, and context changes invalidate
  incompatible transient attempts.
- Verify typing, attempts, failure, completion, and restart behavior.
- Verify rapid typing and rapid backspace.
- Open issue: fresh Step 1 Enter-key continuity does not respond to Enter until
  the visible arrow is clicked.
- Verify hold-to-peek behavior on the final stage.
- Verify Back/Next controls remain stable.
- Verify active-attempt guard appears only after the attempt has started.
- Verify completion updates progress without duplicate completion.
- Verify reload preserves expected active attempt and stage state.

## Cards

- Implemented: citation challenge, clues, attempts, review, and completion.
- Implemented: repaired shared-input keyboard/cursor/caret model.
- Verify same-language ArrowLeft and ArrowRight movement.
- Verify same-language ArrowUp and ArrowDown movement between book and number
  rows.
- Verify bilingual cross-language keyboard navigation.
- Verify bilingual Cards can be completed with keyboard, mouse, and touch input.
- Verify clues do not mutate unrelated characters.
- Verify incorrect, check-first, exhausted, correct, and completed feedback.
- Verify no answer is submitted by arrow navigation.
- Verify no clue is consumed by arrow navigation.
- Verify no attempt is decremented by arrow navigation.
- Open issue: completion/control overlap still exists.
- Verify long bilingual references such as `1 Tesalonicenses / 1 Thessalonians
  5:16` do not clip after future responsive/control repair.
- Verify five restarts do not cause an editable slot to disappear.
- Verify keyboard navigation and visible focus.
- Verify long Spanish book names.

Required keyboard regression tests:

- final first-language slot plus ArrowRight moves to first second-language slot.
- first second-language slot plus ArrowLeft moves to final first-language slot.
- first language plus ArrowDown enters second language at a predictable
  corresponding slot.
- second language plus ArrowUp enters first language at a predictable
  corresponding slot.
- first first-language slot plus ArrowLeft remains clamped.
- final second-language slot plus ArrowRight remains clamped.
- crossing languages does not add, remove, clear, move, or duplicate
  characters.
- crossing languages does not submit, validate, complete, consume clues, or
  change attempts.

## Saved

- Implemented: saved verse collection, review, and share entry points.
- Verify saving and unsaving a verse.
- Verify saved verses remain separate from active daily/path source.
- Verify review opens the correct verse and translation context.
- Verify correct translation-specific Saved behavior.
- Open issue: Saved/Harvest needs audit.
- Verify share output uses the saved/review source correctly.
- Verify empty state is clear.

## Settings

- Implemented: language, memorization mode, translations, appearance,
  reminders, and tour access.
- Verify app language changes interface copy only.
- Verify memorization mode changes display mode.
- Verify translation changes fetch or use the correct verse text.
- Verify unavailable translation messaging.
- Verify light, dark, and system appearance.
- Verify reminder preference saves locally.
- Verify Save and Close behavior.

## Paths

- Implemented and launch-scoped with premium gating.
- Open issue: Paths need functional audit.
- Verify non-premium users see the paywall gate.
- Verify premium users can access preset Paths.
- Verify current day, completed day, completion today, reset, and review states.
- Verify active path verse can enter Memorize and Cards.
- Verify path completion does not corrupt daily verse progress.
- Verify sharing from a path review works.

## Custom Paths

- Implemented.
- Verify custom path creation.
- Verify path create/edit/reorder/delete/reopen.
- Verify search preview before insertion after future repair.
- Verify preview shows localized reference, selected translation, and full
  verse.
- Verify explicit Add to Path confirmation.
- Verify cancel/search-again does not mutate the path.
- Verify duplicate-verse policy once decided.
- Verify verse lookup and translation selection.
- Verify editing a custom path.
- Verify deleting a custom path.
- Verify custom path progress and active verse selection.
- Verify validation for missing/invalid references.

## Onboarding And Auth

- Implemented with Supabase auth scaffolding and local fallback behavior.
- Open issue: Onboarding and Product Tour need audit.
- Verify onboarding preference flow.
- Verify signup/signin when Supabase is configured.
- Verify local preview behavior when Supabase is not configured.
- Verify onboarding transitions to paywall/main app as expected.
- Verify product tour can complete and be reopened from Settings.

## Paywall

- Implemented UI; production billing is partially implemented.
- Verify current plan names, prices, and trial copy match code/approved price
  sheet.
- Verify development-only test-premium bypass works only in development.
- Launch blocker: disable or make test-premium bypass unavailable in
  production.
- Verify production RevenueCat/Stripe entitlement flow after implementation.
- Verify refund copy is not invented before owner/legal approval.

## Share

- Implemented with prepared share image and native share/download fallbacks.
- Verify Home share.
- Verify Saved share.
- Verify Path review share.
- Verify correct translation-specific Share behavior.
- Verify Share composition polish after future repair.
- Verify bilingual share ordering.
- Verify selected/completed translation labels match share text.
- Verify mobile native share behavior.
- Verify desktop download/clipboard fallback.

## API.Bible

- Implemented service and proxy layers.
- Verify API key missing behavior.
- Verify valid verse lookup.
- Verify unavailable verse/translation fallback.
- Verify fetch failure preserves valid content.
- Verify no silent translation substitution.
- Verify translation label, Bible ID, source, and content stay aligned.
- Verify client cache behavior.
- Verify server or Cloudflare cache behavior.
- Launch blocker: confirm commercial-use rights and translation rights before
  monetized launch.
- Verify cached content is checked or updated at least every 30 days; 14-day
  clearing remains a recommendation.

## Bilingual Mode

- Verify bilingual order follows the current surface rules and does not rely on
  stale Spanish-first assumptions.
- Verify Memorize order is UI-language-derived in bilingual mode.
- Verify translation labels and text stay aligned.
- Verify Home, Memorize, Cards, Saved, and Paths all respect the selected mode.
- Verify switching modes during/around active attempts does not corrupt state.
- Verify English UI + English memorization.
- Verify Spanish UI + Spanish memorization.
- Verify English UI + bilingual memorization.
- Verify Spanish UI + bilingual memorization.

## Colombian Spanish And Localization

- Verify planned inventory covers English source, current Spanish, proposed
  Colombian Spanish, context, variables, status, and notes.
- Verify coverage across Home, Cards, Memorize, Paths, Saved, Settings, Share,
  onboarding, paywall, notifications, and legal surfaces.
- Verify buttons, instructions, errors, clues, celebrations, empty states, and
  accessibility labels.
- Verify singular/plural handling, accents, punctuation, Bible book names, and
  theological/product consistency.
- Verify Colombian naturalness without overly narrow slang.
- Run automated hard-coded-string scan after localization source of truth
  exists.
- Complete final mobile-width visual QA.

## Responsive Behavior

- Verify mobile width.
- Verify tablet width.
- Verify desktop width.
- Verify bottom navigation does not cover primary actions.
- Verify Cards long bilingual references do not clip after layout repair.
- Verify safe-area inset behavior on mobile browsers.
- Verify zoom/dynamic-type clipping.
- Verify long verses and long Spanish book names.

## Mobile And PWA

- Verify manifest loads.
- Verify app icon assets exist.
- Verify standalone display behavior.
- Verify theme/background colors.
- Verify install prompt behavior where supported.
- Verify offline/poor-network behavior expectations before launch.
- Verify cold start.
- Verify repeated translation switching.
- Verify slow or unavailable network.
- Verify duplicate or overlapping requests.
- Verify large Saved libraries.
- Verify share-image memory behavior.

## Accessibility

- Verify keyboard navigation and visible focus.
- Verify screen-reader labels for icon-only controls.
- Verify contrast.
- Verify reduced motion.
- Verify touch targets.
- Verify errors are not color-only.
- Verify zoom/dynamic-type does not clip essential content.

## Production Deployment Smoke Test

For the Cloudflare-hosted PWA launch target:

- Verify production build artifact.
- Verify Cloudflare Pages serves the app.
- Verify `/api/bible/verse` function works with production env vars.
- Verify Supabase auth works on production domain.
- Verify RevenueCat/Stripe entitlement flow.
- Verify paywall cannot be bypassed by development-only localStorage flags.
- Verify legal links and support/privacy emails are final.
- Verify mobile install/open/share flows.
- Verify rollback plan is documented and tested.

## Later Native iOS QA

Run only during the later Capacitor/iOS phase:

- iPhone simulator QA.
- physical iPhone QA.
- TestFlight install and launch.
- App Store submission checklist.
- native Share.
- storage migration.
- offline behavior.
- keyboard/focus.
- safe areas.
- subscriptions and restore purchases.
- privacy manifests.
- signing and provisioning.
