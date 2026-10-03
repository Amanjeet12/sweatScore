import { useMutation, useQuery } from 'convex/react';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { usePathname } from 'expo-router';
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
import NotificationPermissionModal from '~/components/core/NotificationPermissionModal';
import { api } from '~/convex/_generated/api';

interface CompletionCelebration {
  type: 'check_in' | 'activity';
  pointsEarned: number;
}

interface CelebrationContextValue {
  celebrateCompletion: (completion: CompletionCelebration) => void;
  showMilestone: (milestone: MilestoneData) => void;
}

const CelebrationContext = createContext<CelebrationContextValue | undefined>(undefined);
const MILESTONE_DELAY_MS = 700;

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const member = useQuery(api.users.current, {});
  const [notificationMember, setNotificationMember] = useState<string | null>(null);
  const [dismissedNotificationMember, setDismissedNotificationMember] = useState<string | null>(
    null
  );
  const markActivity = useMutation(api.users.markNotificationActivityCompleted);
  const [confettiKey, setConfettiKey] = useState<number | null>(null);
  const [activeMilestone, setActiveMilestone] = useState<MilestoneData | null>(null);
  const milestoneQueue = useRef<MilestoneData[]>([]);
  const milestoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeMilestoneRef = useRef<MilestoneData | null>(null);
  const completionSoundRef = useRef<Audio.Sound | null>(null);

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
      completionSoundRef.current?.unloadAsync().catch(() => undefined);
    },
    []
  );

  const celebrateCompletion = useCallback(
    async (_completion: CompletionCelebration) => {
      markActivity({}).catch(() => undefined);
      setConfettiKey(Date.now());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

      try {
        if (completionSoundRef.current) {
          await completionSoundRef.current.unloadAsync();
        }

        const { sound } = await Audio.Sound.createAsync(require('../../assets/enjoy.mp3'), {
          shouldPlay: true,
          volume: 1,
        });
        completionSoundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            completionSoundRef.current = null;
            sound.unloadAsync().catch(() => undefined);
          }
        });
      } catch (error) {
        console.warn('Unable to play check-in celebration sound:', error);
      }
    },
    [markActivity]
  );

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

  useEffect(() => {
    if (
      pathname !== '/dashboard' ||
      dismissedNotificationMember === member?._id ||
      !member?.notificationActivityCompleted ||
      member.notificationPromptChoice ||
      member.notificationEnabled ||
      confettiKey !== null ||
      activeMilestone ||
      milestoneTimer.current
    )
      return;
    const timer = setTimeout(() => setNotificationMember(member._id), 700);
    return () => clearTimeout(timer);
  }, [pathname, member, confettiKey, activeMilestone, dismissedNotificationMember]);

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
        {notificationMember === member?._id &&
        pathname === '/dashboard' &&
        !activeMilestone &&
        confettiKey === null ? (
          <NotificationPermissionModal
            onClose={() => {
              setDismissedNotificationMember(notificationMember);
              setNotificationMember(null);
            }}
          />
        ) : null}
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
