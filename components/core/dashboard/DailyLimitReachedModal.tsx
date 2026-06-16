import { Image } from 'expo-image';
import { Check } from 'phosphor-react-native';
import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from '~/components/ui/alert-dialog';
import { Button, ButtonText } from '~/components/ui/button';
import { Checkbox, CheckboxIcon, CheckboxIndicator, CheckboxLabel } from '~/components/ui/checkbox';
import { CheckIcon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';
import { storage } from '~/utils/storage';

export const SKIP_DAILY_LIMIT_POPUP_KEY = 'skipDailyLimitPopup';

export const DailyLimitReachedModal = ({
  showAlertDialog,
  handleClose,
  handleUpgrade,
  cap,
}: {
  showAlertDialog: boolean;
  handleClose: () => void;
  handleUpgrade: () => void;
  cap: number;
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const persistSkipIfChecked = () => {
    if (dontShowAgain) {
      storage.set(SKIP_DAILY_LIMIT_POPUP_KEY, true);
    }
  };

  return (
    <AlertDialog
      isOpen={showAlertDialog}
      onClose={() => {
        persistSkipIfChecked();
        handleClose();
      }}
      size="md">
      <AlertDialogBackdrop />
      <AlertDialogContent className="rounded-3xl p-8">
        <AlertDialogHeader>
          <View className="w-full items-center">
            <Image
              source={require('~/assets/icons/Flame.png')}
              style={{ width: 48, height: 48 }}
              contentFit="contain"
            />
            <Text className="mt-3 font-heading font-bold text-[#1A1A1A]" size="2xl">
              You&apos;re on a roll!
            </Text>
            <View className="mt-2 flex-row items-center gap-x-1">
              <Text className="font-body text-base font-bold text-primary-500">
                {cap} points earned today
              </Text>
              <Check size={16} color="#FF5C1A" weight="bold" />
            </View>
          </View>
        </AlertDialogHeader>
        <AlertDialogBody className="mt-4">
          <Text className="text-center font-body text-base text-[#313131]">
            Don&apos;t let your progress stop here. Upgrade to remove your daily points limit and
            keep earning unlimited points.
          </Text>
        </AlertDialogBody>
        <AlertDialogFooter className="mt-6">
          <View className="w-full flex-col items-center gap-y-3">
            <Button
              variant="solid"
              size="xl"
              action="primary"
              className="h-16 w-full rounded-2xl"
              onPress={() => {
                persistSkipIfChecked();
                handleUpgrade();
                handleClose();
              }}>
              <ButtonText className="text-lg font-bold text-white">Remove My Daily Limit</ButtonText>
            </Button>
            <TouchableOpacity
              onPress={() => {
                persistSkipIfChecked();
                handleClose();
              }}>
              <Text className="font-body text-base text-[#313131]">Not now</Text>
            </TouchableOpacity>
            <Checkbox
              size="md"
              isChecked={dontShowAgain}
              onChange={setDontShowAgain}
              value="dontShowAgain"
              aria-label="Don't remind me again"
              className="mt-2">
              <CheckboxIndicator>
                <CheckboxIcon as={CheckIcon} />
              </CheckboxIndicator>
              <CheckboxLabel>
                <Text size="md" className="ml-2 text-[#838383]">
                  Don&apos;t remind me again
                </Text>
              </CheckboxLabel>
            </Checkbox>
          </View>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
