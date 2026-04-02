## Verso App Flow, Pages, and Roles

## Product Structure
Verso is a focused memorization app.
The MVP should feel small, clear, and intentional.

It is built around one rule:
the Verse of the Day is the active verse across the main practice experience.

That means:
- Home uses the active verse
- Memorize uses the active verse
- Flashcards uses the active verse
- Saved is separate and only contains verses the user intentionally keeps

## Recommended MVP Navigation

### Bottom Navigation
- Home
- Memorize
- Flashcards
- Saved

### Why This Structure
This navigation is the clearest version of the product.
Each tab has one obvious job.
It removes the weaker Stats destination and keeps the app centered on the main daily experience.

## Site Map

### 1. Home
Purpose:
Daily entry point for the active Verse of the Day.

### 2. Memorize
Purpose:
Primary guided memorization flow for the active verse.

### 3. Flashcards
Purpose:
Recall practice for the same active verse.

### 4. Saved
Purpose:
Collection of verses the user intentionally saved to revisit later.

### 5. Settings
Purpose:
Manage app language, bilingual memorization, translations, appearance, and reminders.

### 6. Onboarding
Purpose:
Set initial preferences quickly and prepare the user for the daily memorization flow.

## Page-by-Page Requirements

## 1. Home

### Purpose
Make the user instantly understand:
- today’s verse
- current translation pairing
- the next action to take

### Required Content
- app header
- Verse of the Day
- current translation pairing
- primary Memorize CTA
- simple progress summary if useful

### Must Not Include
- extra shortcut cards
- cluttered dashboard widgets
- duplicate review actions
- filler stats blocks

### User Outcome
The user sees today’s verse and starts memorizing with one obvious tap.

## 2. Memorize

### Purpose
Deliver the core memorization experience in a fixed, predictable order.

### Required Persistent Context
- book name
- chapter number
- verse number
- active translation pair

### Memorization Steps
1. first and second letters only
2. random visible words mixed with blanks
3. different random visible words mixed with blanks
4. first letter of each word only
5. all blanks

### Final Step Requirement
On the all-blanks step:
- include hold-to-peek
- pressing and holding reveals the verse
- releasing hides it again
- the interaction must feel stable and forgiving

### User Outcome
The user practices one verse through a reliable structured flow.

## 3. Flashcards

### Purpose
Help the user test recall of the same active verse from Memorize.

### Required Behavior
- front shows verse text only
- front does not show the reference
- back reveals:
  - book
  - chapter
  - verse number
  - full reference

### Bilingual Rule
If bilingual mode is active:
- Spanish appears first
- English appears below

### MVP Limitation
Flashcards only use the current active Verse of the Day.
No multi-verse deck in MVP.

### User Outcome
The user tests recall without switching to unrelated content.

## 4. Saved

### Purpose
Store verses the user intentionally chooses to keep.

### Required Behavior
- users can save verses intentionally
- saved verses appear in a dedicated list or card view
- saved verses remain separate from the active verse system
- saved verses can be reviewed later in a future expansion flow

### Must Not Become
- a second home screen
- a dashboard
- a multi-verse flashcard deck in MVP
- a cluttered archive

### Optional Light Metadata
Saved may show:
- reference
- translation pairing
- saved date
- simple memorized marker if useful

### User Outcome
The user has a clear personal collection without confusing it with today’s memorization flow.

## 5. Settings

### Purpose
Keep preferences clear and manageable.

### Required Sections
- App Language
- Bilingual Memorization
- Translations
- Appearance
- Reminders
- Save button

### Settings Logic
#### App Language
Controls interface language only:
- Español
- English

#### Bilingual Memorization
Controls memorization display:
- Solo Español
- Solo Inglés
- Ambos idiomas

#### Translations
Lets users choose Bible translations.

Spanish options:
- Reina-Valera 1960
- NVI
- NBLA

English options:
- KJV
- NIV
- NASB

Default smart pairings:
- RVR1960 + KJV
- NVI + NIV
- NBLA + NASB

Users must also be able to override those pairings manually.

#### Appearance
- Light
- Dark
- Auto

#### Reminders
- on or off
- time of day
- app notification
- text message reminder if supported, or marked coming soon

### User Outcome
The user can change preferences without confusing app language, bilingual mode, and Bible translation choices.

## 6. Onboarding

### Purpose
Set the minimum preferences needed for a good first session.

### Recommended MVP Onboarding Steps
#### Step 1
Welcome and product framing

#### Step 2
Choose app language:
- Español
- English

#### Step 3
Choose memorization mode:
- Spanish only
- English only
- Both

#### Step 4
Choose preferred translations

#### Step 5
Choose appearance:
- Light
- Dark
- Auto

#### Step 6
Set reminder preference

### Onboarding Tone
- calm
- welcoming
- brief
- spiritually respectful
- easy enough for a child to follow

### User Outcome
The user completes setup quickly and lands in a ready-to-use daily memorization experience.

## Primary User Roles

## 1. Standard User
This is the only required MVP role.

### Access
Can:
- view the Verse of the Day
- memorize the active verse
- use flashcards
- save verses
- manage settings
- set reminders

### Restrictions
Does not manage content systems or admin tools.

## 2. Admin or Content Manager
Not required as a visible in-app role for MVP, but useful as a product concept behind the scenes.

### Access
May manage:
- Verse of the Day content
- verse metadata
- translation mapping
- reminder support configuration

### MVP Note
This does not need to appear in the user-facing app navigation.

## Access Model

### Standard User Access by Page
| Page | Access |
|---|---|
| Home | Yes |
| Memorize | Yes |
| Flashcards | Yes |
| Saved | Yes |
| Settings | Yes |
| Onboarding | Yes |

### Admin/Content Access by Function
| Function | Access |
|---|---|
| Verse of the Day content updates | Admin only |
| Translation metadata management | Admin only |
| User-facing memorization flows | No special admin view needed |

## State and Source-of-Truth Rules

### Rule 1: Active Verse Source of Truth
The Verse of the Day is the single source of truth for the active verse.

### Rule 2: Core Tab Sync
Home, Memorize, and Flashcards must always show the same active verse.

### Rule 3: Saved Separation
Saved verses are separate from the active verse unless a future non-MVP flow explicitly opens one for review.

### Rule 4: Translation Integrity
Translation labels must always match the actual verse text shown.

### Rule 5: Bilingual Order
If both languages are active:
- Spanish first
- English second

### Rule 6: Settings Separation
App language, bilingual memorization mode, and Bible translation settings must remain distinct.

## Primary User Journeys

## Journey 1: Daily Memorization
1. Open Home and see the Verse of the Day
2. Tap Memorize
3. Complete the memorization steps for the active verse

## Journey 2: Quick Recall Practice
1. Open Home or Flashcards
2. View the active verse flashcard
3. Flip the card to test recall of the reference

## Journey 3: Save a Verse
1. Encounter a verse worth keeping
2. Tap Save
3. Find it later in Saved

## Journey 4: Change Display Preferences
1. Open Settings
2. Update language, bilingual mode, translations, or appearance
3. Save changes and see them reflected correctly in the app

## Journey 5: Enable Daily Reminders
1. Open onboarding or Settings
2. Turn reminders on and choose a time
3. Return daily when reminded

## Navigation Logic

### Home to Memorize
Home should always provide the clearest path into Memorize.

### Memorize to Flashcards
Flashcards should feel like a natural extension of the same verse practice, not a separate system.

### Saved to Practice
In MVP, Saved is primarily a collection view.
It does not replace the active daily flow.

### Settings Access
Settings should be reachable globally, but not dominate the product.

## MVP Page Priorities

### Highest Priority
- Home
- Memorize
- Flashcards

These define the core product value.

### Medium Priority
- Saved
- Settings

These support retention and customization.

### Lower Priority
- extended progress systems
- deeper libraries
- multi-verse review systems

These should not distract from MVP focus.

## Content Discipline Rules

### Add a page only if:
- it supports the daily verse flow
- it has a unique job
- the user can understand it immediately

### Do not add a page if:
- it duplicates another tab
- it mainly displays filler stats
- it weakens the one-verse focus
- it exists only because many apps have one

## Final Structure Summary
Verso MVP should feel like a small, polished product with one clear center:
today’s verse.

The cleanest structure is:
- Home for daily focus
- Memorize for guided practice
- Flashcards for recall
- Saved for intentional keeps

That structure keeps the product understandable, useful, and aligned with the real purpose of the app.