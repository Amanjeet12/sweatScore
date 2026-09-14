import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, TouchableOpacity } from 'react-native';

import { Text } from '~/components/ui/text';

type OnboardingPrimaryButtonProps = {
  label: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  borderRadius?: number;
};

export function OnboardingPrimaryButton({
  label,
  onPress,
  isLoading = false,
  disabled = false,
  className,
  borderRadius = 12,
}: OnboardingPrimaryButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.8}
      onPress={onPress}
      disabled={isDisabled}
      className={className}
      style={{
        height: 56,
        backgroundColor: '#FF5C1A',
        borderRadius,
        paddingHorizontal: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        opacity: isDisabled ? 0.72 : 1,
      }}>
      {isLoading ? (
        <ActivityIndicator color="#FFFFFF" style={{ flex: 1 }} />
      ) : (
        <>
          <Text className="font-heading text-base font-semibold text-white">{label}</Text>
          <Feather name="arrow-right" size={23} color="#FFFFFF" />
        </>
      )}
    </TouchableOpacity>
  );
}
