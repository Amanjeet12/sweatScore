import { useState } from 'react';
import { View } from 'react-native';

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';
import { Button, ButtonText } from '@/components/ui/button';
import { Checkbox, CheckboxIcon, CheckboxIndicator, CheckboxLabel } from '@/components/ui/checkbox';
import { CheckIcon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { storeData } from '@/utils/storage';

const StartWorkoutPopup = ({
  showAlertDialog,
  handleClose,
  handlePrimaryButtonPress,
}: {
  showAlertDialog: boolean;
  handleClose: () => void;
  handlePrimaryButtonPress?: () => void;
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  return (
    <AlertDialog isOpen={showAlertDialog} onClose={handleClose} size="md">
      <AlertDialogBackdrop />
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <View className="flex-row items-center justify-center gap-x-2">
            <Text className="font-bold" size="2xl">
              Want to earn points for this workout?
            </Text>
          </View>
        </AlertDialogHeader>
        <AlertDialogBody className="mb-6 mt-4">
          <Text size="lg" className="font-semibold">
            Start a workout on your fitness watch before you begin. That&apos;s how we track your
            heart rate and give you Sweat Points.
          </Text>
        </AlertDialogBody>
        <AlertDialogFooter>
          <View className="w-full flex-col items-start justify-between gap-y-4">
            <Checkbox
              size="md"
              isChecked={dontShowAgain}
              onChange={setDontShowAgain}
              value="dontShowAgain"
              aria-label="Don't show this again">
              <CheckboxIndicator>
                <CheckboxIcon as={CheckIcon} />
              </CheckboxIndicator>
              <CheckboxLabel>
                <Text size="lg" className="ml-2">
                  Don't show this again
                </Text>
              </CheckboxLabel>
            </Checkbox>
            <Button
              variant="solid"
              size="xl"
              action="primary"
              className="mt-2 h-16 w-full rounded-2xl"
              onPress={() => {
                if (dontShowAgain) {
                  storeData('skipWorkoutPopup', true);
                }
                handlePrimaryButtonPress?.();
                handleClose();
              }}>
              <ButtonText className="text-xl font-bold text-white">Start Workout</ButtonText>
            </Button>
          </View>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default StartWorkoutPopup;
