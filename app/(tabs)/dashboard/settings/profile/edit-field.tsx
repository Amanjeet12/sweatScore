import { Stack, useLocalSearchParams } from 'expo-router';
import { View, KeyboardAvoidingView, ScrollView, Platform, Text } from 'react-native';

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
              headerTitle: () => (
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: '#2a2a2a' }}>
                  {field === PROFILE_FIELD.FULL_NAME ? 'Edit name' : 'Edit birthdate'}
                </Text>
              ),
              headerTitleAlign: 'center',
              headerShadowVisible: false,
              headerLeft: () => (
                <BackButton
                  fallbackHref="/(tabs)/dashboard/settings/profile/edit"
                  iconColor="#2a2a2a"
                  iconSize={22}
                  text=""
                />
              ),
            }}
          />
          <View className="mx-[22px] mt-8 flex-1">
            <EditProfileField field={field} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
