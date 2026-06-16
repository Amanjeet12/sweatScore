import { View, Text } from 'react-native';

import { cn } from '~/utils/cn';

export const ErrorMessage = ({
  error,
  className,
  type = 'error',
}: {
  error: string | null;
  className?: string;
  type?: 'error' | 'success';
}) => {
  return (
    <View>
      {error ? (
        <View className={cn(className)}>
          <Text
            className={cn('font-ls text-center', {
              'text-green-500': type === 'success',
              'text-red-500': type === 'error',
            })}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
};
