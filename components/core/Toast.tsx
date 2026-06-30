import { CheckCircle, WarningCircle } from 'phosphor-react-native';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../ui/text';
import { Toast } from '../ui/toast';

import { colors } from '~/utils/constants';

interface ToastProps {
  message: string;
  action: 'error' | 'success' | 'warning';
}

export const ToastMessage = ({ message, action }: ToastProps) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isError = action === 'error';
  const isWarning = action === 'warning';

  const toastColors = {
    background: isError ? '#FEF2F2' : isWarning ? '#FFF7ED' : '#F0FDF4',
    iconBackground: isError ? '#FEE2E2' : isWarning ? '#FFEDD5' : '#DCFCE7',
    text: isError ? '#991B1B' : isWarning ? '#C2410C' : '#166534',
    icon: isError ? colors.error : isWarning ? '#F97316' : colors.success,
  };

  return (
    <Toast
      action={action}
      variant="solid"
      className="rounded-2xl border-0 px-4 py-3"
      style={{
        marginTop: insets.top + 10,
        width: width - 32,
        maxWidth: width - 32,
        alignSelf: 'center',
        backgroundColor: toastColors.background,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      }}>
      <View
        style={{
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            marginRight: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: toastColors.iconBackground,
          }}>
          {isError || isWarning ? (
            <WarningCircle size={22} color={toastColors.icon} weight="duotone" />
          ) : (
            <CheckCircle size={22} color={toastColors.icon} weight="duotone" />
          )}
        </View>

        <Text
          style={{
            flex: 1,
            flexShrink: 1,
            color: toastColors.text,
            fontSize: 14,
            lineHeight: 20,
            fontWeight: '600',
          }}>
          {message}
        </Text>
      </View>
    </Toast>
  );
};