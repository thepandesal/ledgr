import { createContext, useContext } from 'react';

// Module-level variable — survives React remounts caused by dismissAll()
let _pendingTab: string | null = null;
export function setPendingTabGlobal(key: string | null) { _pendingTab = key; }
export function consumePendingTabGlobal(): string | null {
  const val = _pendingTab;
  _pendingTab = null;
  return val;
}

interface NavContextType {
  activeTab: string;
  switchTab: (key: string) => void;
  handleNavPress: (key: string) => void;
  unreadCount: number;
  pendingTab: string | null;
  setPendingTab: (key: string | null) => void;
  // Space detail panel
  openSpace: (spaceId: string, name: string) => void;
  closeSpace: () => void;
  activeSpaceId: string | null;
  activeSpaceName: string | null;
  // Recording detail panel
  openRecording: (recordingId: string) => void;
  closeRecording: () => void;
  activeRecordingId: string | null;
}

export const NavContext = createContext<NavContextType>({
  activeTab: 'spaces',
  switchTab: () => {},
  handleNavPress: () => {},
  unreadCount: 0,
  pendingTab: null,
  setPendingTab: () => {},
  openSpace: () => {},
  closeSpace: () => {},
  activeSpaceId: null,
  activeSpaceName: null,
  openRecording: () => {},
  closeRecording: () => {},
  activeRecordingId: null,
});

export const useNav = () => useContext(NavContext);
