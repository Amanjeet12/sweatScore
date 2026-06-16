import { useMutation } from 'convex/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { z } from 'zod';

import { BackButton } from '~/components/core/BackButton';
import { ErrorMessage } from '~/components/core/ErrorMessage';
import SafeAreaView from '~/components/core/SafeAreaView';
import { ButtonGroup, ButtonText, LoadingButton } from '~/components/ui/button';
import { Input, InputField } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { Textarea, TextareaInput } from '~/components/ui/textarea';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { CatchPromise } from '~/utils/catch-promise';
import { getErrorMessage, getZodErrorMessage } from '~/utils/error-message';

export default function AddNewCreatorVideo() {
  const { creatorId } = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const addCreatorVideo = useMutation(api.admin.addCreatorVideo);

  const creatorVideoSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    subtitle: z.string().min(1, 'Subtitle is required'),
    youtubeUrl: z.string().min(1, 'Youtube URL is required').url('Invalid Youtube URL'),
    difficulty: z.enum(['easy', 'medium', 'hard'], {
      message: 'Difficulty is required. (easy, medium, hard)',
    }),
    equipment: z.string().min(1, 'Equipment is required'),
    category: z.string().min(1, 'Category is required'),
    description: z.string().min(1, 'Description is required'),
  });

  const handleSubmit = async () => {
    // Dismiss keyboard when submitting
    Keyboard.dismiss();

    setError(null);
    setIsLoading(true);

    if (
      !title &&
      !subtitle &&
      !youtubeUrl &&
      !difficulty &&
      !equipment &&
      !category &&
      !description
    ) {
      setError('Please enter all fields');
      setIsLoading(false);
      return;
    }

    const cleanedDifficulty = difficulty?.toLowerCase().trim();

    const result = await creatorVideoSchema.safeParse({
      title,
      subtitle,
      youtubeUrl,
      difficulty: cleanedDifficulty as 'easy' | 'medium' | 'hard',
      equipment,
      category,
      description,
    });

    if (!result.success) {
      setError(getZodErrorMessage(result.error));
      setIsLoading(false);
      return;
    }

    const [error, response] = await CatchPromise(
      addCreatorVideo({
        title: result.data.title,
        subtitle: result.data.subtitle,
        youtubeUrl: result.data.youtubeUrl,
        difficulty: result.data.difficulty,
        equipment: result.data.equipment ?? undefined,
        category: result.data.category ?? undefined,
        description: result.data.description ?? undefined,
        creatorId: creatorId as Id<'creators'>,
        order: 0,
        isActive: true,
      })
    );

    if (error) {
      setError(getErrorMessage(error));
    }

    if (response) {
      router.back();
    }

    setIsLoading(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
        className="flex-1">
        <Stack.Screen
          options={{
            title: '',
            headerTitleAlign: 'center',
            headerStyle: {
              backgroundColor: '#FFFFFF',
            },
            headerShadowVisible: false,
            headerBackVisible: false,
            headerLeft: () => (
              <BackButton
                onPress={() => {
                  router.back();
                }}
                text="Back"
              />
            ),
          }}
        />

        <ScrollView
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
          className="flex-1">
          <View className="flex-1 justify-start px-6">
            <View className="mt-4">
              <Text className="mb-2 text-center font-heading text-3xl font-bold text-[#1A1A1A]">
                Add new creator video
              </Text>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-xl font-bold text-primary-500">Title</Text>
              <View className="items-center">
                <Input size="xl" variant="rounded" isInvalid={!!error}>
                  <InputField
                    placeholder="Enter video title"
                    autoCapitalize="none"
                    keyboardType="default"
                    value={title ?? ''}
                    onChangeText={(text) => {
                      setError(null);
                      setTitle(text);
                    }}
                  />
                </Input>
              </View>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-xl font-bold text-primary-500">Subtitle</Text>
              <View className="items-center">
                <Input size="xl" variant="rounded" isInvalid={!!error}>
                  <InputField
                    placeholder="Enter subtitle"
                    autoCapitalize="none"
                    keyboardType="default"
                    value={subtitle ?? ''}
                    onChangeText={(text) => {
                      setError(null);
                      setSubtitle(text);
                    }}
                  />
                </Input>
              </View>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-xl font-bold text-primary-500">Youtube URL</Text>
              <View className="items-center">
                <Input size="xl" variant="rounded" isInvalid={!!error}>
                  <InputField
                    placeholder="Enter youtube url"
                    autoCapitalize="none"
                    keyboardType="default"
                    value={youtubeUrl ?? ''}
                    onChangeText={(text) => {
                      setError(null);
                      setYoutubeUrl(text);
                    }}
                  />
                </Input>
              </View>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-xl font-bold text-primary-500">Difficulty</Text>
              <View className="items-center">
                <Input size="xl" variant="rounded" isInvalid={!!error}>
                  <InputField
                    placeholder="Enter difficulty"
                    autoCapitalize="none"
                    keyboardType="default"
                    value={difficulty ?? ''}
                    onChangeText={(text) => {
                      setError(null);
                      setDifficulty(text);
                    }}
                  />
                </Input>
              </View>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-xl font-bold text-primary-500">Equipment</Text>
              <View className="items-center">
                <Input size="xl" variant="rounded" isInvalid={!!error}>
                  <InputField
                    placeholder="Enter equipment"
                    autoCapitalize="none"
                    keyboardType="default"
                    value={equipment ?? ''}
                    onChangeText={(text) => {
                      setError(null);
                      setEquipment(text);
                    }}
                  />
                </Input>
              </View>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-xl font-bold text-primary-500">Category</Text>
              <View className="items-center">
                <Input size="xl" variant="rounded" isInvalid={!!error}>
                  <InputField
                    placeholder="Enter category"
                    autoCapitalize="none"
                    keyboardType="default"
                    value={category ?? ''}
                    onChangeText={(text) => {
                      setError(null);
                      setCategory(text);
                    }}
                  />
                </Input>
              </View>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-xl font-bold text-primary-500">Description</Text>
              <View className="items-center">
                <Textarea size="xl" isInvalid={!!error} className="rounded-lg">
                  <TextareaInput
                    placeholder="Enter description"
                    multiline
                    keyboardType="default"
                    value={description ?? ''}
                    onChangeText={(text) => {
                      setError(null);
                      setDescription(text);
                    }}
                  />
                </Textarea>
              </View>
            </View>

            <ErrorMessage error={error} className="mb-4" />

            <View className="flex-col gap-y-4">
              <View className="flex-1">
                <ButtonGroup>
                  <LoadingButton
                    variant="solid"
                    size="xl"
                    action="primary"
                    className="h-16 w-full rounded-3xl"
                    onPress={handleSubmit}
                    disabled={isLoading}
                    loading={isLoading}>
                    <ButtonText>Add Creator Video</ButtonText>
                  </LoadingButton>
                </ButtonGroup>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
