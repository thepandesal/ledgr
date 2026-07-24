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
  openSpace: (spaceId: string, name: string, edit?: boolean) => void;
  closeSpace: () => void;
  activeSpaceId: string | null;
  activeSpaceName: string | null;
  // Recording detail panel
  openRecording: (recordingId: string) => void;
  closeRecording: () => void;
  activeRecordingId: string | null;
  // Split bill detail panel
  openSplitBill: (splitBillId: string, name: string) => void;
  closeSplitBill: () => void;
  activeSplitBillId: string | null;
  activeSplitBillName: string | null;
  // Top Spending panel
  openTopSpending: () => void;
  closeTopSpending: () => void;
  // Recordings panel
  openRecordingsPanel: (opts?: { categoryId?: string; categoryName?: string; spaceId?: string; spaceName?: string }) => void;
  closeRecordingsPanel: () => void;
  // Spaces panel
  openSpacesPanel: () => void;
  closeSpacesPanel: () => void;
  // Loans panel
  openLoansPanel: () => void;
  closeLoansPanel: () => void;
  // Receivables panel
  openReceivablesPanel: (person?: string) => void;
  closeReceivablesPanel: () => void;
  // Reminders panel
  openRemindersPanel: () => void;
  closeRemindersPanel: () => void;
  // Contacts panel
  openContactsPanel: () => void;
  closeContactsPanel: () => void;
  // Friends panel
  openFriendsPanel: () => void;
  closeFriendsPanel: () => void;
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
  openSplitBill: () => {},
  closeSplitBill: () => {},
  activeSplitBillId: null,
  activeSplitBillName: null,
  openTopSpending: () => {},
  closeTopSpending: () => {},
  openRecordingsPanel: () => {},
  closeRecordingsPanel: () => {},
  openSpacesPanel: () => {},
  closeSpacesPanel: () => {},
  openLoansPanel: () => {},
  closeLoansPanel: () => {},
  openReceivablesPanel: () => {},
  closeReceivablesPanel: () => {},
  openRemindersPanel: () => {},
  closeRemindersPanel: () => {},
  openContactsPanel: () => {},
  closeContactsPanel: () => {},
  openFriendsPanel: () => {},
  closeFriendsPanel: () => {},
});

export const useNav = () => useContext(NavContext);
