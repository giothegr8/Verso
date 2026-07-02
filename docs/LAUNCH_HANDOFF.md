# Verso Launch Handoff

This document tracks what must be true before Verso launches as a
Cloudflare-hosted progressive web app.

## Launch Prerequisites

Launch target:

- Cloudflare-hosted PWA.

Current branch status:

- Current documentation and app-completion work are on
  `fix/p0-cards-crash-reference-language`.
- This branch has not been merged into `main`.
- `main` remains untouched.
- `e578706` is the committed baseline on this branch, not a main-branch
  release.
- The future merge decision is a separate explicit checkpoint after remaining
  app-completion work and regression QA.
- Preserve the current branch as the active recoverable checkpoint.

Later phase:

- Capacitor/App Store release using RevenueCat plus Apple in-app purchases.
- Do not plan a Swift rewrite.

Must be complete before public monetized launch:

- App-completion checkpoint, including Cards keyboard/focus architecture, Cards
  long bilingual responsive layout, Home long-reference/button collision, Share
  composition, Saved typography, caret consistency, and remaining approved
  visual/product gaps.
- Cloudflare deployment configured and smoke-tested.
- Production environment variables configured.
- Supabase production project configured.
- Stripe web billing and RevenueCat entitlement management implemented.
- Development-only premium bypass disabled or unavailable in production.
- API.Bible commercial-use and translation rights confirmed.
- Legal identity, contacts, domain, jurisdiction, effective date, and web refund
  policy confirmed.
- Production QA completed.
- Bilingual Cards cross-language keyboard navigation fixed and verified.

## Cloudflare And PWA Readiness

Implemented:

- PWA manifest exists at `public/manifest.json`.
- `index.html` links the manifest.
- Cloudflare-style function exists at `functions/api/bible/verse.ts`.

Required:

- Confirm Cloudflare Pages project.
- Confirm build command and output directory.
- Configure production env vars.
- Configure `BIBLE_CACHE_KV` if using KV cache.
- Confirm route for `/api/bible/verse`.
- Verify app shell loads on production domain.
- Verify direct reload of nested SPA routes if any are introduced later.
- Verify manifest and icon assets.
- Verify mobile install behavior.
- Verify HTTPS, caching headers, and error handling.

## Environment Checklist

Client/public env vars:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BIBLE_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_REVENUECAT_PUBLIC_KEY`

Server/function env vars:

- `API_BIBLE_KEY`
- `API_BIBLE_BASE_URL`
- `DEFAULT_BIBLE_ID`
- `BIBLE_CACHE_KV`

Rules:

- Do not commit secret values.
- Verify missing-env behavior in preview and production.
- Keep production and preview projects separated.

## Supabase Checklist

Implemented:

- Supabase client.
- Auth context.
- Initial migration for profiles, subscriptions, streaks, verse progress, series
  progress, and paywall events.
- RLS policies in migration.

Required:

- Create/confirm production Supabase project.
- Apply migrations.
- Verify RLS policies.
- Verify email auth settings and redirect URLs.
- Verify profile creation trigger.
- Verify subscription lookup.
- Decide which app progress remains local and which syncs to Supabase.
- Verify paywall event tracking.
- Document data deletion/export process for legal compliance.

## Stripe And RevenueCat Checklist

Intended architecture:

- Web/PWA: RevenueCat entitlement management plus Stripe web billing.
- Later native iOS: RevenueCat plus Apple in-app purchases.

Implemented today:

- Paywall UI and plan values in code.
- Supabase subscriptions table.
- Development-only simulated checkout that sets `verso_test_premium`.

Required:

- Confirm final web products/prices match code and approved price sheet.
- Implement Stripe checkout or billing portal flow for web.
- Implement RevenueCat entitlement management for web.
- Implement webhook/sync path into Supabase subscriptions.
- Verify active/trialing/canceled/inactive states.
- Verify entitlement refresh after purchase, cancellation, and expiration.
- Disable or make unavailable the `verso_test_premium` bypass in production.
- Verify paywall cannot be bypassed through localStorage in production.
- Confirm owner/legal web refund policy.

Refund status:

- Web refund policy requires owner/legal confirmation.
- Stripe provides refund processing, but the business must define the policy.
- Later App Store refund requests are handled through Apple.
- Do not invent refund promises.

## API.Bible And Translation Checklist

Current status:

- API.Bible access is suitable for noncommercial development/testing.
- Current translation list is provisional.
- Monetized launch requires commercial-use and translation-rights confirmation.

Required:

- Confirm commercial-use permission for API.Bible usage.
- Confirm rights for each launch translation.
- Reduce launch translations to approximately two or three commercially viable
  bilingual pairs.
- Evaluate candidates by user preference, Spanish/English pairing, commercial
  availability, licensing cost, and attribution requirements.
- Treat NASB and NKJV as candidates.
- Treat Reina-Valera as a direct-rights/licensing inquiry until confirmed.
- Confirm attribution requirements in UI/share output.
- Document cache policy.
- Ensure canonical book/reference identity does not depend on abbreviated API
  display strings.
- Ensure translation label, Bible ID, source, and content stay aligned.
- Prevent silent translation substitution.
- Prevent failed fetches from replacing valid visible or saved snapshots.
- Plan production translation registry based on actual access and licensing.

Caching distinction:

- 14-day cache clearing is documented as a recommendation.
- Current API.Bible terms require cached content to be checked or updated at
  least every 30 days.

Do not claim any translation is commercially approved unless repository proof
exists.

## Legal Blockers

The owner currently has no LLC. Do not invent a company, business address,
jurisdiction, effective date, or legal identity. Do not place a personal home
address in documentation.

Required before launch:

- Operator/legal name.
- Public support email.
- Privacy email.
- Website/domain.
- Applicable state/country or jurisdiction.
- Effective date.
- Final web refund language.
- Privacy Policy legal review.
- Terms of Service legal review.
- Payment/trial/cancellation language review.
- Data retention and deletion language review.
- Bible translation attribution/copyright language review.

PRIVACY_POLICY.md and TERMS_OF_SERVICE.md remain legal templates until these
items are confirmed. Do not modify legal files casually as part of product or
engineering patches.

## Colombian Spanish And Content Governance

Status: planned launch work.

Required:

- Inventory English source, current Spanish, proposed Colombian Spanish,
  context, variables, status, and notes.
- Cover Home, Cards, Memorize, Paths, Saved, Settings, Share, onboarding,
  paywall, notifications, and legal surfaces.
- Cover buttons, instructions, errors, clues, celebrations, empty states, and
  accessibility labels.
- Review singular/plural handling, accents, punctuation, Bible book names, and
  theological/product consistency.
- Aim for Colombian naturalness without overly narrow slang.
- Create a future localization dictionary or structured source of truth.
- Run automated hard-coded-string scan.
- Complete final mobile-width visual QA.

## Production Security Checks

- Verify no secret values are committed.
- Verify production env vars are set only in hosting/provider dashboards.
- Verify Supabase RLS in production.
- Verify API proxy does not leak API keys.
- Verify CORS policy is appropriate for production.
- Verify paywall bypass is not available in production.
- Verify error logs do not expose sensitive data.
- Verify legal/contact links are final.

## Test-Premium Bypass Removal Check

Current development-only bypass:

- `verso_test_premium` in localStorage.
- Simulated checkout in `Paywall`.
- Mock premium fallback in auth/app logic.

Before production:

- Remove, disable, or production-gate the bypass.
- Verify manually setting localStorage cannot unlock premium in production.
- Verify all premium access depends on real entitlement state.
- Verify QA still has an intentional non-production testing path.

## Production QA

Run the checks in `docs/QA_CHECKLIST.md`, including:

- automated typecheck/build
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
- responsive/mobile/PWA
- production deployment smoke test

Do not launch while bilingual Cards cross-language keyboard navigation remains
unresolved.

## Rollback And Checkpoint Procedure

Before launch:

- Record Git commit SHA.
- Record deployed build ID.
- Record environment-variable set, without secret values.
- Record Supabase migration state.
- Record Cloudflare deployment ID.
- Record payment configuration version.

Rollback plan:

- Keep the previous stable Cloudflare deployment available.
- Confirm how to roll back Pages deployment.
- Confirm how to disable paywall checkout if billing has an incident.
- Confirm how to revoke/rotate API keys if exposed.
- Confirm how to pause marketing links during incident response.

## Later Capacitor And iOS Phase

Future consideration:

- Wrap the proven PWA experience with Capacitor.
- Use RevenueCat plus Apple in-app purchases for native iOS.
- Route App Store refund requests through Apple.
- Perform native work only after the web/PWA checkpoint.
- Use a separate native branch and checkpoint.
- Use Xcode for building, signing, device testing, archiving, and submission.
- Re-QA offline behavior, safe areas, native share, auth redirects, and
  subscription restoration.
- Re-QA storage migration, keyboard/focus, privacy manifests, signing,
  TestFlight, App Store metadata, and App Store submission.
- Apple Developer enrollment type remains a future owner decision.
- The owner currently has no LLC; do not invent a company or organization
  enrollment.
- Individual/sole-proprietor enrollment remains a possible later route.
- Apple prices, policies, timelines, and program eligibility must be reverified
  when that phase begins.
- Do not rewrite the app in Swift unless a later owner decision explicitly
  changes direction.

## Future Durable Engineering Documents

Record as future deliverables, without creating additional files in this patch:

- Bible API and translation-source architecture decision record.
- web-to-iOS packaging architecture decision record.
- state-model and migration guide.
- caching and failure-behavior guide.
- localization source of truth.
- security and secrets inventory.
- deployment and rollback runbook.
- App Store and TestFlight runbook.
- coded design-system specification.

## Future Audio Bible Consideration

Audio Bible support is a possible future feature motivated by the target user.
It is not part of initial launch scope. Any future audio work must include
licensing, streaming/cache rules, accessibility, and mobile playback QA.
