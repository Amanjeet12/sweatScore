import DateTimePicker from '@react-native-community/datetimepicker';
import { useConvex, useMutation } from 'convex/react';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { z } from 'zod';

import { ErrorMessage } from '~/components/core/ErrorMessage';
import { ButtonText, LoadingButton } from '~/components/ui/button';
import { Input, InputField } from '~/components/ui/input';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';
import { getErrorMessage, getZodErrorMessage } from '~/utils/error-message';
import { PROFILE_FIELD } from '~/utils/types';

export const EditProfileField = ({ field }: { field: PROFILE_FIELD }) => {
  const nameRef = useRef<TextInput>(null);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [birthdate, setBirthdate] = useState<Date | undefined>(undefined);
  const [date, setDate] = useState(new Date());

  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const convex = useConvex();
  const updateUser = useMutation(api.users.update);

  const [name, setName] = useState(currentUser?.name ?? '');

  const requiredSchema = z.object({
    name: z.string().min(1, 'Name is required'),
  });

  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 12);
  tenYearsAgo.setHours(0, 0, 0, 0);

  const birthdateSchema = z.object({
    birthdate: z
      .date({ required_error: 'Please enter your birthdate' })
      .refine((date) => date < tenYearsAgo, {
        message:
          'Please update your date of birth. This keeps your step tracking and points accurate',
      }),
  });

  const isFormValid = useMemo(() => {
    const payload = { name };
    try {
      requiredSchema.parse(payload);
      return true;
    } catch (error: any) {
      return false;
    }
  }, [name]);

  const handleSubmit = async () => {
    setError(null);
    setIsLoading(true);

    if (field === PROFILE_FIELD.FULL_NAME) {
      const result = await requiredSchema.safeParse({
        name,
      });

      if (!result.success) {
        setError(getZodErrorMessage(result.error));
        setIsLoading(false);
        return;
      }

      const [error, response] = await CatchPromise(
        updateUser({
          name,
        })
      );

      if (error) {
        setError(getErrorMessage(error));
      }

      if (response) {
        const user = await convex.query(api.users.current);
        setCurrentUser(user);

        router.back();
      }
    } else if (field === PROFILE_FIELD.BIRTHDATE) {
      const result = await birthdateSchema.safeParse({
        birthdate,
      });

      if (!result.success) {
        setError(getZodErrorMessage(result.error));
        setIsLoading(false);
        return;
      }

      const [error, response] = await CatchPromise(
        updateUser({
          birthdate: date?.getTime(),
        })
      );

      if (error) {
        setError(getErrorMessage(error));
      }

      if (response) {
        const user = await convex.query(api.users.current);
        setCurrentUser(user);

        router.back();
      }
    }
    setIsLoading(false);
  };

  const onChange = (event: any, selectedDate: any) => {
    const currentDate = selectedDate;
    setDate(currentDate);
  };

  useEffect(() => {
    if (field === PROFILE_FIELD.FULL_NAME) nameRef.current?.focus();
  }, [field]);

  useEffect(() => {
    if (currentUser?.birthdate) {
      setBirthdate(new Date(currentUser.birthdate));
      setDate(new Date(currentUser.birthdate));
    }
  }, [currentUser?.birthdate]);

  return (
    <View>
      {field === PROFILE_FIELD.FULL_NAME && (
        <View className="flex-row">
          <View className="flex-1 flex-col gap-y-1">
            <Input size="xl" variant="rounded" isInvalid={!!error}>
              <InputField
                placeholder="Name"
                value={name}
                onChangeText={(text) => {
                  setError(null);
                  setName(text);
                }}
              />
            </Input>
          </View>
        </View>
      )}

      {field === PROFILE_FIELD.BIRTHDATE ? (
        Platform.OS === 'ios' ? (
          <View className="flex-row items-center justify-center">
            <DateTimePicker
              testID="dateTimePicker"
              value={date}
              mode="date"
              onChange={onChange}
              display="spinner"
              maximumDate={tenYearsAgo}
              minimumDate={new Date(1900, 0, 1)}
            />
          </View>
        ) : null
      ) : null}

      <ErrorMessage error={error} className="mt-6" />

      <View className="flex-0 mt-4 items-end justify-end">
        <LoadingButton
          variant="solid"
          size="sm"
          className="h-16 w-full rounded-3xl"
          onPress={handleSubmit}
          disabled={!isFormValid || isLoading}
          loading={isLoading}>
          <ButtonText className="text-xl font-bold text-white">
            Update {field === PROFILE_FIELD.FULL_NAME ? 'name' : 'birthdate'}
          </ButtonText>
        </LoadingButton>
      </View>
    </View>
  );
};
