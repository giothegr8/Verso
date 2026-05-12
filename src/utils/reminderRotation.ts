
import { AppState, ReminderRotationState } from "../types";
import { GROWTH_GOAL_REMINDERS, BLOCKER_REMINDERS, GENERIC_FALLBACK_REMINDERS } from "../data/reminderCopy";

const shuffle = (array: number[]) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const createInitialRotation = (): ReminderRotationState => {
  const indices = Array.from({ length: 15 }, (_, i) => i);
  return {
    lastType: 'blocker', // Start with goal if we alternate
    goalIndices: shuffle(indices),
    blockerIndices: shuffle(indices),
    goalPointer: 0,
    blockerPointer: 0,
  };
};

export const rotateReminder = (state: AppState): AppState => {
  if (!state.onboardingProfile) return state;

  let rotation = state.reminderRotation || createInitialRotation();
  
  // Alternate type
  const nextType = rotation.lastType === 'goal' ? 'blocker' : 'goal';
  
  let { goalPointer, blockerPointer, goalIndices, blockerIndices } = rotation;
  const indices = Array.from({ length: 15 }, (_, i) => i);

  if (nextType === 'goal') {
    goalPointer++;
    if (goalPointer >= goalIndices.length) {
      goalPointer = 0;
      goalIndices = shuffle(indices);
    }
  } else {
    blockerPointer++;
    if (blockerPointer >= blockerIndices.length) {
      blockerPointer = 0;
      blockerIndices = shuffle(indices);
    }
  }

  return {
    ...state,
    reminderRotation: {
      lastType: nextType,
      goalIndices,
      blockerIndices,
      goalPointer,
      blockerPointer
    }
  };
};

export const getCurrentReminder = (state: AppState): string => {
  const lang = state.primaryLanguage || 'es';
  const profile = state.onboardingProfile;
  const rotation = state.reminderRotation;

  if (!profile || !rotation) {
    return GENERIC_FALLBACK_REMINDERS[lang][0];
  }

  const { lastType, goalIndices, blockerIndices, goalPointer, blockerPointer } = rotation;

  // 1. Try growth goal
  if (lastType === 'goal') {
    const goalLabel = profile.growthGoalLabel;
    if (goalLabel && GROWTH_GOAL_REMINDERS[goalLabel]) {
      const idx = goalIndices[goalPointer % goalIndices.length];
      const reminderSet = GROWTH_GOAL_REMINDERS[goalLabel];
      return reminderSet[lang][idx] || reminderSet[lang][0];
    }
    // Fallback to blocker if goal not found
    return getBlockerReminder(profile, rotation, lang);
  }

  // 2. Try blocker
  return getBlockerReminder(profile, rotation, lang);
};

const getBlockerReminder = (profile: any, rotation: ReminderRotationState, lang: 'en' | 'es'): string => {
  const blocker = profile.blocker;
  if (blocker && BLOCKER_REMINDERS[blocker]) {
    const idx = rotation.blockerIndices[rotation.blockerPointer % rotation.blockerIndices.length];
    const reminderSet = BLOCKER_REMINDERS[blocker];
    return reminderSet[lang][idx] || reminderSet[lang][0];
  }
  
  // Final fallback
  return GENERIC_FALLBACK_REMINDERS[lang][Math.floor(Math.random() * GENERIC_FALLBACK_REMINDERS[lang].length)];
};
