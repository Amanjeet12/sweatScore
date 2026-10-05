import { ArrowLeft, X } from 'phosphor-react-native';
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';

/** Prototype's 36px sheet control inside a platform-friendly 44px touch target. */
export function PrototypeSheetControl({
  kind,
  label,
  onPress,
  disabled = false,
  hidden = false,
  style,
}: {
  kind: 'back' | 'close';
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  hidden?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: hidden ? 0 : disabled ? 0.65 : 1,
        },
        style,
      ]}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: kind === 'close' ? '#f5f5f5' : 'transparent',
        }}>
        {kind === 'close' ? (
          <X size={16} color="#2a2a2a" />
        ) : (
          <ArrowLeft size={20} color="#2a2a2a" />
        )}
      </View>
    </TouchableOpacity>
  );
}
