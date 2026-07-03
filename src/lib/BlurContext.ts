import { createContext } from 'react';

export const BlurContext = createContext<{
  setBlur: (v: boolean) => void;
  registerAdd: (tab: string, fn: () => void) => void;
  unregisterAdd: (tab: string) => void;
  activeTab: string;
  __hasProvider?: boolean;
}>({
  setBlur: () => {},
  registerAdd: () => {},
  unregisterAdd: () => {},
  activeTab: 'spaces',
  __hasProvider: false,
});
