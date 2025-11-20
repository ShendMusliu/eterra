import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <nav className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold">ETerra Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                {user?.name}
              </span>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold">Welcome back, {user?.name}!</h2>
            <p className="text-[hsl(var(--muted-foreground))] mt-2">
              Here's what's happening with your account today.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Your profile details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{user?.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">User ID</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{user?.id}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
                <CardDescription>Overview of your activity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Projects</span>
                  <span className="text-sm font-bold">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Tasks</span>
                  <span className="text-sm font-bold">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Completed</span>
                  <span className="text-sm font-bold">0</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your latest actions</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  No recent activity to display
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Start building your application</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Next Steps:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-[hsl(var(--muted-foreground))]">
                  <li>This is a mock authentication system for sandbox development</li>
                  <li>To deploy to AWS Amplify, run: <code className="bg-[hsl(var(--muted))] px-1 py-0.5 rounded">npm run amplify:sandbox</code></li>
                  <li>The Amplify backend is configured in the <code className="bg-[hsl(var(--muted))] px-1 py-0.5 rounded">amplify/</code> directory</li>
                  <li>Authentication is set up with email/password login</li>
                  <li>When ready to deploy, use AWS Amplify Gen 2 hosting</li>
                </ul>
              </div>

              <div className="pt-4">
                <Button>Start Building</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
