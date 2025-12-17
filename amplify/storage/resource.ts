import { defineStorage } from '@aws-amplify/backend'

export const storage = defineStorage({
  name: 'eterra-storage',
  access: (allow) => ({
    'arbk/*': [allow.authenticated.to(['read', 'write'])],
  }),
})
