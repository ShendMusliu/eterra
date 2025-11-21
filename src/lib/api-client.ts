import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

// Single Amplify Data client used across the app, defaulting to Cognito user pool auth
export const dataClient = generateClient<Schema>({ authMode: 'userPool' });

// Amplify Data returns { data: null, errors: [...] } instead of throwing; surface those errors.
export const assertNoDataErrors = (result: { errors?: { message?: string }[] } | null | undefined) => {
  if (result?.errors?.length) {
    const message = result.errors.map((error) => error?.message ?? 'Unknown error').join('; ');
    throw new Error(message || 'Amplify Data request failed');
  }
};

// Ensure we have a valid auth session before hitting the Data API.
export const ensureAuthSession = async () => {
  await fetchAuthSession();
};
