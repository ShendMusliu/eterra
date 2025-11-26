import { useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getTiranaNowDateTimeLocal } from '@/lib/timezone';

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const displayName = user?.name || user?.email || 'User';
  const navigate = useNavigate();
  const [reminderForm, setReminderForm] = useState({
    message: '',
    recipient: '',
    when: getTiranaNowDateTimeLocal(),
  });
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleOpenPrivateExpenses = () => navigate('/private-expenses');
  const handleOpenCalculator = () => navigate('/calculator');
  const handleOpenEterraExpenses = () => navigate('/eterra-expenses');
  const handleOpenProfile = () => navigate('/profile');

  const handleReminderSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reminderForm.message.trim() || !reminderForm.recipient || !reminderForm.when) {
      setReminderStatus('Fill the message, number, and date/time.');
      return;
    }

    try {
      const session = await fetchAuthSession();
      const token = session?.tokens?.accessToken?.toString();

      const response = await fetch('/reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: reminderForm.message.trim(),
          recipient: reminderForm.recipient,
          when: reminderForm.when,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Request failed');
      }

      setReminderStatus('Reminder sent to WhatsApp (backend success).');
      setReminderForm((prev) => ({ ...prev, message: '' }));
    } catch (error: any) {
      console.error('Failed to send reminder', error);
      setReminderStatus(error?.message || 'Failed to send reminder');
    }
  };

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

            <Card className="hover:shadow-lg transition-shadow lg:col-span-3">
              <CardHeader>
                <CardTitle>Set Reminder (WhatsApp)</CardTitle>
                <CardDescription>
                  Create a reminder with text, choose the number and date. (Needs Twilio backend connection to send.)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleReminderSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="reminder-message">Reminder text</Label>
                    <textarea
                      id="reminder-message"
                      className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
                      placeholder="E.g. follow up open orders"
                      value={reminderForm.message}
                      onChange={(e) => setReminderForm((prev) => ({ ...prev, message: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="reminder-recipient">Recipient</Label>
                      <select
                        id="reminder-recipient"
                        className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2"
                        value={reminderForm.recipient}
                        onChange={(e) => setReminderForm((prev) => ({ ...prev, recipient: e.target.value }))}
                        required
                      >
                        <option value="" disabled>
                          Zgjidh numrin
                        </option>
                        <option value="+38349488774">Shend (+38349488774)</option>
                        <option value="+38349101261">Lorik (+38349101261)</option>
                        <option value="+38345963301">Gentrit (+38345963301)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reminder-when">Date & time (Tirane)</Label>
                      <Input
                        id="reminder-when"
                        type="datetime-local"
                        value={reminderForm.when}
                        onChange={(e) => setReminderForm((prev) => ({ ...prev, when: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">
                    Set Reminder
                  </Button>
                  {reminderStatus && (
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{reminderStatus}</p>
                  )}
                </form>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
}
