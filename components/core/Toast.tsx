import { WarningCircle, CheckCircle } from 'phosphor-react-native';
import { View } from 'react-native';

import { Text } from '../ui/text';
import { Toast, ToastDescription } from '../ui/toast';

import { colors } from '~/utils/constants';

interface ToastProps {
  message: string;
  action: 'error' | 'success';
}

export const ToastMessage = ({ message, action }: ToastProps) => {
  return (
    <Toast action={action} variant="outline">
      <ToastDescription className="text-center font-semibold">
        <View className="flex-row items-center gap-x-2">
          <View>
            {action === 'error' ? (
              <WarningCircle size={24} color={colors.error} weight="duotone" />
            ) : (
              <CheckCircle size={24} color={colors.success} weight="duotone" />
            )}
          </View>
          <View>
            <Text className="text-center font-semibold">{message}</Text>
          </View>
        </View>
      </ToastDescription>
    </Toast>
  );
};
