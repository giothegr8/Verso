## Verso MVP Implementation Plan

## Build Sequence

### Phase 0: Lock the Product Rules
Goal: remove ambiguity before more UI drift happens.

#### Tasks
- Confirm MVP navigation:
  - Home
  - Memorize
  - Flashcards
  - Saved
- Remove Stats as a primary tab
- Define Saved as:
  - verses the user intentionally saves
  - not a second dashboard
  - not the active verse system
- Confirm that the Verse of the Day is the single source of truth for the active verse
- Confirm that Home, Memorize, and Flashcards always read from the same active verse state
- Freeze the memorization sequence in the exact approved order
- Freeze bilingual display rules
- Freeze translation-setting rules
- Freeze light, dark, and auto appearance requirements

#### Output
A written product rules checklist that the builder must not override.

---

## Phase 1: Fix the Core Information Architecture
Goal: make the app structure obvious and focused.

#### Tasks
- Remove the current Progress or Stats tab from the bottom navigation
- Update bottom navigation to:
  - Home
  - Memorize
  - Flashcards
  - Saved
- Remove extra shortcut clutter from Home
- Make sure each tab has one clear purpose
- Audit all current screens for duplicate or competing actions
- Remove any decorative cards that do not support the core verse flow

#### Checkpoint
A first-time user should understand what each tab is for in under five seconds.

---

## Phase 2: Establish the Global Source of Truth
Goal: stop verse mismatch across screens.

#### Core Rule
The active Verse of the Day must power all core practice screens.

#### Tasks
- Create one shared active verse state
- Bind Home to the active verse state
- Bind Memorize to the active verse state
- Bind Flashcards to the active verse state
- Ensure review actions tied to the daily flow also use that same verse
- Prevent any screen from loading a different verse unless it is part of a future non-MVP saved-verse flow
- Define what happens at day rollover:
  - new active verse becomes today’s verse
  - screens update consistently
  - saved verses remain separate from the active verse

#### Checkpoint
If the active verse is Joshua 1:9, Home, Memorize, and Flashcards must all show Joshua 1:9 with matching translations.

---

## Phase 3: Clean Up Verse Data and Translation Logic
Goal: make verse content trustworthy.

#### Tasks
- Create a clean verse data structure with:
  - book name
  - chapter number
  - verse number
  - Spanish translation text
  - English translation text
  - translation metadata
- Separate interface language from Bible translation settings
- Separate bilingual memorization mode from translation selection
- Add default smart pairings:
  - RVR1960 + KJV
  - NVI + NIV
  - NBLA + NASB
- Allow manual override of Spanish and English translation selections
- Ensure translation labels always match the actual text rendered
- Audit all translation-switching behavior
- Fix any current issue where labels change without verse text changing
- Fix any current issue where verse text changes without label accuracy

#### Checkpoint
A user who selects NBLA + NASB must see NBLA Spanish text and NASB English text, not mismatched labels.

---

## Phase 4: Rebuild the Home Screen Around Clarity
Goal: make the app’s main screen calm and obvious.

#### Required Home Content
- app header
- Verse of the Day
- current translation pairing
- main Memorize CTA
- lightweight progress summary if useful

#### Tasks
- Remove shortcut cards such as duplicate review shortcuts
- Keep the layout visually focused on one main next step
- Make the main Memorize CTA the strongest action on screen
- Show the active translation pairing clearly
- Show a minimal progress summary only if it is truly useful
- Keep spacing generous and uncluttered
- Ensure the screen works full-width on web and mobile without fake phone framing

#### Checkpoint
The user should instantly understand:
- what today’s verse is
- which translations they are using
- where to tap to start memorizing

---

## Phase 5: Build the Memorization Flow Exactly
Goal: make the core product feel structured and reliable.

#### Required Persistent Verse Context
The Memorize screen must always show:
- book name
- chapter number
- verse number
- active translation pair

#### Fixed Sequence
1. first and second letters only
2. random visible words mixed with blanks
3. a different pattern of random visible words mixed with blanks
4. first letter of each word only
5. all blanks

#### Tasks
- Implement each memorization stage in the exact order
- Make stage progression clear and stable
- Add visible step indication without over-designing it
- Keep button behavior reliable
- Avoid flashy CTA animation
- Ensure bilingual mode works in each step
- Ensure Spanish appears first when both languages are active
- Make all-blanks screen support hold-to-peek
- Make hold-to-peek reveal while pressed
- Make hold-to-peek hide on release
- Test the hold behavior for pointer, touch, and long-press stability
- Prevent accidental sticky reveal states

#### Checkpoint
The user should be able to move through the sequence without confusion, broken buttons, or unstable hold behavior.

---

## Phase 6: Simplify Flashcards
Goal: make Flashcards useful and consistent with the active verse.

#### MVP Rule
Flashcards use only the current active Verse of the Day.

#### Required Behavior
- front shows verse text only
- front does not show the reference
- back shows:
  - book
  - chapter
  - verse number
  - full reference
- in bilingual mode:
  - Spanish first
  - English below

#### Tasks
- Bind Flashcards to the same active verse source as Home and Memorize
- Remove any deck behavior that introduces other verses in MVP
- Confirm card front never leaks the reference
- Confirm card back reveals the reference cleanly
- Confirm bilingual order is preserved
- Make flip behavior smooth but not theatrical

#### Checkpoint
Flashcards should feel like a direct recall test for the same verse the user is memorizing today.

---

## Phase 7: Redefine Saved Clearly
Goal: keep Saved useful without bloating the product.

#### MVP Purpose of Saved
Saved is for verses the user intentionally chooses to keep.

#### Tasks
- Keep Saved as a distinct tab
- Define save behavior clearly
- Allow users to view saved verses later
- Keep Saved visually simpler than a dashboard
- Remove milestone clutter from this section
- Decide whether Saved includes a small memorized marker or completion indicator
- Ensure Saved does not hijack the active verse flow
- Treat saved verses as a separate collection, not the daily source of truth

#### Checkpoint
A user should understand Saved as “my kept verses,” not “today’s practice tab” and not “stats.”

---

## Phase 8: Simplify Progress
Goal: preserve encouragement without clutter.

#### MVP Progress Model
Use lightweight progress only.

#### Recommended Data
- verses memorized count
- current verse completion state
- saved verses count
- optional recent activity
- optional best streak only if it feels meaningful

#### Tasks
- Remove milestone ladders and filler progress cards
- Remove decorative gamification that does not help the user
- Add a minimal progress summary to Home or Saved if needed
- Rewrite progress language to feel honest and encouraging
- Avoid noisy dashboards

#### Checkpoint
Progress should feel like a helpful glance, not a separate product.

---

## Phase 9: Simplify Settings
Goal: reduce confusion between similar concepts.

#### Settings Must Include Only
- App Language
- Bilingual Memorization
- Translations
- Appearance
- Reminders
- Save button

#### Tasks
- Remove nonessential settings
- Clearly separate:
  - app language
  - bilingual memorization mode
  - Bible translations
- Add simple explanations under each setting where needed
- Keep the Save action clear and reliable
- Use native-feeling Spanish labels
- Confirm that setting changes update relevant screens correctly

#### Checkpoint
A user should not confuse interface language with Bible translation or bilingual display mode.

---

## Phase 10: Add Reminder Controls
Goal: support habit without adding complexity.

#### Required Reminder Controls
- on or off
- time of day
- app notification
- text message reminder if supported, or clearly marked as coming soon

#### Tasks
- Add reminder step to onboarding
- Add same reminder controls to Settings
- Define reminder defaults
- Make unsupported SMS clearly labeled
- Keep copy calm and straightforward

#### Checkpoint
Users should be able to set a reminder in under 30 seconds.

---

## Phase 11: Make Themes Real
Goal: deliver true full-app light and dark modes.

#### Appearance Modes
- Light
- Dark
- Auto

#### Tasks
- Apply theme styling across the full viewport
- Ensure no fake partial theming
- Make light mode clearly brighter, warmer, and cleaner
- Make dark mode immersive, warm, readable, and premium
- Audit all screens for contrast, typography sharpness, and component consistency
- Remove muddy lilac, greasy glow, washed-out surfaces, and fuzzy rendering
- Confirm both themes feel intentional, not inverted afterthoughts

#### Checkpoint
Users should instantly perceive light mode and dark mode as two complete, polished experiences.

---

## Phase 12: Tighten Motion and Interaction
Goal: create delight without distraction.

#### Allowed Motion Areas
- progress bars
- step indicators
- card entrance
- count-up stats if any remain
- smooth transitions
- tasteful celebration moments

#### Avoid
- hyperactive CTA buttons
- distracting bounce loops
- decorative motion with no meaning
- unstable transitions

#### Tasks
- Reduce unnecessary animation
- Keep CTA buttons stable and premium
- Make scrolling smooth and reliable
- Ensure hover, press, and tap states feel responsive
- Use motion to clarify state changes, not decorate the screen

#### Checkpoint
The interface should feel alive, but never chaotic.

---

## Phase 13: Tighten Typography and Rendering Quality
Goal: make the app feel premium and easy to read.

#### Tasks
- Audit font sizes, weights, line-height, and spacing
- Improve rendering sharpness across light and dark themes
- Remove fuzzy or muddy text presentation
- Make headings crisp and calm
- Ensure body text remains readable on mobile
- Confirm bilingual text blocks remain clean and well spaced
- Preserve spiritual tone through restraint and clarity

#### Checkpoint
The app should look polished at a glance and stay readable during longer practice.

---

## Phase 14: Fix Copy Quality
Goal: make the interface feel natural and trustworthy.

#### Copy Rules
- keep language plain
- keep labels short
- use natural Spanish
- avoid literal or awkward translation

#### Good Spanish Examples
- Versículo del día
- Días seguidos
- Mantén para ver
- Cambios guardados

#### Tasks
- Audit all Spanish UI labels
- Replace awkward or robotic phrasing
- Keep English and Spanish tone aligned
- Ensure spiritual language remains respectful and warm
- Keep buttons clear and action-based

#### Checkpoint
Spanish should sound native, not machine-translated.

---

## Phase 15: QA the Product Like a Real MVP
Goal: ship a clean, trustworthy first version.

#### Functional QA
- translation switching updates real verse text
- translation labels always match verse text
- Home, Memorize, and Flashcards stay synced
- light mode exists across the full app
- buttons work reliably
- hold-to-peek is stable
- scrolling is smooth
- settings are not overloaded
- Saved works as intentional user storage

#### UX QA
- each tab has a clear purpose
- Home is focused
- Memorize feels predictable
- Flashcards feel aligned with memorization
- Saved makes sense immediately
- progress feels light, not noisy

#### Visual QA
- typography is crisp
- contrast is strong
- themes feel premium
- motion is restrained
- shadows and glow are controlled
- the app feels warm, playful, and respectful

---

## Suggested Timeline

### Week 1: Product Cleanup Decisions
- finalize navigation
- finalize Saved purpose
- finalize progress simplification
- freeze settings structure
- freeze translation and bilingual rules

### Week 2: State and Content Integrity
- unify active verse source of truth
- repair verse and translation mapping
- fix cross-screen sync
- define day rollover behavior

### Week 3: Core Screen Cleanup
- rebuild Home
- rebuild Memorize
- rebuild Flashcards
- simplify Saved

### Week 4: Settings, Reminders, and Themes
- simplify Settings
- add reminder controls
- complete real light mode
- refine dark mode

### Week 5: Polish and Interaction QA
- fix hold-to-peek
- improve button reliability
- reduce noisy animation
- smooth scrolling
- sharpen typography

### Week 6: Acceptance Testing
- test complete user journeys
- test language and translation switching
- test responsive behavior
- test polish in both themes
- fix remaining drift issues

---

## Team Roles

### Product Lead
Owns:
- source-of-truth product rules
- scope discipline
- final content decisions

### Design Lead
Owns:
- theme quality
- hierarchy
- spacing
- motion restraint
- premium readability

### Builder
Owns:
- state consistency
- reliable interactions
- responsive layout
- settings behavior
- implementation cleanup

### QA Reviewer
Owns:
- mismatch detection
- interaction stability
- translation accuracy
- theme completeness
- polish verification

---

## Recommended Rituals

### 1. Weekly Scope Check
Ask:
- does this still support one active verse?
- does this reduce confusion?
- does this improve trust?

### 2. Bi-Weekly Product Review
Review:
- Home clarity
- memorization stability
- Flashcards sync
- Settings simplicity
- visual polish

### 3. Monthly 30-Minute Usability Test
Use three people.
Watch them:
- find today’s verse
- start memorizing
- flip a flashcard
- save a verse
- change language or translations

Log the top three confusions.
Fix those first.

---

## Optional Integrations

### Good Optional Integrations
- app notifications
- SMS reminders later, if supported properly
- analytics for flow completion and setting usage
- simple content management for verse-of-the-day updates

### Do Not Add Yet
- social sharing systems
- leaderboards
- advanced streak mechanics
- study tools
- notes and commentary
- multi-verse card decks

---

## Stretch Goals
Only consider after MVP is stable.

### Possible Stretch Goals
- lightweight memorized history
- saved-verse review mode
- gentle completion celebrations
- onboarding refinement
- family-friendly account ideas

### Stretch Rule
No stretch goal should weaken clarity, trust, or the one-verse focus.
