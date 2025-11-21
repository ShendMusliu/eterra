import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

// Single Amplify Data client used across the app
export const dataClient = generateClient<Schema>();

// Amplify Data returns { data: null, errors: [...] } instead of throwing; surface those errors.
export const assertNoDataErrors = (result: { errors?: { message?: string }[] } | null | undefined) => {
  if (result?.errors?.length) {
    const message = result.errors.map((error) => error?.message ?? 'Unknown error').join('; ');
    throw new Error(message || 'Amplify Data request failed');
  }
};
