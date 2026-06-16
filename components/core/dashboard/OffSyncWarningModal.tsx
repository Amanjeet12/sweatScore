import { useState } from 'react';
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
import { Checkbox, CheckboxIcon, CheckboxIndicator, CheckboxLabel } from '~/components/ui/checkbox';
import { CheckIcon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';
import { storage } from '~/utils/storage';

export const OFF_SYNC_WARNING_KEY = 'skipOffSyncWarning';

export const OffSyncWarningModal = ({
  showAlertDialog,
  handleClose,
}: {
  showAlertDialog: boolean;
  handleClose: () => void;
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleDismiss = () => {
    if (dontShowAgain) {
      storage.set(OFF_SYNC_WARNING_KEY, true);
    }
    handleClose();
  };

  return (
    <AlertDialog isOpen={showAlertDialog} onClose={handleDismiss} size="md" useRNModal>
      <AlertDialogBackdrop />
      <AlertDialogContent className="rounded-3xl p-8">
        <AlertDialogHeader>
          <Text className="font-heading font-bold" size="2xl">
            Your preview might look slightly off sync
          </Text>
        </AlertDialogHeader>
        <AlertDialogBody className="mb-6 mt-4">
          <Text size="lg" className="font-semibold">
            Hit submit to sync the video before it goes live on the feed.
          </Text>
        </AlertDialogBody>
        <AlertDialogFooter>
          <View className="w-full flex-col items-start gap-y-4">
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
                  Don&apos;t show this again
                </Text>
              </CheckboxLabel>
            </Checkbox>
            <Button
              variant="solid"
              size="xl"
              action="primary"
              className="h-16 w-full rounded-2xl"
              onPress={handleDismiss}>
              <ButtonText className="text-xl font-bold text-white">Got It!</ButtonText>
            </Button>
          </View>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
