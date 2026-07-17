import { router } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';

import { Avatar } from '~/components/core/Avatar';
import { Text } from '~/components/ui/text';
import { UserWithImageUrl } from '~/store/useAuthStore';
import { useTabStore } from '~/store/useTabStore';

export default function UserRow({ user }: { user: UserWithImageUrl }) {
  const currentTab = useTabStore((state) => state.currentTab);

  return (
    <TouchableOpacity
      onPress={() => {
        router.push({
          pathname: `/(tabs)/dashboard/settings/user/[userId]`,
          params: { userId: user._id },
        });
      }}>
      <View className="mb-4 flex-row items-center">
        <View className="mr-2">
          <Avatar uri={user.image ?? undefined} size={52} name={user?.name}/>
        </View>
        <View className="flex-1">
          <View className="z-50 ml-2 flex-col gap-y-2">
            <View className="z-50">
              <View className="flex-row gap-x-2">
                <View className="flex-1">
                  <Text className="text-[16px] font-bold">{user.name}</Text>
                </View>
              </View>
              <View className="flex-row gap-x-2">
                <View className="flex-row items-center gap-x-1">
                  <Text className="text-[14px] text-hint">{user.email}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
