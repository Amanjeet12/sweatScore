import { create } from 'zustand';

import { Doc } from '~/convex/_generated/dataModel';

export type UserWithImageUrl = Omit<Doc<'users'>, 'image'> & {
  image: string | null;
};

interface AuthState {
  currentUser: UserWithImageUrl | null;
  sessionVersion: number;
  sessionRedirect: boolean;
  finishSessionRedirect: () => void;
  resetSession: () => void;
  setCurrentUser: (user: UserWithImageUrl | null) => void;
  setCurrentUserImage: (image: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  sessionVersion: 0,
  sessionRedirect: false,
  finishSessionRedirect: () => set({ sessionRedirect: false }),
  resetSession: () =>
    set((state) => ({
      currentUser: null,
      sessionVersion: state.sessionVersion + 1,
      sessionRedirect: true,
    })),
  setCurrentUser: (user) => {
    set({ currentUser: user });
  },
  setCurrentUserImage: (image) => {
    const user = get().currentUser;
    if (!user) return;

    set({ currentUser: { ...user, image } });
  },
}));
