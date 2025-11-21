// amplify/auth/resource.ts

import { defineAuth, secret } from '@aws-amplify/backend';
import { syncUserRolesPreToken } from '../functions/sync-user-roles-pre-token/resource';
import { USER_ROLES } from '../../shared/userRoles';

export const auth = defineAuth({
  // Email sign-in + Google SSO (no username login)
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['openid', 'email', 'profile'],
        // Map Google OIDC claims -> Cognito standard attributes (camelCase keys)
        attributeMapping: {
          email: 'email',
          emailVerified: 'email_verified',
          givenName: 'given_name',
          familyName: 'family_name',
          profilePicture: 'picture',
        },
      },
      // Hosted UI redirects for both local dev and prod
      callbackUrls: [
        'http://localhost:5173/',
        'https://auth-v2.d2rimjkgibi5bd.amplifyapp.com/',
      ],
      logoutUrls: [
        'http://localhost:5173/',
        'https://auth-v2.d2rimjkgibi5bd.amplifyapp.com/',
      ],
    },
  },
  // Recovery via email only (no phone)
  accountRecovery: 'EMAIL_ONLY',
  // Standard attributes you want present in this NEW pool
  userAttributes: {
    email: { required: true }, // don’t force immutable; safer defaults
    givenName: { mutable: true },
    familyName: { mutable: true },
    preferredUsername: { mutable: true },
    profilePicture: { mutable: true }, // note: use 'picture', not 'profilePicture'
  },
  // Initial groups for RBAC
  groups: [...USER_ROLES],
  triggers: {
    preTokenGeneration: syncUserRolesPreToken,
  },
});
