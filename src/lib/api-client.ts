import { fetchAuthSession, signOut as amplifySignOut } from 'aws-amplify/auth';
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
  // Force refresh to avoid stale/expired tokens
  try {
    await fetchAuthSession({ forceRefresh: true });
  } catch (error) {
    console.error('Auth session refresh failed', error);
    // Surface the error; callers decide how to handle (do not auto sign out here)
    throw error;
  }
};
