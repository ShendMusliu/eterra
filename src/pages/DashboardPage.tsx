import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const displayName = user?.name || user?.email || 'User';
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleOpenCalculator = () => {
    navigate('/calculator');
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <nav className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold">eterra Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                {displayName}
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
            <h2 className="text-3xl font-bold">Welcome back, {displayName}!</h2>
            <p className="text-[hsl(var(--muted-foreground))] mt-2">
              Here's what's happening with your account today.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>eterra Expenses</CardTitle>
                <CardDescription>Track company spending</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  View, categorize, and approve expenses tied to the eterra account.
                </p>
                <Button variant="outline" className="w-full">
                  Open eterra Expenses
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>Privat Expenses</CardTitle>
                <CardDescription>Manage personal costs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Keep personal spending separate while still tracking totals and receipts.
                </p>
                <Button variant="outline" className="w-full">
                  Open Privat Expenses
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>Calculator</CardTitle>
                <CardDescription>Estimate budgets quickly</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Run quick financial calculations before committing to a purchase.
                </p>
                <Button variant="outline" className="w-full" onClick={handleOpenCalculator}>
                  Open Calculator
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
