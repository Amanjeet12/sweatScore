import { Watch } from 'phosphor-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { workoutTypography as type } from '../design/WorkoutStyles';

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
      <AlertDialogContent
        style={{ maxHeight: '90%' }}
        className="rounded-[28px] border-0 bg-white px-6 pb-6 pt-7">
        <ScrollView showsVerticalScrollIndicator={false}>
          <AlertDialogHeader>
            <View className="w-full items-start">
              <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1E9]">
                <Watch size={24} color="#FF5C35" weight="duotone" />
              </View>
              <Text style={[type.heading, { textAlign: 'left' }]}>Earn points for this workout</Text>
            </View>
          </AlertDialogHeader>
          <AlertDialogBody className="mb-5 mt-3">
            <Text style={[type.supporting, { textAlign: 'left' }]}>
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
                  <Text style={[type.video, { marginLeft: 8, flexShrink: 1 }]}>
                    Don't show this again
                  </Text>
                </CheckboxLabel>
              </Checkbox>
              <Button
                variant="solid"
                size="xl"
                action="primary"
                className="mt-1 h-auto min-h-14 w-full rounded-[20px] bg-[#2a2a2a] px-4 py-3.5 active:bg-[#1a1a1a]"
                onPress={() => {
                  if (dontShowAgain) {
                    storeData('skipWorkoutPopup', true);
                  }
                  handlePrimaryButtonPress?.();
                  handleClose();
                }}>
                <ButtonText style={type.button}>Start workout</ButtonText>
              </Button>
            </View>
          </AlertDialogFooter>
        </ScrollView>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default StartWorkoutPopup;
