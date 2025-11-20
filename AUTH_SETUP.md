# Authentication Setup Guide

## Current Setup (Sandbox Mode)

Your app is currently running with **mock authentication** for local development. This allows you to test login/signup flows without needing AWS credentials.

### Demo Accounts

Two demo accounts are pre-configured:

1. **Admin Account**
   - Email: `admin@example.com`
   - Password: `admin123`

2. **User Account**
   - Email: `user@example.com`
   - Password: `user123`

### Creating New Accounts

You can create new accounts using the Sign Up page. All accounts are stored in browser localStorage.

## File Structure

```
src/
├── contexts/
│   └── AuthContext.tsx        # Authentication context provider
├── lib/
│   └── mockAuth.ts            # Mock auth service (for sandbox)
├── pages/
│   ├── LoginPage.tsx          # Login UI
│   ├── SignUpPage.tsx         # Sign up UI
│   └── DashboardPage.tsx      # Protected dashboard
├── components/
│   ├── ProtectedRoute.tsx     # Route protection wrapper
│   └── ui/                    # shadcn/ui components
amplify/
├── backend.ts                 # Amplify Gen 2 backend config
└── auth/
    └── resource.ts            # Auth resource definition
```

## Deploying to AWS Amplify Gen 2

When you're ready to deploy with real authentication:

### 1. Start Amplify Sandbox

```bash
npm run amplify:sandbox
```

This will:
- Deploy a temporary AWS environment
- Create Cognito user pools
- Generate authentication config

### 2. Update Auth Context

Replace mock auth with real Amplify Auth in `src/contexts/AuthContext.tsx`:

```typescript
// Replace mockAuth imports with:
import { signIn, signUp, signOut, getCurrentUser } from 'aws-amplify/auth';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';

// Configure Amplify
Amplify.configure(outputs);
```

### 3. Update Auth Methods

The context methods will use real Amplify Auth:

```typescript
const signIn = async (email: string, password: string) => {
  const { isSignedIn } = await signIn({ username: email, password });
  if (isSignedIn) {
    const user = await getCurrentUser();
    setUser(user);
  }
};
```

### 4. Deploy to Production

```bash
# Connect your repo to Amplify Console
# Then run:
npm run amplify:deploy
```

## Environment Configuration

The app automatically detects if Amplify is configured:

- **Development**: Uses mock auth (`mockAuth.ts`)
- **Production**: Uses AWS Cognito (via Amplify)

## Adding More Auth Features

The Amplify backend supports:

- ✅ Email/password authentication (configured)
- 🔲 Social sign-in (Google, Facebook, etc.)
- 🔲 Multi-factor authentication (MFA)
- 🔲 Password recovery
- 🔲 Email verification

Edit `amplify/auth/resource.ts` to enable these features.

## Security Notes

⚠️ **Important**:
- Mock auth is for development only
- Never deploy mock auth to production
- All mock credentials are stored in localStorage
- Clear localStorage to reset accounts: `localStorage.clear()`

## Resources

- [AWS Amplify Gen 2 Docs](https://docs.amplify.aws/gen2/)
- [Amplify Auth Guide](https://docs.amplify.aws/gen2/build-a-backend/auth/)
- [shadcn/ui Components](https://ui.shadcn.com)
