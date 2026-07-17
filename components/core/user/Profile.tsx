import { ScrollView, View } from 'react-native';

import UserActivities from './Activities';

import { Avatar } from '~/components/core/Avatar';
import { Text } from '~/components/ui/text';
import { UserWithImageUrl } from '~/store/useAuthStore';

export default function Profile({ user }: { user: UserWithImageUrl }) {
  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{
          flexGrow: 1,
        }}>
        <View className="flex-col">
          <View className="flex-col items-center gap-y-4">
            <View>
              <Avatar uri={user?.image ?? undefined} name={user?.name}/>
            </View>
            <View className="flex-col items-center">
              <Text className="text-[20px] font-bold">{user?.name}</Text>
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
