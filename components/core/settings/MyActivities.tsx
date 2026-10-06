import { ReactElement } from 'react';

import UserActivities from '~/components/core/user/Activities';
import { useAuthStore } from '~/store/useAuthStore';

export default function MyActivities({ header }: { header?: ReactElement }) {
  const currentUser = useAuthStore((state) => state.currentUser);
  if (!currentUser) return null;
  return <UserActivities userId={currentUser._id} header={header} />;
}
