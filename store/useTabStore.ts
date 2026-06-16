import { create } from 'zustand';

import { ALL_TABS } from '~/utils/types';

interface SearchState {
  currentTab: ALL_TABS;
  setCurrentTab: (tab: ALL_TABS) => void;
}

const useTabStore = create<SearchState>((set, get) => ({
  currentTab: ALL_TABS.DASHBOARD,
  setCurrentTab: (tab) => set({ currentTab: tab }),
}));

export { useTabStore };
