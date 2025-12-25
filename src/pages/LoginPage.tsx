import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [newPasswordRequired, setNewPasswordRequired] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmNewPassword, setResetConfirmNewPassword] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, completeNewPassword, requestPasswordReset, confirmPasswordReset, configError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(configError ?? '');
    setInfoMessage('');
    setLoading(true);

    try {
      if (newPasswordRequired) {
        if (!newPassword || newPassword !== confirmNewPassword) {
          setError('New passwords must match.');
          return;
        }
        const result = await completeNewPassword(newPassword);
        if (result.success) {
          navigate('/dashboard');
        } else {
          setError(result.error || 'Could not set new password');
        }
      } else {
        const result = await signIn(email, password);
        if (result.success) {
          navigate('/dashboard');
        } else if (result.nextStep === 'NEW_PASSWORD_REQUIRED') {
          setNewPasswordRequired(true);
          setError('Set your new password to finish signing in.');
        } else {
          setError(result.error || 'Login failed');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setLoading(true);

    try {
      const emailToUse = resetEmail.trim();
      if (!emailToUse) {
        setError('Please enter your email address.');
        return;
      }

      const result = await requestPasswordReset(emailToUse);
      if (result.success) {
        setResetRequested(true);
        setInfoMessage('Check your email for the verification code.');
      } else {
        setError(result.error || 'Unable to send reset code.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setLoading(true);

    try {
      if (resetNewPassword !== resetConfirmNewPassword) {
        setError('Passwords must match.');
        return;
      }

      const result = await confirmPasswordReset(resetEmail.trim(), resetCode.trim(), resetNewPassword);
      if (result.success) {
        setInfoMessage('Password updated. You can sign in now.');
        setForgotPasswordMode(false);
        setResetRequested(false);
        setResetCode('');
        setResetNewPassword('');
        setResetConfirmNewPassword('');
      } else {
        setError(result.error || 'Unable to reset password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordClick = () => {
    setForgotPasswordMode(true);
    setResetEmail(email.trim() || resetEmail);
    setError('');
    setInfoMessage('');
  };

  const handleBackToSignIn = () => {
    setForgotPasswordMode(false);
    setResetRequested(false);
    setError('');
    setInfoMessage('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <p className="font-brand font-semibold tracking-tight text-[3.5rem] sm:text-[5.5rem] md:text-[6.75rem] leading-none text-[hsl(var(--foreground))]">
            eterra.
          </p>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        {forgotPasswordMode ? (
          <form onSubmit={resetRequested ? handleConfirmReset : handleRequestReset}>
            <CardContent className="space-y-4">
              {infoMessage && (
                <div className="p-3 text-sm rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/20">
                  {infoMessage}
                </div>
              )}
              {(configError || error) && (
                <div className="p-3 text-sm rounded-md bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))]/20">
                  {configError || error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="name@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  disabled={resetRequested}
                />
              </div>

              {resetRequested && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="reset-code">Verification code</Label>
                    <Input
                      id="reset-code"
                      type="text"
                      placeholder="Enter the code from email"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-new-password">New password</Label>
                    <Input
                      id="reset-new-password"
                      type="password"
                      placeholder="Create a new password"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-confirm-password">Confirm new password</Label>
                    <Input
                      id="reset-confirm-password"
                      type="password"
                      placeholder="Confirm your new password"
                      value={resetConfirmNewPassword}
                      onChange={(e) => setResetConfirmNewPassword(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? resetRequested
                    ? 'Updating password...'
                    : 'Sending code...'
                  : resetRequested
                    ? 'Update password'
                    : 'Send reset code'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={handleBackToSignIn}>
                Back to sign in
              </Button>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {infoMessage && (
                <div className="p-3 text-sm rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/20">
                  {infoMessage}
                </div>
              )}
              {(configError || error) && (
                <div className="p-3 text-sm rounded-md bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))]/20">
                  {configError || error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={newPasswordRequired}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{newPasswordRequired ? 'Temporary password' : 'Password'}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={newPasswordRequired ? 'Enter the one-time password' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={newPasswordRequired}
                />
              </div>

              {newPasswordRequired && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Create a new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Confirm new password</Label>
                    <Input
                      id="confirm-new-password"
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : newPasswordRequired ? 'Set new password' : 'Sign In'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleForgotPasswordClick}
                disabled={loading || newPasswordRequired}
              >
                Forgot password?
              </Button>

              <div className="text-sm text-center text-[hsl(var(--muted-foreground))]">
                Need an account? Contact an administrator to be invited.
              </div>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
