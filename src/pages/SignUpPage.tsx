import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const { signUp, confirmSignUp, configError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(configError ?? '');
    setSuccessMessage('');

    if (needsVerification) {
      await handleVerification();
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const result = await signUp(email, password, name);
      if (result.success) {
        if (result.requiresConfirmation) {
          setNeedsVerification(true);
          setPendingEmail(email);
          setSuccessMessage('Check your email for the verification code to complete your registration.');
        } else {
          setSuccessMessage('Account created successfully! Redirecting to login...');
          setTimeout(() => {
            navigate('/login');
          }, 2000);
        }
      } else {
        setError(result.error || 'Sign up failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async () => {
    if (!pendingEmail) {
      setError('Missing email for verification.');
      return;
    }

    if (!verificationCode || verificationCode.length < 4) {
      setError('Enter the verification code sent to your email.');
      return;
    }

    setLoading(true);

    try {
      const result = await confirmSignUp(pendingEmail, verificationCode);
      if (result.success) {
        setNeedsVerification(false);
        setSuccessMessage('Email verified! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        setError(result.error || 'Verification failed');
      }
    } catch (err) {
      setError('An unexpected error occurred while verifying.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Create Account</CardTitle>
          <CardDescription className="text-center">
            Enter your information to create a new account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {(configError || error) && (
              <div className="p-3 text-sm rounded-md bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))]/20">
                {configError || error}
              </div>
            )}

            {successMessage && (
              <div className="p-3 text-sm rounded-md bg-green-500/10 text-green-600 border border-green-500/20">
                {successMessage}
              </div>
            )}

            {!needsVerification && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a password (min 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {needsVerification && (
              <div className="space-y-2">
                <Label htmlFor="verificationCode">Verification Code</Label>
                <Input
                  id="verificationCode"
                  type="text"
                  placeholder="Enter the code from your email"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Sent to <span className="font-medium">{pendingEmail}</span>
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Please wait...' : needsVerification ? 'Verify Code' : 'Sign Up'}
            </Button>

            <div className="text-sm text-center text-[hsl(var(--muted-foreground))]">
              Already have an account?{' '}
              <Link to="/login" className="text-[hsl(var(--primary))] hover:underline">
                Sign in
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
