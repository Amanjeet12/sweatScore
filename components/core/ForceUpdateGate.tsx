import { Linking, Modal, TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';
import { useAppVersionStatus } from '~/hooks/useAppVersionStatus';

export default function ForceUpdateGate() {
  const { status, storeUrl } = useAppVersionStatus();
  const visible = status === 'force_update';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}>
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View className="w-full rounded-3xl bg-white px-8 py-10">
          <Text
            className="text-center text-[#1A1A1A]"
            size="2xl"
            style={{ fontFamily: 'Inter_700Bold' }}>
            Time to update your{'\n'}SweatScore app
          </Text>
          <Text className="mt-6 text-center font-body text-base text-[#313131]">
            We&apos;ve made some big improvements. Please update to keep earning and moving with
            your Sweat Sisters.
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => storeUrl && Linking.openURL(storeUrl)}
            className="mt-8 items-center justify-center rounded-full bg-primary-500 px-6 py-4">
            <Text className="font-body text-lg font-semibold text-white">Update Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
