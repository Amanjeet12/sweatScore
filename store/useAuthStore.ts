import Purchases from 'react-native-purchases';
import { create } from 'zustand';

import { Doc } from '~/convex/_generated/dataModel';

export type UserWithImageUrl = Omit<Doc<'users'>, 'image'> & {
  image: string | null;
};

interface AuthState {
  currentUser: UserWithImageUrl | null;
  setCurrentUser: (user: UserWithImageUrl | null) => void;
  setCurrentUserImage: (image: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  setCurrentUser: async (user) => {
    set({ currentUser: user });
    if (user?._id) {
      await Purchases.logIn(user?._id);
    }
  },
  setCurrentUserImage: (image) => {
    const user = get().currentUser;
    if (!user) return;

    set({ currentUser: { ...user, image } });
  },
}));
