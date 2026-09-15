import { TouchableOpacity, View } from 'react-native';

import { ButtonText, LoadingButton } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

type Props = {
  description: string;
  onGrant: () => void | Promise<unknown>;
  onCancel: () => void;
  paddingTop: number;
  loading?: boolean;
};

/** The Challenge permission screen, shared with photo-based habit proof. */
export default function CapturePermissionGate({
  description,
  onGrant,
  onCancel,
  paddingTop,
  loading = false,
}: Props) {
  return (
    <View className="flex-1 items-center justify-center bg-[#F9F9F9] px-8" style={{ paddingTop }}>
      <Text className="mb-4 text-center text-base text-[#313131]">{description}</Text>

      <LoadingButton
        variant="solid"
        size="lg"
        action="primary"
        className="rounded-[20px]"
        style={{ borderRadius: 20 }}
        loading={loading}
        onPress={onGrant}>
        <ButtonText>Grant Permissions</ButtonText>
      </LoadingButton>

      <TouchableOpacity className="mt-4" onPress={onCancel}>
        <Text className="font-body text-sm font-medium text-[#838383]">Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}
