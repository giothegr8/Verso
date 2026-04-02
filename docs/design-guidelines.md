## Verso Design Guidelines

## Emotional Tone
Feels like a quiet morning with Scripture: warm, clear, premium, and calm enough to invite focus without draining attention.

## Design Intent
Verso should not feel like a gamified productivity tool.
It should not feel childish.
It should not feel like a dense Bible study platform.

It should feel:
- spiritually respectful
- playful in a restrained way
- child-friendly without being childish
- crisp and premium
- warm and welcoming
- simple enough to understand at a glance

This is a product for daily return.
The interface should reduce noise, not add more of it. :contentReference[oaicite:0]{index=0}

## Visual Style Anchors
Use these as grounding references:
- **Apple Human Interface** for calm polish and restraint
- **Linear** for crisp hierarchy and premium spacing
- **shadcn/ui** for clean system consistency
- **Editorial warmth** rather than corporate coldness
- **Kindness in design** over efficiency theater

The product should feel intentional and emotionally supportive.
Every visual choice should help the user feel welcomed, not managed. :contentReference[oaicite:1]{index=1}

## Typography

### Typography Goal
Typography should carry much of the premium feel.
It must be sharp, readable, reverent, and stable across light and dark themes.

### Recommended Direction
Use a two-family system at most:
- **Display or heading serif** for warmth, dignity, and spiritual tone
- **Clean sans-serif** for UI labels, controls, body copy, and settings

This creates contrast:
- serif = trust, reverence, calm emphasis
- sans = clarity, speed, legibility

### Hierarchy
Use a modular scale with generous line-height.

#### H1
- Use for primary screen titles
- Size: 36px
- Weight: 600–700
- Line-height: 1.2
}

#### H2
- Use for major section titles
- Size: 30px
- Weight: 600
- Line-height: 1.25

#### H3
- Use for card titles and important labels
- Size: 24px
- Weight: 600
- Line-height: 1.3

#### H4
- Use for smaller grouped headings
- Size: 20px
- Weight: 600
- Line-height: 1.35

#### Body Large
- Use for verse text on primary screens
- Size: 18px
- Weight: 400–500
- Line-height: 1.65

#### Body Standard
- Use for settings, supporting text, and secondary copy
- Size: 16px
- Weight: 400–500
- Line-height: 1.6

#### Caption
- Use for helper text, metadata, translation chips, and subtle notes
- Size: 13–14px
- Weight: 500
- Line-height: 1.5

### Verse Text Rules
Verse text is sacred content.
Treat it with visual respect.

Rules:
- never cram verse text into tight containers
- avoid overly light font weights
- do not use aggressive letter spacing
- give bilingual verse blocks breathing room
- Spanish should appear first when both languages are shown
- reference metadata should be visible, but never louder than the verse itself

### Rendering Quality
Typography must feel crisp.
Avoid:
- fuzzy anti-aliasing
- washed-out contrast
- muddy gray-on-gray text
- decorative blur behind important words
- low-contrast verse rendering

### Accessibility
- maintain at least 1.5x line-height for all reading text
- ensure text contrast meets WCAG AA minimum
- do not rely on color alone for hierarchy

## Color System

### Color Mood
The palette should feel:
- warm
- reverent
- premium
- slightly playful
- calm, never sleepy
- vivid enough to feel alive
- controlled enough to feel trustworthy

Avoid:
- muddy lilac
- neon overload
- greasy glows
- washed-out surfaces
- gray palettes that feel emotionally flat

### Core Palette

#### Primary
Royal Iris
- Hex: `#7C3AED`
- RGB: `124, 58, 237`

Use for:
- primary CTA emphasis
- active states
- key icons
- selected nav state
- premium accent moments

Emotional read:
- spiritual, confident, modern, memorable

#### Secondary
Deep Plum
- Hex: `#4C1D95`
- RGB: `76, 29, 149`

Use for:
- darker accent surfaces
- secondary chips
- elevated dark mode support
- subtle depth behind important controls

Emotional read:
- grounded, rich, reverent

#### Warm Accent
Amber Flame
- Hex: `#F59E0B`
- RGB: `245, 158, 11`

Use for:
- reminder accents
- gentle progress highlights
- celebratory moments
- limited status emphasis

Emotional read:
- hopeful, warm, encouraging

#### Success
Emerald Calm
- Hex: `#10B981`
- RGB: `16, 185, 129`

Use for:
- completion states
- confirmation messages
- progress success

Emotional read:
- peaceful, reassuring

#### Error
Rose Redwood
- Hex: `#E11D48`
- RGB: `225, 29, 72`

Use for:
- validation errors
- destructive actions
- warning emphasis

Emotional read:
- clear, serious, but not harsh

### Neutral Palette

#### Light Theme Neutrals
- Background: `#FFFDF9` / `255, 253, 249`
- Surface: `#F8F4EE` / `248, 244, 238`
- Surface Raised: `#FFFFFF` / `255, 255, 255`
- Border: `#E8E0D4` / `232, 224, 212`
- Primary Text: `#1F172A` / `31, 23, 42`
- Secondary Text: `#5B5563` / `91, 85, 99`

Light mode should feel:
- bright
- warm
- cheerful
- crisp
- clearly lighter than dark mode

#### Dark Theme Neutrals
- Background: `#0B0911` / `11, 9, 17`
- Surface: `#14111B` / `20, 17, 27`
- Surface Raised: `#1B1724` / `27, 23, 36`
- Border: `#2A2435` / `42, 36, 53`
- Primary Text: `#F5F1EA` / `245, 241, 234`
- Secondary Text: `#B7AFC4` / `183, 175, 196`

Dark mode should feel:
- immersive
- warm
- readable
- premium

### Color Usage Rules
- keep purple as a signature accent, not a flood color
- use warm neutrals to avoid sterile black-and-white contrast
- reserve bright accent colors for meaning
- do not use too many competing highlight colors on one screen
- milestone or progress color systems must stay quiet and limited

### Contrast
- all text must meet WCAG AA minimum contrast
- target 4.5:1 or better for body text
- target stronger contrast for verse content and CTAs
- test both themes independently

## Spacing & Layout

### Layout Goal
The layout should feel breathable and deliberate.
Users should never feel crowded or rushed.

### Grid System
Use an 8pt spacing system.

Base spacing scale:
- 4
- 8
- 12
- 16
- 24
- 32
- 40
- 48
- 64

### Layout Rules
- mobile-first
- full-screen layout across the full viewport
- no fake phone-frame presentation
- generous top and bottom breathing room
- clear separation between verse content and controls
- cards should feel anchored, not floating chaotically

### Component Padding
#### Buttons
- vertical padding: 12–14px
- horizontal padding: 16–20px

#### Cards
- internal padding: 16–24px
- more padding for verse content cards

#### Screen Gutters
- mobile: 16px
- tablet: 24px
- desktop: 32px minimum

### Vertical Rhythm
Each screen should have a clear reading rhythm:
- title
- verse or main content
- primary action
- secondary support content

Do not stack too many equivalent cards.
Do not break rhythm with filler blocks.

### Responsive Breakpoints
- Mobile: 320–767px
- Tablet: 768–1023px
- Desktop: 1024px and up

### Responsive Behavior
- preserve full-width readability
- scale type carefully, not dramatically
- keep CTA positions predictable
- avoid tiny touch targets
- do not compress bilingual verse layouts until they feel cramped

## Motion & Interaction

### Motion Philosophy
Motion should express kindness, not performance.
It should reassure, guide, and confirm.
It should never feel like a reward machine. :contentReference[oaicite:2]{index=2}

### Motion Tone
- gentle
- confident
- polished
- subtle
- emotionally supportive

### Timing
- standard interaction transitions: 150–220ms
- card transitions: 180–260ms
- celebratory moments: 220–300ms
- do not exceed 300ms unless a rare cinematic moment truly earns it

### Easing
Prefer:
- ease-out for entrances
- ease-in-out for state changes
- soft spring for small reveal interactions only

Avoid:
- elastic bounce
- exaggerated overshoot
- repeated pulsing
- attention-hijacking loops

### Allowed Motion
- progress bar updates
- memorization step transitions
- card entrances
- flashcard flips
- count-up moments, if any remain
- gentle success confirmations
- smooth theme changes

### Avoid
- over-animated CTA buttons
- noisy hover effects
- dramatic shakes
- floating decorative motion
- motion that delays task completion

### Interaction Rules
#### Primary Buttons
Buttons should feel:
- stable
- premium
- responsive
- obvious

Do not make buttons feel toy-like.

#### Hold-to-Peek
The hold-to-peek interaction is emotionally important.
It should feel forgiving and reliable.

Rules:
- press and hold reveals the verse
- release hides it
- do not require awkward precision
- support touch and pointer input
- provide subtle visual feedback while held
- never leave the verse accidentally stuck open

#### Flashcard Flip
- quick and smooth
- readable before and after
- no dramatic 3D theatrics
- content remains the star

#### Scrolling
- smooth
- predictable
- free of jitter
- no sticky awkwardness between sections

### Empty States
Empty states should feel patient and encouraging.

Good tone:
- calm
- inviting
- supportive

Bad tone:
- guilt-driven
- overly cute
- overly clever

## Voice & Tone

### Personality
The product voice should feel:
- warm
- respectful
- calm
- encouraging
- clear
- native in both languages

### Copy Principles
- use short labels
- prefer plain words
- sound human, not app-like
- avoid robotic direct translations
- avoid over-cheerful language
- avoid guilt, pressure, or spiritual performance language

### Spanish Copy Rules
Spanish must feel natural and native.

Use patterns like:
- Versículo del día
- Días seguidos
- Mantén para ver
- Cambios guardados

Avoid awkward phrasing such as:
- Días racha
- literal English sentence structure
- “versos” where “versículos” is the right UI word in context

### Microcopy Examples
#### Onboarding
English:
“Start with one verse today.”

Spanish:
“Empieza hoy con un versículo.”

#### Success
English:
“Saved.”

Spanish:
“Guardado.”

Or:
“Changes saved.”
“Cambios guardados.”

#### Error
English:
“We couldn’t load that verse. Try again.”

Spanish:
“No pudimos cargar ese versículo. Inténtalo de nuevo.”

### Notification Tone
Reminder copy should feel gentle.
Example:
- “Your verse is ready.”
- “Tu versículo de hoy está listo.”

Not:
- “You’re falling behind”
- “Don’t break your streak”

## System Consistency

### Recurring Patterns
Use a small set of repeated patterns across the app:
- verse card
- translation chip
- primary action bar
- memorization step header
- saved verse card
- settings section group

### Consistency Rules
- same active verse display pattern across Home, Memorize, and Flashcards
- same bilingual order everywhere: Spanish first, English second
- same chip styling for translation metadata
- same CTA weight and shape across screens
- same header rhythm across tabs
- same spacing language across light and dark modes

### Metaphor
The app should feel like a small, cared-for Scripture companion.
Not a dashboard.
Not a game.
Not a content warehouse.

## Accessibility

### Structural Accessibility
- use semantic headings in correct order
- include landmarks for navigation and main content
- use buttons for button actions
- use real labels for settings controls
- ensure flashcards and hold-to-peek remain keyboard accessible where applicable

### Keyboard Navigation
- all major controls reachable by keyboard
- visible focus indicators on every interactive element
- no hidden critical actions behind hover only
- tab order should follow reading order

### Focus Indicators
Focus states should be:
- visible
- high-contrast
- consistent
- premium, not default-browser ugly if custom styled

### ARIA & Supportive Semantics
- use ARIA only where native semantics are not enough
- label icon-only buttons clearly
- ensure flashcard flip controls have accessible names
- ensure reminder toggles announce state properly

### Comfort & Inclusivity
- avoid visually aggressive flashing
- avoid cluttered dense layouts
- support tired, distracted, and first-time users
- assume the user may be stressed, rushed, or new

## Screen-Specific Design Notes

### Home
Should feel like a clear welcome.
One verse.
One next step.
Minimal supporting information.

Keep:
- header
- Verse of the Day
- active translation pair
- main Memorize CTA
- minimal progress summary only if useful

Remove:
- extra shortcut clutter
- duplicate review cards
- filler dashboard blocks

### Memorize
Should feel focused and structured.

Design needs:
- strong verse hierarchy
- visible step progression
- stable controls
- quiet confidence
- no visual overload

### Flashcards
Should feel like a calm recall exercise.

Design needs:
- front and back clearly distinct
- verse text centered or strongly framed
- reference hidden on front
- bilingual order preserved on back

### Saved
Should feel like a personal collection.

Design needs:
- simple list or card system
- clear save state
- easy scan of references
- no dashboard clutter
- no gamified noise

### Settings
Should feel lightweight and organized.

Design needs:
- clear section labels
- short helper text
- obvious Save action
- visible difference between app language, bilingual mode, and translation settings

## Emotional Audit Checklist
Review every major decision against these questions:

- Does this interface evoke calm, warmth, clarity, and respect?
- Does the design support Scripture memorization rather than distract from it?
- Are motion and microcopy reinforcing the intended tone?
- Would a child understand the next action quickly?
- Would an adult still see it as premium?
- Does the product feel supportive, not judging?
- Does the interface help the user feel more capable and less overwhelmed? :contentReference[oaicite:3]{index=3}

## Technical QA Checklist
- typography follows the defined hierarchy
- type scale aligns with spacing rhythm
- contrast ratios meet WCAG AA or better
- interactive states are distinct
- focus states are visible
- motion stays between 150–300ms unless intentionally exceptional
- bilingual layout remains readable at all breakpoints
- light mode and dark mode both feel complete
- verse text remains crisp in every state
- CTA buttons remain stable and reliable

## Adaptive System Memory
Existing Verso direction already points to:
- warm premium dark mode
- stronger need for real light mode
- reduced dashboard clutter
- simpler progress visibility
- emphasis on crisp typography
- spiritual respect over gamification

Reuse suggestions:
- retain purple as the core brand accent
- keep the warm-premium dark atmosphere
- simplify progress instead of expanding it
- use Saved as a meaningful personal collection
- keep motion quiet and kind rather than celebratory by default

## Design Snapshot Output

### Color Palette Preview
```text
Primary        #7C3AED
Secondary      #4C1D95
Warm Accent    #F59E0B
Success        #10B981
Error          #E11D48

Light BG       #FFFDF9
Light Surface  #F8F4EE
Light Border   #E8E0D4
Light Text     #1F172A

Dark BG        #0B0911
Dark Surface   #14111B
Dark Border    #2A2435
Dark Text      #F5F1EA
```
