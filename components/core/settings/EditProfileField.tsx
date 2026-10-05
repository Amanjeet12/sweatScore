import DateTimePicker from '@react-native-community/datetimepicker';
import { useConvex, useMutation } from 'convex/react';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
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
        <View>
          <Text
            style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 15,
              color: '#2a2a2a',
              marginBottom: 10,
            }}>
            Name
          </Text>
          <View>
            <Input
              size="xl"
              variant="rounded"
              isInvalid={!!error}
              className="h-14 rounded-[18px] border-[#e5e5e5] bg-[#f6f6f6]">
              <InputField
                placeholder="Name"
                value={name}
                className="text-base text-[#2a2a2a]"
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
          <View>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#2a2a2a' }}>
              Date of birth
            </Text>
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

      <ErrorMessage error={error} className="mt-3" />

      <View className="mt-6">
        <LoadingButton
          variant="solid"
          size="xl"
          className="h-14 w-full rounded-[20px]"
          style={{ backgroundColor: '#2a2a2a' }}
          onPress={handleSubmit}
          disabled={!isFormValid || isLoading}
          loading={isLoading}>
          <ButtonText style={{ fontFamily: 'Inter_600SemiBold' }} className="text-base text-white">
            Update {field === PROFILE_FIELD.FULL_NAME ? 'name' : 'birthdate'}
          </ButtonText>
        </LoadingButton>
      </View>
    </View>
  );
};
