import { defineStorage } from '@aws-amplify/backend'

export const storage = defineStorage({
  name: 'eterra-storage',
  access: (allow) => ({
    // Amplify Storage prefixes objects by access level (e.g. public/).
    'public/arbk/*': [allow.authenticated.to(['read', 'write'])],
  }),
})
