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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, completeNewPassword, configError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(configError ?? '');
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
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
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

            <div className="text-sm text-center text-[hsl(var(--muted-foreground))]">
              Need an account? Contact an administrator to be invited.
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
