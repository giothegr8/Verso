# Verso Current State

This is the authoritative current-state document for Verso at the verified
checkpoint below.

## Verified Baseline

- Folder: `/Users/giovannirincon/Documents/Verso`
- Branch: `fix/p0-cards-crash-reference-language`
- HEAD: `e578706`
- Commit subject: `Add bilingual localized references`
- Expected working tree: clean

Branch status:

- Current documentation and successor handoff work are being prepared on
  `fix/p0-cards-crash-reference-language`.
- This branch has not been merged into `main`.
- `main` remains untouched by this documentation package.
- Do not describe this branch as merged.
- Do not describe `e578706` as a main-branch release.
- Preserve this branch as the active recoverable checkpoint.
- The future merge decision is a separate explicit checkpoint after remaining
  app-completion work and regression QA.

## Product Direction

Implemented direction: bilingual Bible verse memorization, one verse at a time,
with Spanish, English, and bilingual practice.

Launch direction: Cloudflare-hosted progressive web app.

Later phase: Capacitor and App Store distribution. Do not propose a Swift
rewrite.

## App Architecture

Implemented:

- React 19 frontend.
- Vite build pipeline.
- Tailwind CSS v4 through `@tailwindcss/vite`.
- Express server in `server.ts`.
- API.Bible client service in `src/services/apiBible.ts`.
- Cloudflare-style Bible verse function in `functions/api/bible/verse.ts`.
- Supabase client in `src/lib/supabase.ts`.
- Supabase auth/subscription context in `src/contexts/AuthContext.tsx`.
- Supabase migration at `supabase/migrations/20260519_initial_schema.sql`.
- PWA manifest at `public/manifest.json`.

Partially implemented:

- Production Cloudflare configuration.
- Production payment entitlement architecture.
- Supabase-backed product persistence.
- Production reminders.
- PWA asset/readiness verification.

## Current Navigation

Implemented in `src/App.tsx`:

- Home
- Memorize
- Cards
- Paths
- Saved
- Settings as an overlay
- Onboarding before main app access
- Paywall gate after onboarding when premium is not active

Paths is part of the launch product and retains the current premium gating.

## Feature Matrix

Implemented:

- Home active verse experience.
- Memorize staged practice.
- Cards citation challenge.
- Saved verses.
- Preset Paths.
- Custom Paths.
- Settings.
- Onboarding.
- Product tour.
- Share modal and image generation.
- Translation selection for Spanish and English pairs.
- Spanish-only, English-only, and bilingual display modes.
- Active-attempt navigation guard.
- Local progress/completion tracking.

Partially implemented:

- Supabase auth and subscription lookup.
- Paywall and pricing UI.
- RevenueCat/Stripe payment architecture.
- Reminder preferences.
- API.Bible production/licensing readiness.
- Cloudflare/PWA launch path.

Planned:

- Cloudflare-hosted PWA launch.
- Later Capacitor/App Store phase using RevenueCat plus Apple in-app purchases.
- Possible future audio Bible support.

Future consideration:

- Reduce launch Bible translation options to approximately two or three
  commercially viable bilingual pairs.
- NASB and NKJV are candidates.
- Reina-Valera requires direct-rights/licensing inquiry until confirmed.

## Persistence And Services

Implemented browser persistence:

- `verso_state`
- `verso_active_tab`
- `verso_test_premium`
- Cards/Memorize attempt-related localStorage keys
- API.Bible client cache key `verso_bible_cache`

Implemented server/function persistence or cache:

- Express disk cache file path: `api_bible_cache.json`
- Cloudflare function optional KV binding: `BIBLE_CACHE_KV`

Supabase schema exists for:

- profiles
- subscriptions
- streaks
- verse progress
- series progress
- paywall events

Current app progress is still primarily local browser state. Treat Supabase app
progress persistence as partially implemented.

## Environment Variables

Verified from code and `.env.example`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BIBLE_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_REVENUECAT_PUBLIC_KEY`
- `API_BIBLE_KEY`
- `API_BIBLE_BASE_URL`
- `DEFAULT_BIBLE_ID`
- `BIBLE_CACHE_KV`

No secret values belong in the repository.

## Known Bugs And Risks

Launch blocker:

Bilingual Cards cross-language keyboard navigation remains unresolved. Previous
experimental Left/Right and Up/Down approaches were reverted because they
caused sticky focus, swallowed first-character input, row skipping, or caret
flicker. The repository is currently clean at e578706. Another implementation
must begin with an architectural diagnosis of the hidden-input, focus,
cursor-ref, cursor-state, and visible-caret model.

Known Cards layout risk:

- Long bilingual references can strain the fixed card height and overlapping
  bottom action layout.
- Responsive height/spacing work is separate from the keyboard-navigation
  blocker.

Unresolved/planned app-completion work:

- Cards responsive layout for long bilingual references.
- Home long-reference/button collision.
- Share composition polish.
- Saved bilingual typography polish.
- Cards/Memorize caret consistency.
- Custom Path search preview before insertion.
- Explicit Add to Path confirmation.
- Cancel/search-again flow without mutating the path.
- Duplicate-verse policy for Paths.
- Full Path/Series completion celebration.

Known launch risks:

- Development-only test-premium bypass must be disabled or made unavailable in
  production.
- Production payment flow is not complete.
- Legal docs are templates and not launch-ready.
- API.Bible commercial rights are not confirmed in-repo.
- PWA icon/readiness must be verified.
- Cloudflare deployment configuration is not final.

## Stale Configuration Notes

Requires future non-doc cleanup:

- `package.json` name is `react-example`.
- `metadata.json` still references `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`.
- `vite.config.ts` contains an encoding artifact in a comment.
- `public/manifest.json` references `/icon-512.png`; verify the asset before
  launch.

These are not changed by this documentation-only package.

## Payment Status

Intended architecture:

- Web/PWA: RevenueCat entitlement management plus Stripe web billing.
- Later native iOS: RevenueCat plus Apple in-app purchases.

Current status:

- Paywall UI and plan values are represented in code.
- Supabase subscriptions table exists.
- Checkout is simulated in code by setting `verso_test_premium`.
- Production entitlement and billing integration remains incomplete.

Web refund terms are not finalized. Stripe can process refunds, but the
business must define the policy. Later App Store refund requests are handled
through Apple.

## API.Bible And Translation Status

Current API.Bible access is suitable for noncommercial development/testing.

A monetized launch requires commercial-use and translation-rights confirmation.
Do not claim any translation is commercially approved unless proof exists in the
repository.

Current translation list is provisional. Launch planning should reduce it to
approximately two or three commercially viable bilingual pairs based on:

- user preference
- Spanish/English pairing
- commercial availability
- licensing cost
- attribution requirements

Caching distinction:

- 14-day cache clearing is a recommendation.
- Current API.Bible terms require cached content to be checked or updated at
  least every 30 days.

Durable content architecture principles:

- Canonical book/reference identity must not depend on abbreviated API display
  strings.
- Translation label, Bible ID, source, and content must stay aligned.
- No silent translation substitution.
- Failed fetches must not replace a valid visible or saved snapshot with empty
  or misleading content.
- Saved/completed records should retain immutable translation snapshots.
- Production translation availability must be based on actual access and
  licensing, not merely visible UI buttons.
- A production translation registry remains planned.

## Legal Status

Legal launch blockers:

- operator/legal name
- public support email
- privacy email
- website/domain
- applicable state/country or jurisdiction
- effective date
- final web refund language

The owner currently has no LLC. Do not invent a company, business address,
jurisdiction, effective date, or legal identity. Do not place a personal home
address in documentation.
