import { a, defineData } from '@aws-amplify/backend';

/**
 * Data models backing the app:
 * - EterraSale: recorded sales, shipping, payment status.
 * - EterraPurchase: purchases paid from the business cash box.
 * - PrivateExpense: personal business expenses (Shend/Lorik/Gentrit).
 * - PrivateRepayment: repayments between members.
 */
export const data = defineData({
  schema: a.schema({
    EterraSale: a
      .model({
        description: a.string().required(),
        saleType: a.string().required(), // e.g., Privat, GjirafaMall, Other
        amount: a.float().required(),
        shippingCost: a.float().default(0),
        netAfterShipping: a.float().required(),
        paymentStatus: a.enum(['received', 'pending']).default('pending'),
        recordedById: a.string().required(),
        recordedByName: a.string().required(),
        notes: a.string(),
        timestamp: a.datetime().required(),
      })
      .authorization((allow) => [allow.owner(), allow.group('admin')]),

    EterraPurchase: a
      .model({
        description: a.string().required(),
        amount: a.float().required(),
        timestamp: a.datetime().required(),
        recordedById: a.string().required(),
        recordedByName: a.string().required(),
        notes: a.string(),
      })
      .authorization((allow) => [allow.owner(), allow.group('admin')]),

    PrivateExpense: a
      .model({
        description: a.string().required(),
        amount: a.float().required(),
        timestamp: a.datetime().required(),
        userId: a.string().required(),
        userName: a.string().required(),
        evidenceUrl: a.string(),
      })
      .authorization((allow) => [allow.owner(), allow.group('admin')]),

    PrivateRepayment: a
      .model({
        payerId: a.string().required(),
        payerName: a.string().required(),
        recipientId: a.string().required(),
        recipientName: a.string().required(),
        amount: a.float().required(),
        timestamp: a.datetime().required(),
        notes: a.string(),
      })
      .authorization((allow) => [allow.owner(), allow.group('admin')]),
  }),
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      expiresInDays: 7,
    },
  },
});
