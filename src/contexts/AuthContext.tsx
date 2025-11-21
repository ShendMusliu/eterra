import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  confirmSignUp as amplifyConfirmSignUp,
  fetchUserAttributes,
  getCurrentUser,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
  type AuthUser,
  type SignInOutput,
} from 'aws-amplify/auth';

interface User {
  email: string;
  name?: string;
  id: string;
}

interface AuthActionResult {
  success: boolean;
  error?: string;
  nextStep?: string;
  requiresConfirmation?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  configError: string | null;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (email: string, password: string, name: string) => Promise<AuthActionResult>;
  confirmSignUp: (email: string, code: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError] = useState<string | null>(null);

  // Amplify is configured globally in main.tsx

  const mapAmplifyUser = (authUser: AuthUser | null, attributes?: Record<string, string>): User | null =>
    authUser
      ? {
        id: authUser.userId,
        email: attributes?.email ?? authUser.signInDetails?.loginId ?? authUser.username,
        name: attributes?.name ?? attributes?.email ?? authUser.signInDetails?.loginId ?? authUser.username,
      }
      : null;

  const buildUserFromAmplify = async (): Promise<User | null> => {
    const currentUser = await getCurrentUser();
    try {
      const attributes = await fetchUserAttributes();
      const normalizedAttributes = Object.fromEntries(
        Object.entries(attributes ?? {}).filter(([, value]) => typeof value === 'string')
      ) as Record<string, string>;
      return mapAmplifyUser(currentUser, normalizedAttributes);
    } catch {
      return mapAmplifyUser(currentUser);
    }
  };

  useEffect(() => {
    const init = async () => {
      await checkAuth();
    };

    void init();
  }, []);

  const checkAuth = async () => {
    try {
      const profile = await buildUserFromAmplify();
      setUser(profile);
    } catch (error) {
      console.error('Error checking auth:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<AuthActionResult> => {

    try {
      const result = (await amplifySignIn({ username: email, password })) as SignInOutput;

      if (result.isSignedIn) {
        const profile = await buildUserFromAmplify();
        setUser(profile);
        return { success: true };
      }

      const nextStep = result.nextStep?.signInStep;
      return {
        success: false,
        error: nextStep ? `Additional verification required: ${nextStep}` : 'Unable to sign in.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in.';
      return { success: false, error: message };
    }
  };

  const signUp = async (email: string, password: string, name: string): Promise<AuthActionResult> => {

    try {
      const result = await amplifySignUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            name,
          },
        },
      });

      if (result.isSignUpComplete) {
        return { success: true };
      }

      const nextStep = result.nextStep?.signUpStep;
      return {
        success: true,
        nextStep,
        requiresConfirmation: nextStep === 'CONFIRM_SIGN_UP',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign up.';
      return { success: false, error: message };
    }
  };

  const confirmSignUp = async (email: string, code: string): Promise<AuthActionResult> => {

    try {
      const result = await amplifyConfirmSignUp({ username: email, confirmationCode: code });
      if (result.isSignUpComplete) {
        return { success: true };
      }

      return {
        success: false,
        error: 'Verification incomplete. Please try again.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to verify code.';
      return { success: false, error: message };
    }
  };

  const signOut = async () => {

    await amplifySignOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        configError,
        signIn,
        signUp,
        confirmSignUp,
        signOut,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
