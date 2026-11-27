// The restaurant this device works for, shared by the kitchen, waiter and owner screens so they stay on the same one.
const CHOICE_KEY = "sora-kitchen-restaurant";

// Storage can be blocked (private mode); the screens then fall back to asking or to the first restaurant.
export function readChoice(): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(CHOICE_KEY);
  } catch {
    return null;
  }
}

export function saveChoice(id: string | null) {
  try {
    if (id) localStorage.setItem(CHOICE_KEY, id);
    else localStorage.removeItem(CHOICE_KEY);
  } catch {
    // not remembered; harmless
  }
}
