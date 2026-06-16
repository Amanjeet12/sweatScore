import { View, Image } from 'react-native';

import { cn } from '@/utils/cn';

export const FullLogo = ({ className }: { className?: string }) => {
  return (
    <View className="flex items-center">
      <Image
        source={require('~/assets/logos/full-new.png')}
        resizeMode="contain"
        className={cn('w-64', className)}
      />
    </View>
  );
};

export const FullLogoWhite = ({ className }: { className?: string }) => {
  return (
    <View className="flex items-center">
      <Image
        source={require('~/assets/logos/full-white.png')}
        resizeMode="contain"
        className={cn('w-64', className)}
      />
    </View>
  );
};

export const IconLogo = ({ className }: { className?: string }) => {
  return (
    <View>
      <Image
        source={require('~/assets/logos/circle.png')}
        resizeMode="contain"
        style={{ width: 36, height: 36 }}
        className={cn(className)}
      />
    </View>
  );
};
