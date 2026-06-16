import { Linking, Platform, TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';
import { useAppVersionStatus } from '~/hooks/useAppVersionStatus';
import { useTabStore } from '~/store/useTabStore';
import { ALL_TABS } from '~/utils/types';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 80 : 70;

export default function UpdateAvailableBanner() {
  const { status, storeUrl } = useAppVersionStatus();
  const currentTab = useTabStore((s) => s.currentTab);

  if (currentTab !== ALL_TABS.DASHBOARD) return null;
  if (status !== 'update_available' || !storeUrl) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: TAB_BAR_HEIGHT,
      }}>
      <View className="flex-row items-center justify-between bg-[#1A1A1A]/90 px-5 py-3">
        <Text
          className="flex-1 pr-3 font-heading text-sm font-bold text-white"
          numberOfLines={2}>
          New SweatScore{'\n'}update available
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => Linking.openURL(storeUrl)}
          className="rounded-full bg-primary-500 px-5 py-2">
          <Text className="font-body text-sm font-semibold text-white">Update</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
