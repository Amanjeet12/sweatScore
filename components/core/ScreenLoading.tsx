import { ActivityIndicator, View } from 'react-native';

import { cn } from '~/utils/cn';

const ScreenLoading = ({
  color = '#F58503',
  className,
}: {
  color?: string;
  className?: string;
}) => (
  <View className={cn('flex-1 justify-center rounded-lg bg-[#F9F9F9] p-4', className)}>
    <ActivityIndicator size="large" color={color} />
  </View>
);

export default ScreenLoading;
