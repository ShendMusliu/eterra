import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.name || user?.email || 'User';
  const email = user?.email ?? 'Unknown email';
  const userId = user?.id ?? 'Unknown ID';

  const handleChangePassword = () => navigate('/change-password');
  const handleGoDashboard = () => navigate('/dashboard');
  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[hsl(var(--muted-foreground))]">Account</p>
            <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Profile</h1>
            <p className="text-[hsl(var(--muted-foreground))]">View your account details and security options.</p>
          </div>
          <div className="flex gap-2">
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600"
              onClick={handleGoDashboard}
            >
              Dashboard
            </Button>
            <Button variant="ghost" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </header>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Account Info</CardTitle>
            <CardDescription>These details come from your current session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Name</span>
              <span className="text-lg font-semibold text-[hsl(var(--foreground))]">{displayName}</span>
            </div>
            <div className="grid gap-2">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Email</span>
              <span className="text-lg font-semibold text-[hsl(var(--foreground))]">{email}</span>
            </div>
            <div className="grid gap-2">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">User ID</span>
              <span className="text-sm text-[hsl(var(--muted-foreground))] break-all">{userId}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleChangePassword}>Change password</Button>
              <Button variant="outline" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
