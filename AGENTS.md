# Repository Operating Instructions

These instructions apply to future work in this repository.

## Source Of Truth

Use this order when facts conflict:

1. Current code and configuration
2. Git history
3. Existing documentation
4. Locked owner decisions from the active task prompt

Do not treat older planning docs as authoritative when they conflict with code.

## Required Baseline Verification

Before making changes, verify the local checkout:

```bash
pwd
git branch --show-current
git rev-parse --short HEAD
git status --short --untracked-files=all
```

Expected baseline for the current handoff:

- Folder: `/Users/giovannirincon/Documents/Verso`
- Branch: `fix/p0-cards-crash-reference-language`
- HEAD: `e578706`
- Working tree: clean

Branch status:

- This branch has not been merged into `main`.
- Do not describe the branch as merged.
- Do not describe `e578706` as a main-branch release.
- Preserve the current branch as the active recoverable checkpoint.
- The future merge decision is a separate explicit checkpoint after remaining
  app-completion work and regression QA.

If any required baseline differs, stop and report the difference before making
changes.

## Patch Discipline

- Keep patches narrow and aligned with the user's requested scope.
- Diagnose before implementing, especially for Cards, focus, state, and
  persistence work.
- Do not bundle unrelated cleanup with feature or bug patches.
- Do not modify configuration, legal files, source files, assets, or deployment
  files unless they are explicitly in scope.
- Keep documentation synchronized after completed checkpoints.

## Git And Repository Safety

Do not run any of the following without explicit owner authorization:

- `git commit`
- `git push`
- `git merge`
- `git reset`
- `git restore`
- `git checkout`
- `git clean`
- staging files
- opening a pull request
- creating or using a worktree
- changing `main`
- describing an unmerged branch as merged

Never discard or overwrite user work unless the owner explicitly asks for that
exact destructive action.

## Verification Commands

Use the smallest verification set appropriate to the change. For code changes,
the usual checks are:

```bash
npx tsc --noEmit
npm run build
git diff --check
git status --short --untracked-files=all
git diff --stat
```

For docs-only patches, use at minimum:

```bash
git diff --check
git status --short --untracked-files=all
git diff --stat
```

Do not run dependency installs, builds, tests, or networked commands when the
user has prohibited them.

## Approval Expectations

Request owner approval before:

- installing dependencies
- using network access
- running commands that require elevated filesystem permissions
- destructive Git operations
- changing production, deployment, or legal behavior

## Cards Architecture Warning

Bilingual Cards cross-language keyboard navigation remains unresolved. Previous
experimental Left/Right and Up/Down approaches were reverted because they
caused sticky focus, swallowed first-character input, row skipping, or caret
flicker. The repository is currently clean at e578706. Another implementation
must begin with an architectural diagnosis of the hidden-input, focus,
cursor-ref, cursor-state, and visible-caret model.

Likely file: `src/components/Flashcards.tsx`.

Do not attempt another boundary-key patch until the hidden input, active
language, cursor refs, cursor state, rendered slot order, browser selection,
focus timing, and visible caret model have been traced end to end.
