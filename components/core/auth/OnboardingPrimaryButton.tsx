import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, TouchableOpacity } from 'react-native';

import { Text } from '~/components/ui/text';

type OnboardingPrimaryButtonProps = {
  label: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
};

export function OnboardingPrimaryButton({
  label,
  onPress,
  isLoading = false,
  disabled = false,
  className,
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
        borderRadius: 17,
        paddingHorizontal: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        opacity: isDisabled ? 0.72 : 1,
        shadowColor: '#FF5C1A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 14,
        elevation: 4,
      }}>
      {isLoading ? (
        <ActivityIndicator color="#FFFFFF" style={{ flex: 1 }} />
      ) : (
        <>
          <Text className="font-heading text-base font-bold text-white">{label}</Text>
          <Feather name="arrow-right" size={23} color="#FFFFFF" />
        </>
      )}
    </TouchableOpacity>
  );
}
