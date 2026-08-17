import * as Haptics from 'expo-haptics';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { ConfettiBurst } from '~/components/celebration/ConfettiBurst';
import { MilestoneData, MilestoneModal } from '~/components/celebration/MilestoneModal';

interface CompletionCelebration {
  type: 'check_in';
  pointsEarned: number;
}

interface CelebrationContextValue {
  celebrateCompletion: (completion: CompletionCelebration) => void;
  showMilestone: (milestone: MilestoneData) => void;
}

const CelebrationContext = createContext<CelebrationContextValue | undefined>(undefined);
const MILESTONE_DELAY_MS = 700;

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [confettiKey, setConfettiKey] = useState<number | null>(null);
  const [activeMilestone, setActiveMilestone] = useState<MilestoneData | null>(null);
  const milestoneQueue = useRef<MilestoneData[]>([]);
  const milestoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeMilestoneRef = useRef<MilestoneData | null>(null);

  const presentNextMilestone = useCallback(() => {
    if (activeMilestoneRef.current || milestoneTimer.current || milestoneQueue.current.length === 0)
      return;
    milestoneTimer.current = setTimeout(() => {
      milestoneTimer.current = null;
      const next = milestoneQueue.current.shift() ?? null;
      activeMilestoneRef.current = next;
      setActiveMilestone(next);
      if (next) setConfettiKey(Date.now());
    }, MILESTONE_DELAY_MS);
  }, []);

  useEffect(() => {
    presentNextMilestone();
  }, [presentNextMilestone]);

  useEffect(
    () => () => {
      if (milestoneTimer.current) clearTimeout(milestoneTimer.current);
    },
    []
  );

  const celebrateCompletion = useCallback((_completion: CompletionCelebration) => {
    setConfettiKey(Date.now());
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, []);

  const showMilestone = useCallback(
    (milestone: MilestoneData) => {
      milestoneQueue.current.push(milestone);
      presentNextMilestone();
    },
    [presentNextMilestone]
  );

  const dismissMilestone = useCallback(() => {
    activeMilestoneRef.current = null;
    setActiveMilestone(null);
    presentNextMilestone();
  }, [presentNextMilestone]);

  const contextValue = useMemo(
    () => ({ celebrateCompletion, showMilestone }),
    [celebrateCompletion, showMilestone]
  );

  return (
    <CelebrationContext.Provider value={contextValue}>
      <View style={styles.root}>
        {children}
        {confettiKey !== null ? (
          <ConfettiBurst key={confettiKey} onComplete={() => setConfettiKey(null)} />
        ) : null}
        <MilestoneModal milestone={activeMilestone} onDismiss={dismissMilestone} />
      </View>
    </CelebrationContext.Provider>
  );
}

export function useCelebration() {
  const context = useContext(CelebrationContext);
  if (!context) throw new Error('useCelebration must be used within CelebrationProvider');
  return context;
}

const styles = StyleSheet.create({ root: { flex: 1 } });
