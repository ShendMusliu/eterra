import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

// Single Amplify Data client used across the app
export const dataClient = generateClient<Schema>();
