# Verso Masterplan

This document preserves the product vision and roadmap. For current technical
state, use `docs/CURRENT_STATE.md`. For launch readiness, use
`docs/LAUNCH_HANDOFF.md`.

## Product Promise

Verso helps people memorize Scripture one verse at a time in Spanish, English,
or both. It should feel warm, premium, calm, spiritually respectful, and simple
enough for a family or child to understand without feeling childish.

Verso V1 is a focused Scripture memorization product, not a generic Bible app.

## Product Boundaries

Implemented core:

- one active verse experience
- bilingual memorization modes
- Home, Memorize, Cards, Paths, and Saved
- saved verse review
- preset and custom Paths
- shareable verse cards
- Memorize as the Fill/Recall foundation
- Cards as citation/reference mastery

Launch scope:

- Cloudflare-hosted progressive web app
- Paths included as a premium feature
- current paywall/pricing values preserved from app/code and approved price
  sheet
- remaining app-completion, legal, payment, API.Bible, and production QA
  blockers resolved before public monetized launch
- current work prepared on the unmerged
  `fix/p0-cards-crash-reference-language` branch, with `main` untouched until a
  later explicit merge checkpoint

Future consideration:

- Capacitor/App Store release after the PWA is proven
- RevenueCat plus Apple in-app purchases for native iOS
- reduced launch translation list based on rights and user value
- Saved evolving into Harvest, the long-term review and retention system
- Paths evolving into tailored journeys that feed Practice and Harvest
- Match and Build as promising future practice steps

Non-goals for launch:

- full Bible reading app
- sermon notes or commentary platform
- dense study tools
- heavy achievement system
- Swift rewrite
- speech recitation
- teen-only repositioning
- paid AI dependency
- new recurring APIs unless unavoidable

## Target Users

Implemented target:

- Christians and families who want focused Scripture memorization
- bilingual Spanish/English users
- learners who benefit from clear, repeated practice
- users who value a calm, polished, spiritually respectful interface
- Gen Z and young adults as a possible marketing lens, especially bilingual
  users, while the product remains cross-generational

## Core Product Pillars

### One Verse At A Time

Verso should avoid becoming a general Bible app. Home, Memorize, Cards, and
Saved must keep the active verse and selected translations trustworthy.

### Bilingual By Design

Spanish and English are first-class modes. Where practice order matters,
bilingual order follows UI language: English UI starts English then Spanish;
Spanish UI starts Spanish then English. Static bilingual displays should keep
translation labels and text aligned with the active surface rules.

### Trust Through Accuracy

Translation labels must match the rendered verse text. Search, paths, saved
review, sharing, and completion snapshots must not silently rederive the wrong
translation.

### Calm Premium Focus

The interface should reduce noise. Progress and encouragement should be light,
honest, and useful.

### Cinematic Memory Companion

Future brand/design work should preserve this durable direction:

- quiet premium memory companion.
- dark charcoal/ink base with ivory text.
- teal for primary action and live motion.
- violet for identity and active navigation.
- gold reserved for earned completion and milestones.
- avoid muddy brown, sepia, and dull olive-gold.
- intentional growth metaphor: sprout -> flower -> fruit.
- flower mark as a possible logo direction.
- fruit/harvest language represents long-term review, repeated strengthening,
  and retention, not first-time completion.
- fruit xN repetition-count concept.
- calm dawn and cinematic nighttime ritual.
- editorial serif plus readable humanist sans direction.
- typography subject to licensing, performance, and accessibility review.
- design-system tokens before broad reskinning.
- one surface at a time.
- do not combine visual reskin work with API or product-logic changes.
- do not force garden language onto every mechanical button or mode.
- plain functional names may remain preferable for practice mechanics.
- garden/harvest language belongs in progress, review, reminders, milestones,
  Path completion, and emotional storytelling.

### Launch Discipline

Every feature must be labeled as implemented, partially implemented, planned,
launch blocker, future consideration, or requires owner confirmation.

## Launch Feature Set

Implemented:

- Home active verse experience
- Memorize staged practice
- Cards citation challenge
- Saved verses
- Paths and custom Paths
- Settings
- Onboarding
- Product tour
- Share modal/image generation
- API.Bible service/proxy scaffolding
- Supabase auth/subscription scaffolding
- Paywall UI

Partially implemented:

- production payment entitlement architecture
- Supabase-backed persistence beyond auth/subscription/event scaffolding
- production reminders
- Cloudflare deployment configuration
- PWA install readiness
- commercial Bible translation rights

Launch blockers:

- production Stripe/RevenueCat integration
- disabling or production-gating test-premium bypass
- API.Bible commercial-use and translation-rights confirmation
- legal identity/contact/domain/jurisdiction/effective-date/refund decisions
- production Cloudflare/PWA smoke test

Planned app-completion work:

- Memorize Enter-key continuity.
- Cards responsive/control collision.
- Home long-reference/button collision.
- Paths functional audit.
- Saved/Harvest audit.
- Onboarding and Product Tour audit.
- Design foundation / cinematic reskin.
- Full Checkpoint 2 regression.
- Share composition polish.
- Custom Path preview and Add to Path confirmation.
- Full Path/Series completion celebration.
- Colombian Spanish audit and localization source of truth.

## Completed Checkpoint Work

- `530b9fe`: repaired Cards keyboard navigation and the shared
  keyboard/cursor/caret model.
- `435cb55`: repaired bilingual Memorize attempt persistence. Bilingual
  Memorize now uses attempt-scoped persistence and UI-language-derived order.

## Future Practice Ladder

Conceptual ladder, not immediate implementation scope:

- Match.
- Build.
- Fill.
- Recall.
- Citation.

## Translation Strategy

Current API.Bible access is suitable for noncommercial development/testing.
A monetized launch requires commercial-use and translation-rights confirmation.

Future launch planning should reduce the translation list to approximately two
or three commercially viable bilingual pairs based on:

- user preference
- Spanish/English pairing
- commercial availability
- licensing cost
- attribution requirements

NASB and NKJV are candidates. Reina-Valera should be treated as a
direct-rights/licensing inquiry until confirmed. Do not claim commercial
approval without repository proof.

## Roadmap

### Launch PWA

- Cloudflare-hosted PWA
- current tab structure
- premium-gated Paths
- Stripe/RevenueCat web entitlement path
- legal and Bible licensing complete
- remaining Checkpoint 2 work complete

### V1 After Launch

- production analytics review
- stronger Supabase sync if needed
- reminder delivery if validated
- translation set refinement
- Cards layout polish for long bilingual references
- brand package, icon, wordmark, coded tokens, motion system, and screenshot
  direction
- flower/fruit completion visual system refinement
- Harvest exploration for long-term review and retention

### Later Mobile Phase

- Capacitor wrapper
- App Store release
- RevenueCat plus Apple in-app purchases
- native share/subscription restore QA

### Future Considerations

- family/group practice
- expanded path library
- additional translations after rights confirmation
