import { create } from 'zustand';

interface RefreshState {
  refreshKey: number;
  incrementRefreshKey: () => void;
}

const useRefreshStore = create<RefreshState>((set, get) => ({
  refreshKey: 0,
  incrementRefreshKey: () => set((state) => ({ refreshKey: state.refreshKey + 1 })),
}));

export { useRefreshStore };
