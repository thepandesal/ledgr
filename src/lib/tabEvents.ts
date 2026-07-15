type TabEventListener = (tab: string) => void;
let listener: TabEventListener | null = null;
let pendingTab: string | null = null;

export const tabEvents = {
  setListener: (fn: TabEventListener) => {
    listener = fn;
    // If there's a pending intent that arrived before listener was ready, fire it now
    if (pendingTab) {
      const t = pendingTab;
      pendingTab = null;
      fn(t);
    }
  },
  clearListener: () => { listener = null; },
  emit: (tab: string) => {
    if (listener) {
      listener(tab);
    } else {
      pendingTab = tab;
    }
  },
};
