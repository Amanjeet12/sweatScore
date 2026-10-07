import { View } from 'react-native';

import { PrototypeButton } from '~/components/core/auth/PrototypeOnboarding';
import { Text } from '~/components/ui/text';

type Props = {
  description: string;
  onGrant: () => void | Promise<unknown>;
  onCancel: () => void;
  paddingTop: number;
  loading?: boolean;
  actionLabel?: string;
};

/** The Challenge permission screen, shared with photo-based habit proof. */
export default function CapturePermissionGate({
  description,
  onGrant,
  onCancel,
  paddingTop,
  loading = false,
  actionLabel = 'Grant Permissions',
}: Props) {
  return (
    <View className="flex-1 items-center justify-center bg-white px-8" style={{ paddingTop }}>
      <Text className="mb-4 text-center text-base text-[#313131]">{description}</Text>

      <PrototypeButton
        label={actionLabel}
        loading={loading}
        onPress={() => {
          onGrant();
        }}
      />
      <PrototypeButton className="mt-3" variant="secondary" label="Cancel" onPress={onCancel} />
    </View>
  );
}
