import { Image } from 'expo-image';
import { View } from 'react-native';

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from '~/components/ui/alert-dialog';
import { Button, ButtonText } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

export const FirstTimeOnboardingModal = ({
  showAlertDialog,
  handleClose,
  firstName,
  challengeName,
  targetPoints,
  currentPoints = 0,
  missionTarget = 10,
}: {
  showAlertDialog: boolean;
  handleClose: () => void;
  firstName: string;
  challengeName: string;
  targetPoints: number;
  currentPoints?: number;
  missionTarget?: number;
}) => {
  const progressPct = missionTarget > 0 ? Math.min(100, (currentPoints / missionTarget) * 100) : 0;

  return (
    <AlertDialog isOpen={showAlertDialog} onClose={handleClose} size="md" useRNModal>
      <AlertDialogBackdrop />
      <AlertDialogContent className="rounded-3xl p-8">
        <AlertDialogHeader>
          <View className="w-full items-center">
            <Image
              source={require('~/assets/icons/Flame.png')}
              style={{ width: 48, height: 48 }}
              contentFit="contain"
            />
            <Text
              className="mt-4 text-center text-[#1A1A1A]"
              size="2xl"
              style={{ fontFamily: 'Inter_700Bold' }}>
              You&apos;re all set, {firstName}!
            </Text>
          </View>
        </AlertDialogHeader>
        <AlertDialogBody className="mt-3 p-2">
          <Text className="text-center font-body text-base text-[#313131]">
            Welcome to the{' '}
            <Text className="text-[#1A1A1A]" style={{ fontFamily: 'Inter_700Bold' }}>
              {challengeName}
            </Text>{' '}
            challenge. Earn{' '}
            <Text className="text-[#1A1A1A]" style={{ fontFamily: 'Inter_700Bold' }}>
              {targetPoints} points
            </Text>{' '}
            to complete it. Any activity you've already tracked this month will be added to your
            score.
          </Text>

          {/* <View className="mt-6">
            <Text
              className="text-center text-[#1A1A1A]"
              size="lg"
              style={{ fontFamily: 'Inter_700Bold' }}>
              First mission
            </Text>
            <View className="mt-3 flex-row items-center justify-between">
              <Text className="font-body text-base text-[#313131]">Earn {missionTarget} points</Text>
              <Text className="font-body text-base text-[#838383]">
                {currentPoints}/{missionTarget}
              </Text>
            </View>
            <View className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#EEEAE5]">
              <View
                className="h-full rounded-full bg-primary-500"
                style={{ width: `${progressPct}%` }}
              />
            </View>
          </View> */}
        </AlertDialogBody>
        <AlertDialogFooter className="mt-6">
          <Button
            variant="solid"
            size="xl"
            action="primary"
            className="h-16 w-full rounded-2xl"
            onPress={handleClose}>
            <ButtonText className="text-xl font-bold text-white">say hello to the group</ButtonText>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
