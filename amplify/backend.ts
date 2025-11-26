import { defineBackend, defineFunction } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';

/**
 * Amplify Gen 2 backend: Auth (Cognito) + Data (GraphQL/DynamoDB).
 */
const reminderSender = defineFunction({
  name: 'reminderSender',
  entry: './functions/reminderSender/index.mjs',
  runtime: 18,
  environment: {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? '',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? '',
    TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM ?? '',
  },
});

const backend = defineBackend({
  auth,
  data,
  reminderSender,
});
