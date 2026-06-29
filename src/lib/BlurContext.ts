import { createContext } from 'react';

export const BlurContext = createContext<{
  setBlur: (v: boolean) => void;
  registerAdd: (tab: string, fn: () => void) => void;
  unregisterAdd: (tab: string) => void;
  activeTab: string;
}>({
  setBlur: () => {},
  registerAdd: () => {},
  unregisterAdd: () => {},
  activeTab: 'spaces',
});
