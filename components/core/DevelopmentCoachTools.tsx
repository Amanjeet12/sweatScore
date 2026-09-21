import { useMutation } from 'convex/react';
import { useRef, useState } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';

import { CoachCard } from './CoachPresentation';

import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';

// Temporary development tooling. Loaded only through the entry screen's __DEV__ guard.
export default function DevelopmentCoachTools({ onReset }: { onReset: () => void }) {
  const reset = useMutation(api.progressCoach.resetProgressCoachTestData);
  const busy = useRef(false);
  const [pending, setPending] = useState<'today' | 'all' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const confirmReset = (scope: 'today' | 'all') => {
    if (busy.current) return;
    busy.current = true;
    setPending(scope);
    setMessage(null);
    let confirmed = false;
    const release = () => {
      busy.current = false;
      setPending(null);
    };
    Alert.alert(
      scope === 'today' ? 'Reset today’s focus?' : 'Delete all Coach test data?',
      scope === 'today'
        ? 'Today’s saved Coach focus will be deleted. Your Coach profile and other SweatScore data will remain. Generating another normal focus may make another Claude API request.'
        : 'Your Coach profile and all Coach daily plans for this account will be deleted. You will need to complete Coach setup again. All other SweatScore data will remain unchanged.',
      [
        { text: 'Cancel', style: 'cancel', onPress: release },
        {
          text: scope === 'today' ? 'Delete today’s focus' : 'Delete all Coach test data',
          style: 'destructive',
          onPress: () => {
            // Also guard a duplicated native confirmation callback synchronously.
            if (!busy.current || confirmed) return;
            confirmed = true;
            reset({ scope })
              .then(() => {
                onReset();
                Alert.alert(
                  'Coach reset complete',
                  scope === 'today'
                    ? 'Today’s focus was cleared. You can start a new daily check-in.'
                    : 'Your Coach test data was cleared. You can set up your profile again.'
                );
              })
              .catch(() => {
                setMessage(
                  'Could not confirm the reset. Check your Coach screen before trying again.'
                );
              })
              .finally(release);
          },
        },
      ],
      { cancelable: false }
    );
  };

  return (
    <View className="mt-8">
      <CoachCard title="Development testing" quiet>
        <Text className="font-body text-sm text-[#5A5551]">
          Temporary tools for testing Progress Coach scenarios. These controls are not included in
          production builds.
        </Text>
        <View className="mt-4 gap-y-3">
          {(['today', 'all'] as const).map((scope) => (
            <TouchableOpacity
              key={scope}
              accessibilityRole="button"
              accessibilityState={{ disabled: pending !== null }}
              disabled={pending !== null}
              onPress={() => confirmReset(scope)}
              className="min-h-14 items-center justify-center rounded-[20px] border border-[#E3E1DE] bg-white px-4 py-4"
              style={{ opacity: pending !== null ? 0.5 : 1 }}>
              <Text className="text-center font-heading text-sm font-semibold text-[#1A1A1A]">
                {pending === scope
                  ? 'Reset in progress…'
                  : scope === 'today'
                    ? 'Reset today’s focus'
                    : 'Reset all Coach test data'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {message ? (
          <Text accessibilityLiveRegion="polite" className="mt-3 font-body text-sm text-[#5A5551]">
            {message}
          </Text>
        ) : null}
      </CoachCard>
    </View>
  );
}
