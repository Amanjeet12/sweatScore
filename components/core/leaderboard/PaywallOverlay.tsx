import { LockSimple } from 'phosphor-react-native';
import { View } from 'react-native';
import { Text } from '~/components/ui/text';

export default function PaywallOverlay() {
  return (
    <View className="min-h-[180px] items-center justify-center rounded-2xl bg-white px-6 py-7">
      <LockSimple color="#FF5C35" size={26} />
      <Text className="mt-3 text-center font-heading text-lg font-semibold">
        League access unavailable
      </Text>
      <Text className="mt-2 text-center text-sm text-[#77716D]">
        Your Premium access must be verified to see the leaderboard.
      </Text>
    </View>
  );
}
