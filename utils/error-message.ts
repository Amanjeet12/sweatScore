import { z } from 'zod';

export const getErrorMessage = (error: string[] | string | any): string => {
  if (error == null) {
    return 'Something went wrong. Please try again later.';
  }

  if (Array.isArray(error)) {
    return error.join(', ');
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error.data) {
    return getErrorMessage(error.data);
  }

  if (error.response?.data?.message) {
    return getErrorMessage(error.response.data.message);
  }

  if (error.response?.data?.errors?.base) {
    return getErrorMessage(error.response.data.errors.base);
  }

  if (error.response?.data?.errors?.full_messages) {
    return getErrorMessage(error.response.data.errors.full_messages);
  }

  if (error.response?.data?.errors) {
    return getErrorMessage(error.response.data.errors);
  }

  if (typeof error.message === 'string') {
    return error.message;
  }

  return 'Something went wrong. Please try again later.';
};

export const getZodErrorMessage = (error: z.ZodError): string => {
  const message = error.message;
  const parsedMessage = JSON.parse(message) as { message: string }[];
  const zodError = parsedMessage[0];
  if (!zodError) throw Error('Zod is broken');
  return zodError.message;
};
