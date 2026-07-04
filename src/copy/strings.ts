// ALL user-facing copy lives here. Nothing user-visible should be a hardcoded
// string in a component. A Vitest guard (copy.banned.test.ts) enforces both:
//   1. this module contains no banned punitive words, and
//   2. components don't smuggle hardcoded UI strings past this module.
//
// Banned words (calm / low-pressure product philosophy, T5):
//   fail, failure, wrong, should, bad, streak, overdue, error.
// The tone is: rhythm, return, win, exchange, frequency, align, grace.

export const strings = {
  app: {
    name: "VisionSense",
    tagline: "Frequency first. Action after.",
  },

  nav: {
    today: "Today",
    goals: "Goals",
    evidence: "Evidence",
    settings: "Settings",
  },

  today: {
    title: "Today",
    greeting: "Welcome back",
    selfTrustLabel: "Self-Trust",
    momentumLabel: "Momentum",
    selfTrustHint: "Built from every commitment you keep.",
    momentumHint: "Your compounding consistency. It only ever fades gently.",
    checkInPrompt: "How are you arriving today?",
    checkInCta: "Begin base-state check-in",
    checkInDoneToday: "You checked in today. Thank you for arriving.",
    innerHeading: "Inner work",
    outerHeading: "Outer action",
    innerHint: "Tend to your state first.",
    noHabitsTitle: "No habits here yet",
    noHabitsBody:
      "Add a habit under one of your Goals, and it will meet you here each day.",
    keptButton: "Keep",
    keptDone: "Kept",
    notTodayButton: "Not today",
    notTodayDone: "Resting today",
    keepAriaPrefix: "Mark kept:",
    notTodayAriaPrefix: "Set aside for today:",
    nudgesPreviewHeading: "Mental nudges",
    seeAll: "See all",
  },

  goals: {
    title: "Goals",
    subtitle: "Your desired realities, held as feelings.",
    empty: "Name the first reality you're settling into.",
    addButton: "New desired reality",
    feelingTagPrefix: "feeling: ",
    detailHabitsHeading: "Habits",
    detailInnerHeading: "Inner work",
    detailOuterHeading: "Outer action",
    detailNoHabits: "No habits yet. Add one that moves you toward this feeling.",
    addHabitButton: "Add habit",
    editButton: "Edit",
    archiveButton: "Archive",
    archiveConfirm:
      "Archive this desired reality? Its habits rest with it. Nothing is deleted.",
    archivedTag: "archived",
    exchangingForPrefix: "exchanging for: ",
    normalizeOnTag: "already normal",
    sourceActionPrefix: "be a source: ",
    backToGoals: "Back to goals",
    notFound: "That desired reality isn't here.",
  },

  desiredRealityForm: {
    createTitle: "New desired reality",
    editTitle: "Edit desired reality",
    titleLabel: "What reality are you settling into?",
    titlePlaceholder: "e.g. New role in design",
    targetFeelingLabel: "And the feeling it gives you",
    targetFeelingPlaceholder: "e.g. secure, seen, at ease",
    targetFeelingHint: "You want the feeling, not only the thing.",
    normalizeLabel: "Frame this as already normal, already mine",
    normalizeHint: "Ease the wanting. Let it be ordinary.",
    sourceActionLabel: "A way to be a source of this (optional)",
    sourceActionPlaceholder: "e.g. offer help freely; express gratitude",
    collectiveBeliefLabel: "A collective belief to release (optional)",
    collectiveBeliefPlaceholder: "e.g. 'good work is always scarce'",
    saveButton: "Save",
    cancelButton: "Cancel",
    titleRequired: "Give this reality a short name to continue.",
    feelingRequired: "Name the feeling to continue.",
  },

  habitForm: {
    createTitle: "New habit",
    editTitle: "Edit habit",
    nameLabel: "What is the habit?",
    namePlaceholder: "e.g. 20 minutes of stillness",
    tierLabel: "Which tier?",
    tierInner: "Inner (state / frequency work)",
    tierOuter: "Outer (physical action)",
    tierHint: "Inner work is always tended first.",
    actionTypeLabel: "Is this something to start or to stop?",
    actionStart: "Start doing",
    actionStop: "Stop doing",
    exchangingForLabel: "Exchanging this for",
    exchangingForPlaceholder: "e.g. calm evenings, steady focus",
    exchangingForHint: "You're not giving something up — you're trading it.",
    keystoneLabel: "Keystone habit",
    keystoneHint: "A grounding practice, like relaxation, that steadies the rest.",
    scheduleLabel: "How often?",
    scheduleDaily: "Every day",
    scheduleWeekly: "Certain days",
    scheduleOneOff: "Just once",
    daysOfWeekLabel: "Which days?",
    saveButton: "Save",
    cancelButton: "Cancel",
    nameRequired: "Name the habit to continue.",
  },

  checkIn: {
    title: "Base-state check-in",
    stepBaseStateQuestion: "What's your base emotional state today?",
    stepBaseStatePlaceholder: "e.g. anxious, at ease, restless, open",
    stepBaseStateHint: "Just name it honestly. Naming is the first shift.",
    stepNoteQuestion: "Anything you'd like to note alongside it?",
    stepNotePlaceholder: "Optional — a word or a sentence",
    next: "Next",
    back: "Back",
    finish: "Save check-in",
    savedTitle: "Noted. Thank you for arriving.",
    savedBody: "Awareness is how the shift begins.",
    done: "Return to Today",
    baseStateRequired: "Name your state to continue.",
  },

  reframe: {
    // The three C2 prompts, verbatim (docs/book-analysis.md C2 / p.22-23).
    title: "A moment to respond",
    intro:
      "Rhythm is natural — all things rise and fall. Your old frequency just tried to pull you back. Noticing it is how you move through it.",
    promptLookAt:
      "How would the version of you in your desired reality look at this?",
    promptFeelAbout:
      "How would the version of you in your desired reality feel about this?",
    promptThinkAbout:
      "How would the version of you in your desired reality think about this?",
    winsCta: "See your past wins",
    continue: "Return to Today",
  },

  evidence: {
    title: "Evidence",
    subtitle: "Every win you've gathered. This ledger only ever grows.",
    empty: "Your wins will collect here as you go.",
    comingSoon:
      "Your wins feed will fill in as you keep habits and complete exercises.",
    habitKeptPrefix: "Kept: ",
  },

  settings: {
    title: "Settings",
    schemaVersionLabel: "Data schema version",
    dataSectionTitle: "Your data",
    dataSectionBody:
      "Everything lives on this device only. Export a copy to keep it safe.",
    exportButton: "Export data (coming soon)",
    importButton: "Import data (coming soon)",
    clearButton: "Clear all data (coming soon)",
    relaxGateLabel: "Relax-first gate before deep exercises",
    languageLabel: "Language",
    languageBookVocabulary: "Book vocabulary",
    languageSecular: "Plain language (coming soon)",
  },

  common: {
    loading: "One moment…",
    save: "Save",
    cancel: "Cancel",
    yes: "Yes",
    no: "No",
  },
} as const;

export type Strings = typeof strings;
