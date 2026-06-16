import { useMutation, usePaginatedQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, TouchableOpacity, View } from 'react-native';

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/toast';
import { BackButton } from '~/components/core/BackButton';
import { ImageWithZoom } from '~/components/core/ImageWithZoom';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { ToastMessage } from '~/components/core/Toast';
import { Button, ButtonText, LoadingButton } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { CatchPromise } from '~/utils/catch-promise';
import { getErrorMessage } from '~/utils/error-message';

export default function AdminViewPendingApprovals() {
  const toast = useToast();
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  const reviewActivity = useMutation(api.admin.reviewActivity);

  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.pendingApprovals,
    {},
    { initialNumItems: 50 }
  );

  const loadMorePages = () => {
    if (status === 'CanLoadMore') {
      loadMore(50);
    }
  };

  const showSuccessToast = (message: string) => {
    toast.show({
      placement: 'top',
      duration: 3000,
      render: ({ id }) => {
        return <ToastMessage message={message} action="success" />;
      },
    });
  };

  const showErrorToast = (message: string) => {
    toast.show({
      placement: 'top',
      duration: 3000,
      render: ({ id }) => {
        return <ToastMessage message={message} action="error" />;
      },
    });
  };

  const openAlertDialog = (activity: any) => {
    setSelectedActivity(activity);
    setShowAlertDialog(true);
  };

  const handleClose = () => {
    setSelectedActivity(null);
    setShowAlertDialog(false);
  };

  const handleReview = async (action: 'approved' | 'rejected') => {
    setIsReviewing(true);
    const [error, response] = await CatchPromise(
      reviewActivity({
        activityId: selectedActivity._id,
        reviewStatus: action,
      })
    );

    if (error) showErrorToast(getErrorMessage(error));
    if (response) {
      showSuccessToast(`Activity ${action === 'approved' ? 'approved' : 'rejected'} successfully`);
    }

    handleClose();
    setIsReviewing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: '',
          headerTitle: () => (
            <Text className="text-center font-heading text-2xl font-bold text-[#1A1A1A]">
              Pending Approvals
            </Text>
          ),
          headerShadowVisible: false,
          headerLeft: () => (
            <BackButton
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/dashboard/settings');
                }
              }}
            />
          ),
        }}
      />

      <AlertDialog isOpen={showAlertDialog} onClose={handleClose} size="md">
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Text className="font-semibold text-typography-950" size="md">
              Approve or Reject Activity
            </Text>
          </AlertDialogHeader>
          <AlertDialogBody className="mb-4 mt-3">
            {selectedActivity && (
              <View className="flex-row gap-x-2">
                {selectedActivity.imageUrl ? (
                  <View>
                    <ImageWithZoom
                      path={{ uri: selectedActivity.imageUrl }}
                      resizeMode="contain"
                      size={80}
                    />
                  </View>
                ) : null}
                <View className="z-50 flex-col">
                  <View className="z-50">
                    <View className="flex-row gap-x-2">
                      <View className="flex-1">
                        <Text className="text-[16px] font-bold">{selectedActivity.user.name}</Text>
                      </View>
                    </View>
                    <View className="flex-col">
                      <Text className="text-lg font-semibold text-hint">
                        For Date: {selectedActivity.date}
                      </Text>
                      {selectedActivity.steps && selectedActivity.steps > 0 ? (
                        <Text className="text-lg font-semibold text-hint">
                          {selectedActivity.steps} steps
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            )}
          </AlertDialogBody>
          <AlertDialogFooter>
            <View className="flex-row gap-x-2">
              <Button
                variant="outline"
                action="secondary"
                onPress={handleClose}
                size="sm"
                className="flex-1">
                <ButtonText>Cancel</ButtonText>
              </Button>
              <LoadingButton
                variant="solid"
                action="negative"
                onPress={() => handleReview('rejected')}
                loading={isReviewing}
                disabled={isReviewing}
                size="sm"
                className="flex-1">
                <ButtonText>Reject</ButtonText>
              </LoadingButton>
              <LoadingButton
                variant="solid"
                action="positive"
                onPress={() => handleReview('approved')}
                loading={isReviewing}
                disabled={isReviewing}
                size="sm"
                className="flex-1">
                <ButtonText>Approve</ButtonText>
              </LoadingButton>
            </View>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {status === 'LoadingFirstPage' ? (
        <ScreenLoading />
      ) : (
        <View className="mx-8 mt-4 flex-1 flex-col gap-y-8">
          <FlatList
            showsVerticalScrollIndicator={false}
            data={results}
            renderItem={({ item }) => (
              <PendingApprovalRow item={item} openAlertDialog={openAlertDialog} />
            )}
            keyExtractor={(item) => item._id.toString()}
            onEndReached={loadMorePages}
            onEndReachedThreshold={2.0}
            ListEmptyComponent={<Text className="text-center text-2xl">No pending approvals</Text>}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const PendingApprovalRow = ({
  item,
  openAlertDialog,
}: {
  item: any;
  openAlertDialog: (activity: any) => void;
}) => {
  return (
    <View className="mb-4 flex-row items-center rounded-lg border border-gray-200 p-4">
      <View className="flex-1">
        <TouchableOpacity onPress={() => openAlertDialog(item)}>
          <View className="flex-row gap-x-2">
            {item.imageUrl ? (
              <View>
                <ImageWithZoom path={{ uri: item.imageUrl }} resizeMode="contain" size={80} />
              </View>
            ) : null}

            <View className="z-50 flex-1 flex-col">
              <View className="z-50">
                <View className="flex-row gap-x-2">
                  <View className="flex-1">
                    <Text className="text-[16px] font-bold">{item.user.name}</Text>
                  </View>
                </View>
                <View className="flex-col">
                  <Text className="text-lg font-semibold text-hint">For Date: {item.date}</Text>
                  {item.steps && item.steps > 0 ? (
                    <Text className="text-lg font-semibold text-hint">{item.steps} steps</Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};
