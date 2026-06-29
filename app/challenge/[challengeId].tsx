import { useMutation, useQuery } from 'convex/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { useToast } from '@/components/ui/toast';
import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { ToastMessage } from '~/components/core/Toast';
import ChallengeForm from '~/components/core/admin/ChallengeForm';
import { ButtonText, LoadingButton } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { CatchPromise } from '~/utils/catch-promise';
import { getErrorMessage } from '~/utils/error-message';

export default function EditChallenge() {
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const toast = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const challenge = useQuery(api.admin.getChallenge, {
    challengeId: challengeId as Id<'challenges'>,
  });
  const deleteMutation = useMutation(api.admin.deleteChallenge);
  const publishMutation = useMutation(api.admin.publishChallenge);
  const unpublishMutation = useMutation(api.admin.unpublishChallenge);

  // Navigate back if challenge was deleted (query returns null)
  useEffect(() => {
    if (challenge === null) {
      router.back();
    }
  }, [challenge]);

  const showToast = (message: string, action: 'success' | 'error') => {
    toast.show({
      placement: 'top',
      duration: 3000,
      render: () => <ToastMessage message={message} action={action} />,
    });
  };

  const handleDelete = () => {
    Alert.alert('Delete Challenge', 'Are you sure you want to delete this challenge?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          const [err] = await CatchPromise(
            deleteMutation({ challengeId: challengeId as Id<'challenges'> })
          );
          if (err) {
            showToast(getErrorMessage(err), 'error');
            setIsDeleting(false);
          } else {
            showToast('Challenge deleted', 'success');
            router.back();
          }
        },
      },
    ]);
  };

  const handleTogglePublish = async () => {
    if (!challenge) return;
    const mutation = challenge.isPublished ? unpublishMutation : publishMutation;
    const [err] = await CatchPromise(mutation({ challengeId: challengeId as Id<'challenges'> }));
    if (err) {
      showToast(getErrorMessage(err), 'error');
    } else {
      showToast(challenge.isPublished ? 'Challenge unpublished' : 'Challenge published', 'success');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          title: '',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerShadowVisible: false,
          headerBackVisible: false,
          headerLeft: () => (
            <BackButton fallbackHref="/(tabs)/dashboard/settings/admin/challenges" text="Back" />
          ),
        }}
      />

      {challenge === undefined || challenge === null ? (
        <ScreenLoading />
      ) : (
        <View className="flex-1">
          <Text className="mb-2 mt-4 text-center font-heading text-3xl font-bold text-[#1A1A1A]">
            Edit Challenge
          </Text>

          <ChallengeForm
            mode="edit"
            initialData={challenge}
            onSuccess={() => {
              showToast('Challenge updated', 'success');
              router.back();
            }}
          />

          {/* Publish/Unpublish and Delete actions */}
          <View className="flex-row gap-x-3 px-6 pb-6">
            <View className="flex-1">
              <LoadingButton
                variant="outline"
                size="lg"
                action={challenge.isPublished ? 'secondary' : 'primary'}
                className="h-14 w-full rounded-2xl"
                onPress={handleTogglePublish}>
                <ButtonText>{challenge.isPublished ? 'Unpublish' : 'Publish'}</ButtonText>
              </LoadingButton>
            </View>
            <View className="flex-1">
              <LoadingButton
                variant="outline"
                size="lg"
                action="negative"
                className="h-14 w-full rounded-2xl"
                onPress={handleDelete}
                loading={isDeleting}
                disabled={isDeleting}>
                <ButtonText className="text-red-500">Delete</ButtonText>
              </LoadingButton>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
