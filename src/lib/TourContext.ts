import { createContext, useContext, RefObject } from 'react';
import type { View } from 'react-native';

export type TourStep = {
  id: string;
  targetId: string;
  tab?: string;
  title: string;
  description: string;
  padding?: number;
};

export type TargetLayout = { x: number; y: number; width: number; height: number };

export const APP_TOUR_STEPS: TourStep[] = [
  {
    id: 'create-recording',
    targetId: 'tour-create-recording',
    tab: 'home',
    title: 'create a recording',
    description: 'Tap here to log an expense, income, savings, or any financial entry. This is the core of Ledgr.',
    padding: 8,
  },
  {
    id: 'create-folder',
    targetId: 'tour-create-folder',
    tab: 'home',
    title: 'create a folder',
    description: 'Organize your recordings into folders — like "Groceries", "Travel", or "Monthly Bills".',
    padding: 8,
  },
  {
    id: 'spaces-tab',
    targetId: 'tour-nav-spaces',
    tab: 'spaces',
    title: 'spaces',
    description: 'Your home base — track budgets, spending, and savings goals here.',
    padding: 10,
  },
  {
    id: 'new-space',
    targetId: 'tour-new-space',
    tab: 'spaces',
    title: 'create a space',
    description: 'Tap here to set up your first budget or savings tracker.',
    padding: 6,
  },
  {
    id: 'accounts-tab',
    targetId: 'tour-nav-accounts',
    tab: 'accounts',
    title: 'accounts',
    description: 'Save banks, e-wallets, and cards so you know where money moves.',
    padding: 10,
  },
  {
    id: 'dashboard-tab',
    targetId: 'tour-nav-dashboard',
    tab: 'dashboard',
    title: 'activities',
    description: 'Every income and expense shows up here — filter by date or type.',
    padding: 10,
  },
  {
    id: 'others-tab',
    targetId: 'tour-nav-others',
    tab: 'spaces',
    title: 'more tools',
    description: 'Receipts, bill splits, reminders, and contacts live under Others.',
    padding: 10,
  },
];

type TourContextValue = {
  register: (id: string, ref: RefObject<View | null>) => void;
  unregister: (id: string) => void;
};

export const TourContext = createContext<TourContextValue>({
  register: () => {},
  unregister: () => {},
});

export function useTourRegistry() {
  return useContext(TourContext);
}
