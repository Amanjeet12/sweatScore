import { LockSimple } from 'phosphor-react-native';
import { View } from 'react-native';

import { leagueTypography as type } from '~/components/core/design/LeagueStyles';
import { Text } from '~/components/ui/text';

export default function PaywallOverlay() {
  return (
    <View className="min-h-[180px] items-center justify-center rounded-2xl bg-white px-6 py-7">
      <LockSimple color="#ff5a1f" size={26} />
      <Text className="mt-3" style={[type.name, { textAlign: 'center' }]}>
        League access unavailable
      </Text>
      <Text className="mt-2" style={[type.body, { textAlign: 'center' }]}>
        Your Premium access must be verified to see the leaderboard.
      </Text>
    </View>
  );
}
