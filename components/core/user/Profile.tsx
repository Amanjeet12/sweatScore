import { ScrollView, View } from 'react-native';

import UserActivities from './Activities';

import { Avatar } from '~/components/core/Avatar';
import { leagueTypography as type } from '~/components/core/design/LeagueStyles';
import { Text } from '~/components/ui/text';
import { UserWithImageUrl } from '~/store/useAuthStore';

export default function Profile({
  user,
  league = false,
}: {
  user: UserWithImageUrl;
  league?: boolean;
}) {
  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{
          flexGrow: 1,
        }}>
        <View
          className="flex-col"
          style={league ? { paddingTop: 16, paddingHorizontal: 22 } : undefined}>
          <View className="flex-col items-center gap-y-4">
            <View>
              <Avatar uri={user?.image ?? undefined} name={user?.name} />
            </View>
            <View className="flex-col items-center">
              <Text
                className={league ? undefined : 'text-[20px] font-bold'}
                style={league ? [type.heading, { textAlign: 'center' }] : undefined}>
                {user?.name}
              </Text>
            </View>
          </View>

          <View className="mt-4">
            <UserActivities userId={user._id} />
          </View>
        </View>
      </ScrollView>
    </>
  );
}
