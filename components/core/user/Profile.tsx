import { View } from 'react-native';

import UserActivities from './Activities';

import { Avatar } from '~/components/core/Avatar';
import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { UserWithImageUrl } from '~/store/useAuthStore';

export default function Profile({ user }: { user: UserWithImageUrl; league?: boolean }) {
  return (
    <UserActivities
      userId={user._id}
      header={
        <View style={{ paddingTop: 8, paddingBottom: 4, gap: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Avatar uri={user.image ?? undefined} name={user.name} size={64} />
            <Text style={[type.sectionHeading, { flex: 1, flexShrink: 1 }]}>{user.name}</Text>
          </View>
          <Text style={type.cardTitle}>Activity history</Text>
        </View>
      }
    />
  );
}
