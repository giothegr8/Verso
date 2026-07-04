# Verso Design Guidelines

Verso should feel like a quiet morning with Scripture: warm, clear, premium,
and calm enough to invite focus without draining attention.

This document is the design source of truth. For current implementation status,
use `docs/CURRENT_STATE.md`.

## Design Intent

Verso should not feel like:

- a gamified productivity app
- a childish Bible game
- a dense study platform
- a generic SaaS dashboard

Verso should feel:

- spiritually respectful
- bilingual by design
- warm and focused
- premium but not flashy
- simple enough for a child to understand
- calm enough for daily return
- cinematic as a daily memory ritual, not theatrical

## Product-Specific Design Principles

### One Clear Next Step

Each screen should make the next action obvious. Avoid duplicate shortcuts and
decorative cards that compete with the primary flow.

### One Verse, Trusted Everywhere

The user should never wonder whether Home, Memorize, Cards, Saved review, or
Paths are showing different content by accident.

### Bilingual Without Crowding

Bilingual content needs real space, not compressed styling. Where practice
order matters, the order follows UI language: English UI starts English then
Spanish; Spanish UI starts Spanish then English.

### Sacred Text Gets Breathing Room

Verse text and citation text must never feel crammed. Long book names must be
handled with responsive layout, not hidden overflow.

### Quiet Progress

Progress should encourage without becoming a separate product. Avoid loud
milestone ladders unless they directly help memorization.

## Visual Style

Use restraint, warmth, and clarity.

Style anchors:

- Apple Human Interface restraint
- Linear-like hierarchy and spacing
- clean system components
- editorial warmth
- kindness over efficiency theater

Avoid:

- muddy purple floods
- low-contrast gray text
- neon gradients
- excessive glow
- cramped cards
- purely decorative motion
- muddy brown, sepia, and dull olive-gold

## Brand And Cinematic Direction

Future visual work should preserve this direction:

- quiet premium memory companion.
- dark charcoal/ink base with ivory text.
- teal owns primary action and live motion.
- violet owns identity and active navigation.
- gold is earned for harvest, streaks, long-term review, repeated
  strengthening, retention, and milestones.
- intentional growth metaphor: sprout -> flower -> fruit.
- flower mark is a possible logo direction.
- fruit xN can carry repetition count.
- support calm dawn and cinematic nighttime rituals.
- garden/harvest language belongs in progress, review, reminders, milestones,
  Path completion, and emotional storytelling.
- do not force garden language onto every mechanical button or mode.
- plain functional names may remain preferable for practice mechanics.

Future deliverables:

- brand package.
- app icon.
- wordmark and compact mark.
- design-system tokens.
- motion system.
- screenshot and launch-art direction.

Safety rules:

- define tokens before broad reskinning.
- reskin one surface at a time.
- do not combine visual reskin work with API or product-logic changes.
- typography remains subject to licensing, performance, accessibility, and iOS
  embedding review.

## Typography

Use at most two families:

- a warm serif for Scripture, major headings, and reverent emphasis
- a clean sans-serif for UI labels, controls, settings, and metadata

Recommended hierarchy:

- H1: 36px, 600-700, line-height 1.2
- H2: 30px, 600, line-height 1.25
- H3: 24px, 600, line-height 1.3
- H4: 20px, 600, line-height 1.35
- Body large: 18px, line-height 1.65
- Body standard: 16px, line-height 1.6
- Caption: 13-14px, line-height 1.5

Rules:

- keep reading text at comfortable line height
- avoid overly light text weights
- do not rely on color alone for hierarchy
- keep metadata quieter than Scripture text
- maintain WCAG AA contrast

## Color Direction

Current palette direction:

- primary purple/iris for selected states and premium accent moments
- teal/green for calm success and growth
- amber/gold for warmth and gentle highlights
- coral/rose for errors and warnings
- warm light neutrals and deep warm dark neutrals

Rules:

- use purple as a signature accent, not a full-screen flood
- reserve bright accents for meaning
- test light and dark themes independently
- do not let decorative color reduce text clarity

## Layout

Principles:

- use full-width responsive app layouts, not fake phone frames
- keep screen gutters consistent
- keep cards for real grouped content or repeated items
- avoid nested cards
- make mobile the primary constraint
- preserve safe-area space around bottom navigation

Responsive requirements:

- text must not overlap controls
- long words and long Bible book names must wrap or resize gracefully
- primary actions must remain reachable above bottom navigation
- bilingual sections must have enough vertical space

## Cards Design Constraints

Status: implemented, with responsive/control work still open.

Cards has special risk because it combines hidden text inputs, rendered citation
slots, visible caret styling, clues, attempts, feedback, flip control, and
bilingual layout.

Completed:

- Cards keyboard navigation and the shared keyboard/cursor/caret model were
  repaired in `530b9fe`.

Design requirements for future Cards repairs:

- visible caret must follow the true active language and slot
- keyboard navigation must not mutate characters
- keyboard navigation must not submit, validate, complete, consume clues, or
  change attempts
- bilingual long references must not clip feedback, attempts, completion, or
  bottom action
- short references should not gain excessive empty space
- mobile width must remain supported

Known stress case:

- `1 Tesalonicenses / 1 Thessalonians 5:16`

Other planned visual/product polish:

- Memorize Enter-key continuity.
- Cards completion/control overlap.
- Home long-reference/button collision.
- Share composition polish.
- Saved/Harvest audit.
- Paths functional audit.
- Onboarding and Product Tour audit.
- Full Path/Series completion celebration with reduced-motion support.

## Motion

Motion should be supportive, not theatrical.

Allowed:

- soft screen transitions
- button press feedback
- calm flip/reveal motion
- subtle completion feedback
- respectful onboarding transitions

Avoid:

- flashy CTA loops
- motion that delays reading
- motion that hides state changes
- sticky hold/reveal behavior
- caret flicker

## Interaction Rules

Buttons:

- one primary action per screen when possible
- clear disabled state
- no decorative buttons without purpose

Inputs:

- focus state must be visible when the user needs it
- keyboard behavior must match user expectation
- hidden-input patterns require extra QA

Hold-to-peek:

- reveal only while held
- release must hide
- pointer/touch behavior must be forgiving

Share:

- share snapshots must preserve the exact verse, translation, source, and
  language shown to the user
- native share and fallback paths should feel intentional

## Voice And Tone

Voice:

- gentle
- concise
- spiritually respectful
- encouraging without pressure
- bilingual with natural Spanish, not literal machine phrasing

Avoid:

- guilt-based copy
- hype
- childish jokes
- vague success messages
- legal or billing promises not confirmed by owner/legal

Spanish copy should be reviewed for natural phrasing. Use accents and proper
punctuation in user-facing product copy.

## Accessibility

Requirements:

- WCAG AA contrast
- keyboard-accessible controls
- visible focus states
- ARIA labels for icon-only buttons
- touch targets large enough for mobile
- no meaning conveyed by color alone
- readable line heights for Scripture text

Cards-specific accessibility:

- rendered slot/caret model must be understandable by keyboard users
- future repairs should consider screen reader behavior for the hidden-input
  pattern

## Launch Design QA

Use `docs/QA_CHECKLIST.md`. Design QA must include:

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
- bilingual mode
- mobile/PWA behavior
- long bilingual Cards references
- light and dark themes

Do not mark remaining Checkpoint 2 design QA as complete until the open
functional audits, responsive/control repairs, and full regression pass.
