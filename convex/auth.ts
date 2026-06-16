import { convexAuth } from '@convex-dev/auth/server';

import { ResendOTP } from './ResendOTP';
import { TestOTP } from './TestOTP';

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [ResendOTP, TestOTP],
});
