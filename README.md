# Verso

Verso is a bilingual Bible verse memorization app focused on one verse at a
time. The product is warm, simple, mobile-first, and designed for Spanish,
English, and bilingual Scripture practice.

Current launch direction: Cloudflare-hosted progressive web app. Capacitor and
App Store distribution are a later phase; there is no planned Swift rewrite.

## Current Status

Verified checkpoint:

- Folder: `/Users/giovannirincon/Documents/Verso`
- Branch: `fix/p0-cards-crash-reference-language`
- HEAD: `e578706`
- Commit: `Add bilingual localized references`

The repository at this checkpoint is expected to be clean before starting any
new task.

Branch status:

- Current work and documentation are being prepared on
  `fix/p0-cards-crash-reference-language`.
- This branch has not been merged into `main`.
- `main` remains untouched by this documentation package.
- Do not describe `e578706` as a main-branch release.
- The future merge decision is a separate explicit checkpoint after remaining
  app-completion work and regression QA.
- Preserve this branch as the active recoverable checkpoint.

Important launch blocker:

Bilingual Cards cross-language keyboard navigation remains unresolved. Previous
experimental Left/Right and Up/Down approaches were reverted because they
caused sticky focus, swallowed first-character input, row skipping, or caret
flicker. The repository is currently clean at e578706. Another implementation
must begin with an architectural diagnosis of the hidden-input, focus,
cursor-ref, cursor-state, and visible-caret model.

## Architecture

Implemented architecture:

- React 19 app built with Vite and Tailwind CSS v4.
- Express server in `server.ts` for local/prod serving and API.Bible proxy
  endpoints.
- Cloudflare-style function at `functions/api/bible/verse.ts` for a future
  PWA deployment path.
- Supabase client/auth/subscription scaffolding.
- Local browser persistence through `localStorage`.
- API.Bible service layer with client cache and server/function proxy cache.
- PWA manifest at `public/manifest.json`, linked from `index.html`.

Partially implemented systems:

- Payment: Paywall UI exists, but production Stripe/RevenueCat entitlement
  plumbing is not complete.
- Supabase persistence: schema and auth context exist, but app progress is
  primarily local browser state today.
- Reminders: preference UI/state and server stub exist, but no production
  reminder delivery system is complete.
- PWA deployment: app direction is Cloudflare-hosted PWA, but final Cloudflare
  configuration and production smoke checks are still required.

## Local Setup

Prerequisite:

- Node.js compatible with the project lockfile.

Install dependencies:

```bash
npm ci
```

Run the local app/server:

```bash
npm run dev
```

Typecheck:

```bash
npm run lint
```

Production build:

```bash
npm run build
```

Preview built output:

```bash
npm run preview
```

Clean build output:

```bash
npm run clean
```

## Environment Variables

These names are verified from code and `.env.example`. Do not commit secret
values.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BIBLE_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_REVENUECAT_PUBLIC_KEY`

Additional server/function variables referenced in code:

- `API_BIBLE_KEY`
- `API_BIBLE_BASE_URL`
- `DEFAULT_BIBLE_ID`
- `BIBLE_CACHE_KV`

## Feature Overview

Implemented:

- Home tab with active verse, translation display, search/another verse flow,
  sharing entry points, and path-aware context.
- Memorize tab with staged verse practice, bilingual support, active-attempt
  protection, and completion tracking.
- Cards tab for citation recall, clues, attempts, review, and completion.
- Saved tab for saved verses, review, and sharing.
- Paths tab for preset and custom memorization paths. Paths are part of launch
  and retain the current premium gating.
- Settings overlay for app language, memorization mode, translations,
  appearance, reminders, and product tour access.
- Onboarding, product tour, paywall UI, Supabase auth scaffolding, and share
  image generation.

Known incomplete or blocked areas are documented in `docs/CURRENT_STATE.md` and
`docs/LAUNCH_HANDOFF.md`.

## Deployment Direction

First launch target: Cloudflare-hosted PWA.

Required before launch:

- Remaining app-completion work and regression QA on this unmerged branch.
- Final Cloudflare Pages/Functions configuration.
- Production environment variables.
- Supabase production project and policies verified.
- Stripe web billing and RevenueCat entitlement integration completed.
- Development-only test-premium bypass disabled or made unavailable in
  production.
- API.Bible commercial-use and translation-rights confirmation.
- Legal identity, support/privacy contact, domain, jurisdiction, effective date,
  and web refund language confirmed.
- Production QA completed.

## Documentation Map

- `AGENTS.md`: repository operating rules for future assistants and engineers.
- `docs/CURRENT_STATE.md`: authoritative current product and technical state.
- `docs/QA_CHECKLIST.md`: automated and manual QA checklist.
- `docs/LAUNCH_HANDOFF.md`: launch readiness, blockers, and handoff plan.
- `docs/masterplan.md`: product vision and roadmap.
- `docs/implementation-plan.md`: current implementation plan and sequencing.
- `docs/app-flow-pages-and-roles.md`: app map, roles, and navigation rules.
- `docs/design-guidelines.md`: visual, interaction, and accessibility guidance.

Legal templates exist at `PRIVACY_POLICY.md` and `TERMS_OF_SERVICE.md`, but
they are not launch-ready and require owner/legal confirmation.
