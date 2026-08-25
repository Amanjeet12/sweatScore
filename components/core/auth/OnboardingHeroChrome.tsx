import { Feather } from '@expo/vector-icons';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type OnboardingHeroChromeProps = {
  activeStep: number;
  onBack: () => void;
  totalSteps?: number;
};

export function OnboardingHeroChrome({
  activeStep,
  onBack,
  totalSteps = 6,
}: OnboardingHeroChromeProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        left: 0,
        zIndex: 10,
      }}>
      <TouchableOpacity
        accessibilityLabel="Go back"
        accessibilityRole="button"
        activeOpacity={0.8}
        hitSlop={8}
        onPress={onBack}
        style={{
          position: 'absolute',
          top: insets.top + 16,
          left: 20,
          width: 48,
          height: 48,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(61,35,20,0.22)',
        }}>
        <Feather name="arrow-left" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <View
        accessibilityLabel={`Onboarding step ${activeStep} of ${totalSteps}`}
        style={{
          position: 'absolute',
          top: insets.top + 39,
          right: 24,
          flexDirection: 'row',
          gap: 5,
        }}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <View
            key={index}
            style={{
              width: 22,
              height: 3,
              borderRadius: 2,
              backgroundColor: index < activeStep ? '#FFFFFF' : 'rgba(255,255,255,0.48)',
            }}
          />
        ))}
      </View>
    </View>
  );
}
