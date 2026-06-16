import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Check, X } from 'phosphor-react-native';
import { TouchableOpacity, View } from 'react-native';

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '~/components/ui/text';

interface StreakInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  streakBonusPoints: string | null;
}

export default function StreakInfoModal({
  isOpen,
  onClose,
  streakBonusPoints,
}: StreakInfoModalProps) {
  const bonusPoints = streakBonusPoints ?? '10';

  return (
    <AlertDialog isOpen={isOpen} onClose={onClose} size="md">
      <AlertDialogBackdrop />
      <AlertDialogContent className="rounded-3xl p-8">
        {/* Close button */}
        <TouchableOpacity
          onPress={onClose}
          className="absolute right-3 top-3 z-10 items-center justify-center rounded-full bg-gray-200"
          style={{ width: 28, height: 28 }}>
          <X size={16} color="#838383" weight="bold" />
        </TouchableOpacity>

        <AlertDialogHeader>
          <View className="w-full items-center">
            <Image
              source={require('~/assets/icons/Flame.png')}
              style={{ width: 40, height: 40 }}
              contentFit="contain"
            />
            <Text className="mt-3 font-heading text-xl font-bold text-[#1A1A1A]">
              5-Day Streak Bonus
            </Text>
          </View>
        </AlertDialogHeader>
        <AlertDialogBody className="mt-3">
          <Text className="text-center font-body text-base text-[#313131]">
            Complete a Move With Us or hit 10 pts, 5 days this week to build your streak and earn
            a bonus.
          </Text>
          <View className="mt-4 flex-row items-center justify-center gap-x-1">
            <Text
              className="text-base text-[#1A1A1A]"
              style={{ fontFamily: 'Inter_700Bold' }}>
              Earn +{bonusPoints} pts bonus
            </Text>
            <Check size={18} color="#1A1A1A" weight="bold" />
          </View>
        </AlertDialogBody>
        <AlertDialogFooter className="mt-4">
          <View className="w-full">
            <Button
              variant="solid"
              size="xl"
              action="primary"
              className="h-14 w-full"
              onPress={() => {
                onClose();
                router.push('/(tabs)/rewards');
              }}>
              <ButtonText className="text-base font-bold text-white">Check My Progress</ButtonText>
            </Button>
          </View>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
