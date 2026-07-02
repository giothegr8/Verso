# Verso Masterplan

This document preserves the product vision and roadmap. For current technical
state, use `docs/CURRENT_STATE.md`. For launch readiness, use
`docs/LAUNCH_HANDOFF.md`.

## Product Promise

Verso helps people memorize Scripture one verse at a time in Spanish, English,
or both. It should feel warm, premium, calm, spiritually respectful, and simple
enough for a family or child to understand without feeling childish.

## Product Boundaries

Implemented core:

- one active verse experience
- bilingual memorization modes
- Home, Memorize, Cards, Paths, and Saved
- saved verse review
- preset and custom Paths
- shareable verse cards

Launch scope:

- Cloudflare-hosted progressive web app
- Paths included as a premium feature
- current paywall/pricing values preserved from app/code and approved price
  sheet
- legal, payment, API.Bible, and Cards navigation blockers resolved before
  public monetized launch
- current work prepared on the unmerged
  `fix/p0-cards-crash-reference-language` branch, with `main` untouched until a
  later explicit merge checkpoint

Future consideration:

- Capacitor/App Store release after the PWA is proven
- RevenueCat plus Apple in-app purchases for native iOS
- audio Bible support if licensing and product fit are confirmed
- reduced launch translation list based on rights and user value

Non-goals for launch:

- full Bible reading app
- sermon notes or commentary platform
- dense study tools
- heavy achievement system
- Swift rewrite

## Target Users

Implemented target:

- Christians and families who want focused Scripture memorization
- bilingual Spanish/English users
- learners who benefit from clear, repeated practice
- users who value a calm, polished, spiritually respectful interface

## Core Product Pillars

### One Verse At A Time

Verso should avoid becoming a general Bible app. Home, Memorize, Cards, and
Saved must keep the active verse and selected translations trustworthy.

### Bilingual By Design

Spanish and English are first-class modes. Spanish appears before English when
both languages are shown.

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
- fruit xN repetition-count concept.
- calm dawn and cinematic nighttime ritual.
- editorial serif plus readable humanist sans direction.
- typography subject to licensing, performance, and accessibility review.
- design-system tokens before broad reskinning.
- one surface at a time.
- do not combine visual reskin work with API or product-logic changes.

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

- bilingual Cards cross-language keyboard navigation
- production Stripe/RevenueCat integration
- disabling or production-gating test-premium bypass
- API.Bible commercial-use and translation-rights confirmation
- legal identity/contact/domain/jurisdiction/effective-date/refund decisions
- production Cloudflare/PWA smoke test

Planned app-completion work:

- Cards responsive layout for long bilingual references.
- Home long-reference/button collision.
- Share composition polish.
- Saved bilingual typography polish.
- Cards/Memorize caret consistency.
- Custom Path preview and Add to Path confirmation.
- Full Path/Series completion celebration.
- Colombian Spanish audit and localization source of truth.

## Cards Launch Blocker

Bilingual Cards cross-language keyboard navigation remains unresolved. Previous
experimental Left/Right and Up/Down approaches were reverted because they
caused sticky focus, swallowed first-character input, row skipping, or caret
flicker. The repository is currently clean at e578706. Another implementation
must begin with an architectural diagnosis of the hidden-input, focus,
cursor-ref, cursor-state, and visible-caret model.

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
- Cards blocker resolved

### V1 After Launch

- production analytics review
- stronger Supabase sync if needed
- reminder delivery if validated
- translation set refinement
- Cards layout polish for long bilingual references
- brand package, icon, wordmark, coded tokens, motion system, and screenshot
  direction
- flower/fruit completion visual system refinement
- audio Bible exploration if licensing and product fit are confirmed

### Later Mobile Phase

- Capacitor wrapper
- App Store release
- RevenueCat plus Apple in-app purchases
- native share/subscription restore QA

### Future Considerations

- audio Bible support
- family/group practice
- expanded path library
- additional translations after rights confirmation
