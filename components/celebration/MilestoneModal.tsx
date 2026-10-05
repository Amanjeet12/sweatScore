import { Trophy } from 'phosphor-react-native';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { PrototypeButton } from '~/components/core/auth/PrototypeOnboarding';
import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';

export type MilestoneData =
  | { type: 'weekly_target'; current: number; target: number; key?: string }
  | { type: 'first_check_in'; key?: string };

export function MilestoneModal({
  milestone,
  onDismiss,
}: {
  milestone: MilestoneData | null;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!milestone) return null;

  const weekly = milestone.type === 'weekly_target';

  if (weekly) {
    return (
      <Modal transparent visible animationType="fade" onRequestClose={onDismiss}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: Math.max(24, insets.left, insets.right),
            paddingTop: Math.max(24, insets.top),
            paddingBottom: Math.max(24, insets.bottom),
          }}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View
            accessibilityViewIsModal
            style={{
              width: '100%',
              maxWidth: 420,
              borderRadius: 28,
              backgroundColor: '#fff',
              paddingHorizontal: 24,
              paddingTop: 32,
              paddingBottom: 24,
              alignItems: 'center',
            }}>
            <Svg width={72} height={72} viewBox="0 0 24 24" accessibilityElementsHidden>
              <Path
                fill="#ff5a1f"
                d="M12 2.5c1 3.6 5.5 5.6 5.5 10.6a5.5 5.5 0 0 1-11 0c0-2.2 1-3.8 2.2-4.9.1 1.6 1 2.7 2.1 2.7C10.6 8.6 10.8 5.6 12 2.5z"
              />
            </Svg>
            <Text style={[type.celebrationHeading, { marginTop: 22 }]}>Weekly goal reached!</Text>
            <Text style={[type.button, { color: '#e8541e', lineHeight: 24, marginTop: 8 }]}>
              {milestone.current}/{milestone.target} days this week
            </Text>
            <Text style={[type.body, { textAlign: 'center', marginTop: 14 }]}>
              You showed up for yourself this week.
            </Text>
            <Text style={[type.body, { textAlign: 'center', marginTop: 2 }]}>
              Keep that momentum going.
            </Text>
            <PrototypeButton
              label="Nice!"
              onPress={onDismiss}
              style={{ alignSelf: 'stretch', marginTop: 26 }}
            />
          </View>
        </ScrollView>
      </Modal>
    );
  }
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Trophy size={30} color="#FF5C1A" weight="duotone" />
          </View>
          <Text style={styles.title}>First Check-In!</Text>
          <Text style={styles.body}>
            You did it — your first SweatScore check-in is officially in.{`\n\n`}Keep showing up.
          </Text>
          <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.button}>
            <Text style={styles.buttonText}>Let's Go</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(20, 14, 10, 0.35)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderRadius: 28,
    backgroundColor: '#FFF9F5',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  iconCircle: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
    backgroundColor: '#FFE8DC',
  },
  title: {
    marginTop: 16,
    color: '#1A1A1A',
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    textAlign: 'center',
  },
  progress: { marginTop: 10, color: '#FF5C1A', fontFamily: 'Inter_700Bold', fontSize: 16 },
  body: {
    marginTop: 12,
    color: '#55504D',
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    marginTop: 24,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#FF5C1A',
    paddingVertical: 14,
  },
  buttonText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 16 },
});
