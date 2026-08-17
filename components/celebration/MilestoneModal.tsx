import { Trophy } from 'phosphor-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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
  if (!milestone) return null;

  const weekly = milestone.type === 'weekly_target';

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Trophy size={30} color="#FF5C1A" weight="duotone" />
          </View>
          <Text style={styles.title}>{weekly ? 'Weekly Goal Reached!' : 'First Check-In!'}</Text>
          {weekly ? (
            <>
              <Text style={styles.progress}>
                {milestone.current}/{milestone.target} days this week
              </Text>
              <Text style={styles.body}>
                You showed up for yourself this week.{`\n`}Keep that momentum going.
              </Text>
            </>
          ) : (
            <Text style={styles.body}>
              You did it — your first SweatScore check-in is officially in.{`\n\n`}Keep showing up.
            </Text>
          )}
          <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.button}>
            <Text style={styles.buttonText}>{weekly ? 'Nice!' : "Let's Go"}</Text>
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
    fontFamily: 'Montserrat_700Bold',
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
