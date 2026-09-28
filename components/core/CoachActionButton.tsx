import { TouchableOpacity } from 'react-native';

import { Text } from '~/components/ui/text';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
  className?: string;
};

/** Matches the 56px, 20px-radius, Inter semibold action on challenge detail. */
export default function CoachActionButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  className,
}: Props) {
  const primary = variant === 'primary';
  const destructive = variant === 'destructive';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      activeOpacity={0.82}
      disabled={disabled}
      onPress={onPress}
      className={className}
      style={{
        minHeight: 56,
        width: '100%',
        borderRadius: 20,
        borderWidth: primary ? 0 : 1,
        borderColor: destructive ? '#F4A7A7' : '#E3E1DE',
        backgroundColor: primary ? '#FF5C35' : '#FFFFFF',
        paddingHorizontal: 20,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.6 : 1,
      }}>
      <Text
        allowFontScaling
        style={{
          fontFamily: 'Inter_600SemiBold',
          fontSize: 18,
          lineHeight: 24,
          textAlign: 'center',
          color: primary ? '#FFFFFF' : destructive ? '#B4232C' : '#1A1A1A',
        }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
