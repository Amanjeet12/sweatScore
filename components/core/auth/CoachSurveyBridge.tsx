import { Barbell, ForkKnife, TrendUp } from 'phosphor-react-native';
import { View } from 'react-native';

import {
  PrototypeButton,
  PrototypeOnboarding,
  onboardingStyles as styles,
} from '~/components/core/auth/PrototypeOnboarding';
import {
  prototypeComponents as chrome,
  prototypeTypography as type,
} from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { useAuthStore } from '~/store/useAuthStore';

export function CoachSurveyBridge({ onStart }: { onStart: () => void }) {
  const name = useAuthStore((state) => state.currentUser?.name?.trim());
  return (
    <PrototypeOnboarding
      image={require('~/assets/onboarding/coach-introduction.jpg')}
      footer={<PrototypeButton label="Start 2-Minute Survey" onPress={onStart} />}>
      <Text
        style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: '#e8541e' }}>
        Account Verified!
      </Text>
      <Text accessibilityRole="header" style={[styles.heading, { marginTop: 8 }]}>
        Let's personalise your AI Coach{name ? `, ${name}` : ''}
      </Text>
      <Text
        style={{
          marginTop: 14,
          ...type.loadingBody,
        }}>
        Answer 7 quick questions so your Coach can tailor your workouts, meals, and progress.
      </Text>
      <View style={{ marginTop: 28, gap: 18 }}>
        {[
          [Barbell, 'Personalised daily workouts'],
          [ForkKnife, 'Smarter meal tracking'],
          [TrendUp, 'Progress tracking'],
        ].map(([Icon, label]) => {
          const FeatureIcon = Icon as typeof Barbell;
          return (
            <View
              key={String(label)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View
                style={{
                  ...chrome.iconTile,
                }}>
                <FeatureIcon size={24} color="#e8541e" />
              </View>
              <Text
                style={{
                  flex: 1,
                  ...type.cardTitle,
                }}>
                {String(label)}
              </Text>
            </View>
          );
        })}
      </View>
    </PrototypeOnboarding>
  );
}
