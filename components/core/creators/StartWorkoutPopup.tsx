import { Watch } from 'phosphor-react-native';
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
      <AlertDialogContent className="rounded-[28px] border-0 bg-white px-6 pb-6 pt-7">
        <AlertDialogHeader>
          <View className="w-full items-start">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1E9]">
              <Watch size={24} color="#FF5C35" weight="duotone" />
            </View>
            <Text className="font-heading text-[24px] font-semibold leading-8 text-[#1A1A1A]">
              Earn points for this workout
            </Text>
          </View>
        </AlertDialogHeader>
        <AlertDialogBody className="mb-5 mt-3">
          <Text className="font-body text-[15px] leading-6 text-[#655F5B]">
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
              aria-label="Don't show this again"
              className="min-h-12 w-full rounded-2xl bg-[#F8F6F4] px-4">
              <CheckboxIndicator className="rounded-md border-[#B9B2AD] data-[checked=true]:border-[#FF5C35] data-[checked=true]:bg-[#FF5C35]">
                <CheckboxIcon as={CheckIcon} />
              </CheckboxIndicator>
              <CheckboxLabel>
                <Text className="ml-2 font-body text-sm font-medium text-[#514B47]">
                  Don't show this again
                </Text>
              </CheckboxLabel>
            </Checkbox>
            <Button
              variant="solid"
              size="xl"
              action="primary"
              className="mt-1 h-14 w-full rounded-[18px] bg-[#FF5C35] active:bg-[#E94E24]"
              onPress={() => {
                if (dontShowAgain) {
                  storeData('skipWorkoutPopup', true);
                }
                handlePrimaryButtonPress?.();
                handleClose();
              }}>
              <ButtonText className="font-heading text-base font-semibold text-white">
                Start workout
              </ButtonText>
            </Button>
          </View>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default StartWorkoutPopup;
