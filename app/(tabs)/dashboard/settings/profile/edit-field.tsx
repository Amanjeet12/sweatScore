import { Stack, useLocalSearchParams, router } from 'expo-router';
import { View, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import { EditProfileField } from '~/components/core/settings/EditProfileField';
import { PROFILE_FIELD } from '~/utils/types';

export default function ProfileEditField() {
  const { field }: { field: PROFILE_FIELD } = useLocalSearchParams();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'android' ? undefined : 'padding'}
        keyboardVerticalOffset={Platform.OS == 'ios' ? 100 : 0}
        className="flex-1">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
          }}>
          <Stack.Screen
            options={{
              headerShown: true,
              title: '',
              headerTitleAlign: 'center',
              headerShadowVisible: false,
              headerLeft: () => <BackButton onPress={router.back} text="Back" />,
            }}
          />
          <View className="mx-4 mt-4 flex-1 flex-col gap-y-12">
            <EditProfileField field={field} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
