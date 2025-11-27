import { useState } from 'react';
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

  const handleOpenPrivateExpenses = () => navigate('/private-expenses');
  const handleOpenCalculator = () => navigate('/calculator');
  const handleOpenEterraExpenses = () => navigate('/eterra-expenses');
  const handleOpenProfile = () => navigate('/profile');

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <nav className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-4">
              <span className="font-brand text-3xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
                eterra.
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                className="flex items-center gap-2 px-2 py-1 text-[hsl(var(--foreground))]"
                onClick={handleOpenProfile}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--primary))]/15 text-sm font-semibold text-[hsl(var(--primary))] uppercase">
                  {displayName.slice(0, 2)}
                </span>
                <div className="text-left leading-tight">
                  <div className="text-sm font-semibold">{displayName}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">View profile</div>
                </div>
              </Button>
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
                <Button
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600"
                  onClick={handleOpenEterraExpenses}
                >
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
                <Button
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600"
                  onClick={handleOpenPrivateExpenses}
                >
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
                  Run quick financial calculations before 3D printing.
                </p>
                <Button
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600"
                  onClick={handleOpenCalculator}
                >
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
