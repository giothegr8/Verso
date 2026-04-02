## Verso MVP Masterplan

## 30-Second Elevator Pitch
Verso is a web-first, mobile-friendly Bible verse memorization app built for focus.
It helps people memorize one verse at a time in Spanish, English, or both.
The experience should feel warm, premium, playful, spiritually respectful, and simple enough for a child to use.

## Problem & Mission

### Problem
Most Bible apps are too broad for memorization.
They mix reading, study, plans, highlights, notes, and navigation into one crowded experience.

That creates friction for users who want one simple thing:
memorize Scripture clearly, calmly, and consistently.

It gets worse when:
- the app shows too many verses at once
- translation logic is confusing
- memorization steps feel inconsistent
- progress screens add clutter instead of clarity
- visual polish feels unfinished or unreliable

### Mission
Help users memorize one Bible verse at a time through a clean, bilingual, spiritually respectful experience that stays focused on a single active verse.

## Product Overview

### Product Type
Web-first, mobile-friendly responsive app

### Product Focus
A single active Verse of the Day powers the main memorization experience.

### Product Promise
Verso should feel:
- crisp
- premium
- warm
- child-friendly without being childish
- spiritually respectful
- polished without feeling overloaded

### Core Product Boundaries
Verso is:
- a verse memorization app
- centered on one active verse at a time
- designed for Spanish, English, or bilingual memorization

Verso is not:
- a full Bible app
- a deep study app
- a multi-verse cram tool
- a streak-heavy gamification product

## Product Goals

### Primary Goals
- Make verse memorization feel obvious and inviting
- Keep one active verse synced across core tabs
- Support Spanish only, English only, or both
- Make translation choices clear and trustworthy
- Deliver a premium-feeling light and dark experience
- Reduce builder drift by defining clear product rules

### Success Looks Like
A user can:
- open the app and instantly know what today’s verse is
- begin memorizing with one obvious tap
- practice through a predictable memorization sequence
- review the same verse in Flashcards without mismatch
- save verses intentionally for later
- change language or translations without breaking verse accuracy

## Non-Goals

### Out of Scope for the Core Product
- full-book Bible reading
- chapter browsing
- sermon notes
- commentary or study tools
- theological reference features
- multi-verse deck memorization in MVP
- achievement-heavy milestone systems
- decorative dashboards with weak utility

### Product Discipline Rule
If a feature weakens focus on the single active verse, it should not be in MVP.

## Target Audience

### Primary Audience
Christians, families, bilingual users, and learners who want a focused way to memorize Scripture in Spanish, English, or both.

### Core User Types

#### 1. Focused Individual Memorizer
Wants one clear daily verse and a simple path to practice.

#### 2. Bilingual Scripture Learner
Wants to memorize in Spanish and English side by side.

#### 3. Parent or Family User
Needs an interface simple enough for a child to understand.

#### 4. Warm-Design Sensitive User
Wants an app that feels calm, polished, and spiritually respectful rather than noisy or childish.

## Core Features

### 1. Verse of the Day
The Verse of the Day is the single source of truth for the active verse.

Used across:
- Home
- Memorize
- Flashcards
- review actions tied to the active verse

### 2. Memorize Flow
A structured step-by-step memorization sequence for the active verse.

### 3. Flashcards
Single-verse flashcards tied to the current active verse in MVP.

### 4. Saved Verses
A place for verses the user intentionally chooses to keep for later.

### 5. Bilingual Display Modes
Users can choose:
- Spanish only
- English only
- Both languages

### 6. Translation Controls
Users can choose translation pairings and override default smart pairs.

### 7. Reminders
Daily reminder settings available in onboarding and Settings.

### 8. Appearance Modes
Full-app support for:
- Light
- Dark
- Auto

## Information Architecture

### Recommended Bottom Navigation for MVP
- Home
- Memorize
- Flashcards
- Saved

### Why This Structure Wins
It is simpler than the current setup.
It removes a weak Stats destination.
It keeps every tab tied to a clear job.

### Tab Purposes

#### Home
Daily focus screen.
Shows the Verse of the Day, active translation pairing, main memorization CTA, and a small progress summary.

#### Memorize
Primary practice flow for the active verse.

#### Flashcards
Active-verse recall practice.

#### Saved
User-kept verses only.
Not a dashboard.
Not a duplicate of Home.

### What Happens to Stats
Stats should not exist as a full MVP tab.

Instead:
- show light progress summary on Home
- optionally show simple counts inside Saved
- avoid milestone ladders and filler dashboards

## High-Level Tech Stack

### Frontend
Modern responsive web app

Why:
- aligns with web-first direction
- supports full-screen responsive layouts
- avoids fake phone-frame design
- enables consistent light and dark modes

### Design System
Reusable UI system with strict typography, spacing, button, theme, and state rules

Why:
- reduces drift
- keeps screens visually consistent
- improves rendering quality and trust

### State Layer
Centralized product state for:
- active verse
- language mode
- translation selection
- theme
- saved state
- memorization progress state

Why:
- prevents screen mismatch
- keeps verse data and labels synced
- makes Flashcards and Memorize trustworthy

### Content/Data Layer
Structured verse content by:
- book
- chapter
- verse number
- Spanish translation
- English translation
- translation metadata

Why:
- ensures real verse text matches visible labels
- supports bilingual rendering without hacks

### Notifications
Reminder service for:
- app notifications
- optional SMS if supported later

Why:
- supports daily habit without bloating core flow

## Conceptual Data Model

### Core Entities

#### User
Stores:
- interface language
- bilingual memorization preference
- translation preferences
- appearance setting
- reminder settings

#### Verse
Stores:
- canonical reference
- book name
- chapter number
- verse number
- supported translation text values

#### Active Verse State
Stores:
- current Verse of the Day
- active translation pairing
- active bilingual mode
- current memorization step
- completion state

#### Saved Verse
Stores:
- user ID
- verse ID
- saved timestamp

#### Progress Snapshot
Stores lightweight progress info such as:
- verses memorized count
- current streak if retained
- last practiced date
- current verse completion

### ERD Sketch in Words
A User has one settings profile.
A Verse can have multiple translation text records.
A User has one active verse state at a time.
A User can save many verses.
A User can have lightweight progress snapshots tied to verse activity.

## UI Design Principles

### 1. One Primary Action Per Screen
Each screen should make the next step obvious.

### 2. One Active Verse, Everywhere
Do not make users wonder which verse they are practicing.

### 3. Show Only What Helps
Remove shortcut clutter, weak stats, and decorative cards.

### 4. Premium Clarity
Typography must feel sharp, intentional, and readable in both themes.

### 5. Child-Simple, Not Childish
Warm visuals are welcome.
Confusion is not.

### 6. Respect the Content
The app should feel spiritually respectful.
No noisy gamification.
No chaotic motion.
No gimmicky copy.

### 7. Trust Through Accuracy
Translation labels must always match the verse text shown.

## Security & Compliance Notes

### Core Security Principles
- protect user settings and saved verses
- store reminder preferences safely
- avoid misleading translation labels or incorrect verse mapping
- treat verse text and translation metadata as trusted content

### Privacy Notes
MVP should store only the minimum user data needed for:
- preferences
- saved verses
- reminders
- lightweight progress

### Compliance Caution
If SMS reminders are added, legal and consent requirements must be handled explicitly before launch.

## MVP Roadmap

### MVP
- Home
- Memorize
- Flashcards
- Saved
- Verse of the Day as source of truth
- bilingual display modes
- translation controls
- reminders
- full light/dark/auto themes
- stable hold-to-peek
- crisp responsive UI

### V1
- better saved verse organization
- lightweight memorized history
- clearer completion summaries
- improved reminder controls
- more polished onboarding

### V2
- optional saved-verse review flows
- richer progress history
- family/shared usage ideas
- more advanced encouragement systems, if they remain calm and useful

## Known Risks & Mitigations

### Risk: Verse Mismatch Across Screens
Home, Memorize, and Flashcards may drift out of sync.

Mitigation:
Use one shared active verse state as the single source of truth.

### Risk: Translation Labels Do Not Match Verse Text
Users lose trust immediately.

Mitigation:
Bind text rendering directly to selected translation metadata.
Never update labels without updating source text.

### Risk: Light Mode Feels Fake or Incomplete
The product feels unfinished.

Mitigation:
Treat light mode as a first-class theme across the full viewport.

### Risk: Settings Become Overloaded
Users confuse app language, bilingual mode, and translation choices.

Mitigation:
Separate each setting clearly and explain its purpose in plain language.

### Risk: Buttons Feel Decorative
Core actions feel unreliable.

Mitigation:
Define interaction QA for every primary CTA and hold action.

### Risk: Progress Adds Noise
Dashboard-style stats weaken the product.

Mitigation:
Replace full Stats with small, useful summaries only.

## Future Expansion Ideas

### Good Future Expansions
- optional review mode for saved verses
- gentle memorization history
- family or classroom-friendly flows
- richer encouragement moments
- verse collections curated by theme or season

### Expansion Rule
Any future feature must preserve the core identity:
one focused verse, clear memorization, low friction, high trust.

## Final Product Positioning
Verso should feel like a calm, premium place to return to Scripture daily.
It should not try to do everything.
It should do one thing beautifully:
help users memorize one verse at a time, clearly and consistently.
