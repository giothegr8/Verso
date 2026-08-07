import { MemorizeLanguage, ReviewRecord, ReviewScope } from "../types";

/**
 * PHASE 4A — CENTRALIZED REVIEW COPY.
 *
 * Every new Phase 4A string lives here so the whole surface can be audited in
 * one place. Nothing in the Review feature hardcodes user-facing text.
 *
 * SPANISH SCOPE. The Spanish written here is Colombian Spanish: warm, clear,
 * and phrased the way it is actually said in Colombia rather than translated
 * word for word. "Pulse check" in particular is NOT rendered as a physical
 * pulse — it becomes "la última revisión", which is what a Colombian speaker
 * would say.
 *
 * DEFERRED, ON PURPOSE: this file does NOT constitute the application-wide
 * Colombian-Spanish audit. Every screen written before Phase 4A still needs a
 * dedicated pre-release pass over tone, grammar, capitalization and
 * consistency. That checkpoint remains open.
 */

export type CopyLang = "es" | "en";

// ---------------------------------------------------------------------------
// Mastery descriptions — plain garden language, never a bare number.
// ---------------------------------------------------------------------------

/**
 * LEVEL ZERO HAS NO LABEL.
 *
 * The former "New seed" / "Semilla nueva" was rejected and is not replaced —
 * not by another seed metaphor, not by a placeholder. `null` means the caller
 * must omit that metadata segment entirely, along with its separator, so no
 * doubled or dangling middle dot is left behind. The `string | null` return type
 * is deliberate: it makes TypeScript force every call site to handle absence.
 *
 * Only index 0 changed. Every other mastery phrase is untouched, and the
 * persisted `reviewLevel` and all mastery progression are unaffected — this is
 * a display string, nothing more.
 */
const MASTERY_EN: (string | null)[] = [
  null,
  "Taking root",
  "Sprouting",
  "Growing steady",
  "Deep roots",
  "Flourishing",
];

const MASTERY_ES: (string | null)[] = [
  null,
  "Echando raíz",
  "Brotando",
  "Creciendo firme",
  "Raíces profundas",
  "Floreciendo",
];

export function masteryLabel(level: number, lang: CopyLang): string | null {
  const idx = Math.max(0, Math.min(5, Math.floor(Number(level) || 0)));
  return lang === "es" ? MASTERY_ES[idx] : MASTERY_EN[idx];
}

// ---------------------------------------------------------------------------
// Warm reason labels.
//
// Cascade: unresolved difficulty first (both -> citation -> recall), then
// overdue, then the plain due label. No clinical phrasing, no guilt, no danger,
// no streak pressure.
// ---------------------------------------------------------------------------

export function reasonLabel(record: ReviewRecord, daysOverdue: number, lang: CopyLang): string {
  const isEs = lang === "es";

  if (record.unresolvedStage === "both") {
    return isEs ? "Necesita un poquito de cuidado" : "Needs a little tending";
  }
  if (record.unresolvedStage === "citation") {
    return isEs ? "La raíz necesita un poquito de cariño" : "Root needs a little loving";
  }
  if (record.unresolvedStage === "recall") {
    return isEs ? "Es hora de nutrir" : "Time to nurture";
  }
  if (daysOverdue >= 1) {
    if (daysOverdue === 1) {
      return isEs
        ? "Ha pasado 1 día desde la última revisión"
        : "1 Day since last pulse check";
    }
    return isEs
      ? `Han pasado ${daysOverdue} días desde la última revisión`
      : `${daysOverdue} Days since last pulse check`;
  }
  return isEs ? "Es hora de cuidar" : "Time To Tend";
}

// ---------------------------------------------------------------------------
// Relative timing. Rendered in the user's local timezone; the underlying math
// is always absolute-instant arithmetic done elsewhere.
// ---------------------------------------------------------------------------

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "in 3 days" / "en 3 días" — for a passage that is not yet due. */
export function relativeDueLabel(dueMs: number, nowMs: number, lang: CopyLang): string {
  const isEs = lang === "es";
  const delta = Math.max(0, dueMs - nowMs);

  if (delta < HOUR) {
    const minutes = Math.max(1, Math.round(delta / MINUTE));
    if (minutes === 1) return isEs ? "en 1 minuto" : "in 1 minute";
    return isEs ? `en ${minutes} minutos` : `in ${minutes} minutes`;
  }
  if (delta < DAY) {
    const hours = Math.max(1, Math.round(delta / HOUR));
    if (hours === 1) return isEs ? "en 1 hora" : "in 1 hour";
    return isEs ? `en ${hours} horas` : `in ${hours} hours`;
  }

  const days = Math.round(delta / DAY);
  if (days === 1) return isEs ? "mañana" : "tomorrow";
  return isEs ? `en ${days} días` : `in ${days} days`;
}

/**
 * SAFE UPWARD ROUNDING for the completion screen.
 *
 * The screen must never imply a passage is available before its true
 * `nextReviewAt`, so every duration rounds UP. The exact persisted timestamp
 * stays the source of truth: nothing here mutates it, reschedules anything, or
 * writes a rounded value back.
 *
 *   under 24h -> up to the next 30-minute interval
 *     2h01m -> 2½h,  2h29m -> 2½h,  2h31m -> 3h,  11h31m -> 12h
 *   24h+      -> up to the next whole day
 *     24h exactly -> tomorrow,  24h01m -> 2 days,  2d2h -> 3 days
 *
 * Between 23h30m and 24h the half-hour path reaches 1440 minutes and reads
 * "in 24 hours" rather than "tomorrow" — at 00:10 a 23h45m wait still lands
 * today, so "tomorrow" would be a false promise. 24 hours is never early.
 */
export function roundUpRelative(
  remainingMs: number
): { kind: "minutes"; minutes: number } | { kind: "days"; days: number } {
  const safeMs = Math.max(0, remainingMs);

  if (safeMs >= DAY) {
    return { kind: "days", days: Math.max(1, Math.ceil(safeMs / DAY)) };
  }

  const HALF_HOUR = 30 * MINUTE;
  const slots = Math.max(1, Math.ceil(safeMs / HALF_HOUR));
  return { kind: "minutes", minutes: slots * 30 };
}

/**
 * The rounded duration as natural language. Half hours are written out —
 * never decimal notation such as "2.5 hours" or "2,5 horas".
 */
export function relativeReturnPhrase(remainingMs: number, lang: CopyLang): string {
  const isEs = lang === "es";
  const rounded = roundUpRelative(remainingMs);

  if (rounded.kind === "days") {
    if (rounded.days === 1) return isEs ? "mañana" : "tomorrow";
    return isEs ? `en ${rounded.days} días` : `in ${rounded.days} days`;
  }

  const { minutes } = rounded;
  if (minutes < 60) return isEs ? `en ${minutes} minutos` : `in ${minutes} minutes`;

  const hours = Math.floor(minutes / 60);
  const hasHalf = minutes % 60 !== 0;

  if (!hasHalf) {
    if (hours === 1) return isEs ? "en 1 hora" : "in 1 hour";
    return isEs ? `en ${hours} horas` : `in ${hours} hours`;
  }

  if (hours === 1) return isEs ? "en 1 hora y media" : "in 1½ hours";
  return isEs ? `en ${hours} horas y media` : `in ${hours}½ hours`;
}

/**
 * The timing line for a row that is ALREADY due. A due row must never carry
 * future-facing wording, so this is the only string that position can show.
 * The row applies `text-transform: uppercase`, rendering it as
 * "TIME TO TEND" / "ES HORA DE CUIDAR".
 */
export function dueNowLabel(lang: CopyLang): string {
  return lang === "es" ? "Es hora de cuidar" : "Time To Tend";
}

// ---------------------------------------------------------------------------
// Screen copy.
// ---------------------------------------------------------------------------

export const reviewCopy = {
  /** Section identity, Home module and Review header. */
  title: (lang: CopyLang) => (lang === "es" ? "Repaso" : "Review"),
  sessionLabel: (lang: CopyLang) => (lang === "es" ? "Repaso" : "Review"),

  /**
   * The persistent Review-mode status strip, shown throughout Step 5 and
   * Step 6. It exists because a small eyebrow proved too easy to miss: a review
   * must never be mistakable for the start of an ordinary Memorize session.
   *
   * The two halves are rendered as ONE continuous sentence — the label carries
   * Verdant emphasis, the rest stays neutral:
   *   "REVIEW MODE: Recall first, then the citation"
   *   "MODO REPASO: Primero recuerda el texto, luego la cita"
   */
  modeBannerLabel: (lang: CopyLang) => (lang === "es" ? "MODO REPASO" : "REVIEW MODE"),
  modeBannerHint: (lang: CopyLang) =>
    lang === "es"
      ? "Primero recuerda el texto, luego la cita"
      : "Recall first, then the citation",

  reviewNow: (lang: CopyLang) => (lang === "es" ? "Repasar ahora" : "Review now"),
  reviewNext: (lang: CopyLang) => (lang === "es" ? "Repasar siguiente" : "Review next"),
  backToReview: (lang: CopyLang) => (lang === "es" ? "Volver a Repaso" : "Back to Review"),
  /** Reveals the next group of five due rows. Never infinite scrolling. */
  showMore: (lang: CopyLang) => (lang === "es" ? "Mostrar 5 más" : "Show 5 more"),
  upcoming: (lang: CopyLang) => (lang === "es" ? "Próximos" : "Upcoming"),
  /**
   * The ONE practice action on every Upcoming card and on the caught-up card.
   * Rendered uppercase by its class: "PRACTICE NOW" / "PRACTICAR AHORA".
   * It replaced a pair of stacked actions that took more vertical room than the
   * passage they belonged to.
   */
  practiceNow: (lang: CopyLang) => (lang === "es" ? "Practicar ahora" : "Practice now"),

  /**
   * The Home Review card's tending phrase, with the numeral left out so the
   * card can give that numeral its own restrained Verdant emphasis beside these
   * words. Rendered in SENTENCE CASE, matching the Tip card's title role:
   *   "1 to tend" / "2 to tend"
   *   "1 que necesita tu cuidado" / "2 que necesitan tu cuidado"
   *
   * The Spanish phrasing is locked. It is NOT "para cuidar" and NOT "que
   * necesitan DE tu cuidado" — both read stiff in Colombia.
   */
  toTendPhrase: (count: number, lang: CopyLang) => {
    if (lang === "es") {
      return count === 1 ? "que necesita tu cuidado" : "que necesitan tu cuidado";
    }
    return "to tend";
  },

  /**
   * Prefix naming the next scheduled passage. Still used by the Home caught-up
   * state, which keeps showing what comes next and when.
   */
  nextUpPrefix: (lang: CopyLang) => (lang === "es" ? "Siguiente:" : "Next:"),

  /**
   * The restrained remaining-count line inside the Home Review card, shown when
   * more passages are due than the two previewed. Informational only — it is
   * never its own control, because the card is the one interactive element.
   * Sentence case: "+1 more" / "+3 más".
   */
  moreCount: (count: number, lang: CopyLang) =>
    lang === "es" ? `+${count} más` : `+${count} more`,

  /**
   * The WORDS of the compact Review-header due count, with the numeral left out
   * so the screen can style it on its own (Royal Soft, slightly larger,
   * Fraunces) beside these Hanken tracked-label words. Rendered uppercase by
   * the header, giving "1 PASSAGE DUE" / "3 PASSAGES DUE" and
   * "1 PASAJE POR REPASAR" / "3 PASAJES POR REPASAR".
   */
  dueCountWords: (count: number, lang: CopyLang) => {
    if (lang === "es") {
      return count === 1 ? "pasaje por repasar" : "pasajes por repasar";
    }
    return count === 1 ? "passage due" : "passages due";
  },

  stillDue: (count: number, lang: CopyLang) => {
    if (lang === "es") {
      return count === 0
        ? "No queda ningún pasaje por repasar"
        : count === 1
          ? "Queda 1 pasaje por repasar"
          : `Quedan ${count} pasajes por repasar`;
    }
    return count === 0
      ? "No passages left due"
      : count === 1
        ? "1 passage still due"
        : `${count} passages still due`;
  },

  /**
   * Completion-card eyebrow when another passage is ready RIGHT NOW. Rendered
   * uppercase by the eyebrow class: "UP NEXT" / "SIGUE".
   */
  upNextEyebrow: (lang: CopyLang) => (lang === "es" ? "Sigue" : "Up next"),

  nextUpAt: (label: string, lang: CopyLang) =>
    lang === "es" ? `El siguiente ${label}` : `Next one ${label}`,

  /**
   * THE ACTIVE PASS LANGUAGE — the compact pill beside the passage reference
   * or the Citation heading. It names the language currently ON SCREEN, not the
   * passage's overall scope, so it never reads "bilingual": the queue already
   * says the whole review is bilingual, and a bilingual review shows one
   * language at a time. Rendered uppercase by the pill class:
   *   "ENGLISH" / "SPANISH"   ·   "INGLÉS" / "ESPAÑOL"
   */
  activePassLabel: (which: MemorizeLanguage, lang: CopyLang) => {
    const isEs = lang === "es";
    if (which === "en") return isEs ? "Inglés" : "English";
    return isEs ? "Español" : "Spanish";
  },

  /**
   * The queue row's SAVED REVIEW SCOPE, stated plainly in words so colour is
   * never the only indicator. This is what the passage's due review requires —
   * not what the interface language happens to be, and distinct from the
   * active-pass pill above.
   */
  scopeLabel: (scope: ReviewScope, lang: CopyLang) => {
    const isEs = lang === "es";
    if (scope === "bilingual") return isEs ? "Repaso bilingüe" : "Bilingual review";
    if (scope === "spanish") return isEs ? "Repaso en español" : "Spanish review";
    return isEs ? "Repaso en inglés" : "English review";
  },

  // ---- The ONE bilingual practice choice ----------------------------------
  /**
   * There is a single bilingual choice flow. Every entry point — a due card, a
   * `Review next`, an Upcoming `Practice now`, the caught-up `Practice now` —
   * opens this same modal with this same wording. There is no separate
   * single-language action anywhere in the Review screen.
   *
   * Option order is fixed: English only, Spanish only, both, cancel. The two
   * "only" options run SUBSET practice, which can never satisfy the bilingual
   * due review; "both" runs the ordinary qualifying path for a due passage, or
   * ordinary full bilingual early practice for one that is not yet due.
   *
   * The Spanish wording here is locked to the Colombian phrasing Giovanni
   * approved and must not be generalized into more formal Spanish.
   */
  chooseHowToPractice: (lang: CopyLang) =>
    lang === "es" ? "Escoge cómo practicar" : "Choose how to practice",
  practiceChoiceBody: (lang: CopyLang) =>
    lang === "es"
      ? "Te aprendiste este versículo en ambos idiomas"
      : "You learned this passage in English & Spanish",
  practiceEnglishOnly: (lang: CopyLang) =>
    lang === "es" ? "Solo en inglés" : "English only",
  practiceSpanishOnly: (lang: CopyLang) =>
    lang === "es" ? "Solo en español" : "Spanish only",
  practiceBoth: (lang: CopyLang) =>
    lang === "es" ? "Practicar ambos idiomas" : "Practice both",
  cancel: (lang: CopyLang) => (lang === "es" ? "Cancelar" : "Cancel"),

  // ---- Practice completion (never a due review) ---------------------------
  practiceCompleteTitle: (lang: CopyLang) =>
    lang === "es" ? "Práctica completa" : "Practice complete",
  practicedInLanguage: (which: MemorizeLanguage, lang: CopyLang) => {
    const isEs = lang === "es";
    if (which === "en") return isEs ? "Practicaste en inglés" : "You practiced in English";
    return isEs ? "Practicaste en español" : "You practiced in Spanish";
  },
  bilingualStillWaiting: (lang: CopyLang) =>
    lang === "es"
      ? "El repaso bilingüe sigue pendiente"
      : "The bilingual review is still waiting",
  completeBilingualReview: (lang: CopyLang) =>
    lang === "es" ? "Completar el repaso bilingüe" : "Complete bilingual review",

  // ---- Empty states -------------------------------------------------------
  emptyNoPassagesTitle: (lang: CopyLang) =>
    lang === "es"
      ? "Tu jardín de repaso empieza después de tu primer pasaje."
      : "Your review garden begins after your first passage.",
  emptyNoPassagesAction: (lang: CopyLang) =>
    lang === "es" ? "Buscar un pasaje" : "Find a passage",

  caughtUpTitle: (lang: CopyLang) => (lang === "es" ? "Estás al día" : "You’re caught up"),
  // Middle dot, no comma, and no trailing period — the same metadata rhythm the
  // Upcoming rows use.
  caughtUpBody: (reference: string, when: string, lang: CopyLang) =>
    lang === "es"
      ? `El siguiente es ${reference} · ${when}`
      : `Next up is ${reference} · ${when}`,

  // ---- Completion screen --------------------------------------------------
  completionTitle: (lang: CopyLang) => (lang === "es" ? "Repaso hecho" : "Review complete"),

  /**
   * Two centred lines, no terminal periods, never punitive. Rendered as
   * separate blocks — never joined into a run-on paragraph.
   *
   * `This passage keeps taking root` is OUTCOME copy, not a mastery label:
   * standalone level names ("New seed", "Flourishing", …) were removed from
   * the completion screen entirely, while `reviewLevel` stays persisted.
   */
  completionOutcomeLines: (outcome: string, lang: CopyLang): { line1: string; line2: string } => {
    const isEs = lang === "es";

    if (outcome === "clean_success") {
      return isEs
        ? { line1: "Eso salió muy bien", line2: "Este pasaje sigue echando raíces" }
        : { line1: "That came out clean", line2: "This passage keeps taking root" };
    }

    if (
      outcome === "recall_exhausted" ||
      outcome === "citation_exhausted" ||
      outcome === "both_exhausted"
    ) {
      // Warm and forward-looking. It never exposes corrective scheduling and
      // never implies the user performed badly.
      return isEs
        ? { line1: "El texto todavía se está asentando", line2: "Nos volvemos a ver pronto" }
        : { line1: "The text is still settling", line2: "See you again soon" };
    }

    // recovered_success, and the neutral fallback.
    return isEs
      ? { line1: "Seguiste adelante", line2: "Este pasaje sigue echando raíces" }
      : { line1: "You stayed with it", line2: "This passage keeps taking root" };
  },

  /**
   * When the user is caught up, the completion card says when the passage they
   * just finished will come back — as a safely rounded relative duration, never
   * an exact date or clock time.
   */
  completionReturnLabel: (dueMs: number, nowMs: number, lang: CopyLang) => {
    const phrase = relativeReturnPhrase(dueMs - nowMs, lang);
    return lang === "es" ? `Este pasaje vuelve ${phrase}` : `This passage returns ${phrase}`;
  },

  /**
   * Step 5 -> Step 6 handoff inside a Review session whose Recall stage ran out
   * of attempts. A review acquires nothing, so the Citation Step still runs and
   * the copy must stay honest rather than claiming the text is complete.
   */
  recallStillSettlingHandoff: (lang: CopyLang) =>
    lang === "es"
      ? "El texto todavía se está asentando. Falta un paso: la cita bíblica."
      : "The text is still settling. One more step: the citation.",

  // ---- Accessible names ---------------------------------------------------
  // The mastery clause is dropped entirely when there is no label for the
  // level, rather than announcing an empty phrase.
  reviewRowLabel: (
    reference: string,
    reason: string,
    mastery: string | null,
    lang: CopyLang
  ) => {
    const masteryClause = mastery ? ` ${mastery}.` : "";
    return lang === "es"
      ? `Repasar ${reference}. ${reason}.${masteryClause}`
      : `Review ${reference}. ${reason}.${masteryClause}`;
  },
  practiceRowLabel: (reference: string, when: string, lang: CopyLang) =>
    lang === "es"
      ? `Practicar ${reference} de una vez. Programado ${when}.`
      : `Practice ${reference} anyway. Scheduled ${when}.`,
  openReviewLabel: (lang: CopyLang) =>
    lang === "es" ? "Abrir la pantalla de repaso" : "Open the review screen",
};
