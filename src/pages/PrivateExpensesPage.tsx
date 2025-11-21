import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { dataClient } from '@/lib/api-client';

const MEMBERS = ['Shend Musliu', 'Lorik Syla', 'Gentrit Haziri'] as const;
type MemberName = (typeof MEMBERS)[number];

type ExpenseRecord = {
  id: string;
  userId: string;
  userName: MemberName;
  description: string;
  amount: number;
  timestamp: string;
  evidenceUrl?: string;
};

type RepaymentRecord = {
  id: string;
  payerId: string;
  payerName: MemberName;
  recipientName: MemberName;
  recipientId: MemberName;
  amount: number;
  timestamp: string;
  notes?: string;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatDate = (value: string) => new Date(value).toLocaleString();
const getInitialDateInput = () => new Date().toISOString().slice(0, 16);

export default function PrivateExpensesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const canonicalizeMember = (raw?: string | null): MemberName => {
    const value = raw?.toLowerCase().trim();
    if (!value) return MEMBERS[0];
    const exact = MEMBERS.find((member) => member.toLowerCase() === value);
    if (exact) return exact;
    const match = MEMBERS.find((member) => value.includes(member.split(' ')[0].toLowerCase()));
    return match ?? MEMBERS[0];
  };

  const displayName = canonicalizeMember(user?.name ?? user?.email?.split('@')[0] ?? undefined);
  const userId = user?.id || displayName;

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [repayments, setRepayments] = useState<RepaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expenseForm, setExpenseForm] = useState({
    timestamp: getInitialDateInput(),
    description: '',
    amount: '',
    evidence: '',
  });

  const [repaymentForm, setRepaymentForm] = useState<{
    timestamp: string;
    recipient: MemberName;
    amount: string;
    notes: string;
  }>({
    timestamp: getInitialDateInput(),
    recipient: MEMBERS.find((member) => member !== displayName) ?? MEMBERS[0],
    amount: '',
    notes: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [expenseResult, repaymentResult] = await Promise.all([
          dataClient.models.PrivateExpense.list(),
          dataClient.models.PrivateRepayment.list(),
        ]);

        const normalizedExpenses =
          expenseResult?.data
            ?.map((item) => ({
              id: item.id,
              userId: item.userId,
              userName: canonicalizeMember(item.userName),
              description: item.description,
              amount: item.amount,
              timestamp: item.timestamp,
              evidenceUrl: item.evidenceUrl ?? undefined,
            }))
            .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)) ?? [];

        const normalizedRepayments =
          repaymentResult?.data
            ?.map((item) => ({
              id: item.id,
              payerId: item.payerId,
              payerName: canonicalizeMember(item.payerName),
              recipientId: canonicalizeMember(item.recipientId),
              recipientName: canonicalizeMember(item.recipientName),
              amount: item.amount,
              timestamp: item.timestamp,
              notes: item.notes ?? undefined,
            }))
            .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)) ?? [];

        setExpenses(normalizedExpenses);
        setRepayments(normalizedRepayments);
        setError(null);
      } catch (err) {
        console.error('Failed to load expenses/repayments', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const participantNames = MEMBERS;

  const summary = useMemo(() => {
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const sharePerPerson = participantNames.length > 0 ? totalExpenses / participantNames.length : 0;

    const aggregates = participantNames.reduce<Record<string, { paid: number; repaid: number; received: number }>>(
      (acc, name) => {
        acc[name] = { paid: 0, repaid: 0, received: 0 };
        return acc;
      },
      {},
    );

    expenses.forEach((expense) => {
      aggregates[expense.userName] = aggregates[expense.userName] ?? { paid: 0, repaid: 0, received: 0 };
      aggregates[expense.userName].paid += expense.amount;
    });

    repayments.forEach((repayment) => {
      aggregates[repayment.payerName] = aggregates[repayment.payerName] ?? { paid: 0, repaid: 0, received: 0 };
      aggregates[repayment.recipientName] =
        aggregates[repayment.recipientName] ?? { paid: 0, repaid: 0, received: 0 };
      aggregates[repayment.payerName].repaid += repayment.amount;
      aggregates[repayment.recipientName].received += repayment.amount;
    });

    const netBalances = participantNames.map((name) => {
      const data = aggregates[name];
      const net = (data?.paid ?? 0) + (data?.received ?? 0) - (data?.repaid ?? 0) - sharePerPerson;
      return { name, net: parseFloat(net.toFixed(2)) };
    });

    const creditors = netBalances
      .filter((entry) => entry.net > 0.01)
      .map((entry) => ({ ...entry }))
      .sort((a, b) => b.net - a.net);
    const debtors = netBalances
      .filter((entry) => entry.net < -0.01)
      .map((entry) => ({ ...entry }))
      .sort((a, b) => a.net - b.net);

    const settlements: { from: string; to: string; amount: number }[] = [];
    let creditorIndex = 0;
    let debtorIndex = 0;

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];
      const amount = Math.min(creditor.net, -debtor.net);
      settlements.push({ from: debtor.name, to: creditor.name, amount });
      creditor.net -= amount;
      debtor.net += amount;
      if (creditor.net <= 0.01) {
        creditorIndex++;
      }
      if (debtor.net >= -0.01) {
        debtorIndex++;
      }
    }

    return {
      totalExpenses,
      sharePerPerson,
      netBalances,
      settlements,
    };
  }, [expenses, repayments, participantNames]);

  const handleAddExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = parseFloat(expenseForm.amount);
    if (!amount || amount <= 0) return;

    try {
      const result = await dataClient.models.PrivateExpense.create({
        userId,
        userName: displayName,
        description: expenseForm.description.trim() || 'Business expense',
        amount,
        timestamp: expenseForm.timestamp || new Date().toISOString(),
        evidenceUrl: expenseForm.evidence.trim() || undefined,
      });
      if (result?.data) {
        setExpenses((current) => [
          {
            id: result.data.id,
            userId: result.data.userId,
            userName: canonicalizeMember(result.data.userName),
            description: result.data.description,
            amount: result.data.amount,
            timestamp: result.data.timestamp,
            evidenceUrl: result.data.evidenceUrl ?? undefined,
          },
          ...current,
        ]);
      }
      setExpenseForm({
        timestamp: getInitialDateInput(),
        description: '',
        amount: '',
        evidence: '',
      });
    } catch (err) {
      console.error('Failed to save expense', err);
      setError('Failed to save expense. Please try again.');
    }
  };

  const handleAddRepayment = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = parseFloat(repaymentForm.amount);
    if (!amount || amount <= 0) return;

    try {
      const result = await dataClient.models.PrivateRepayment.create({
        payerId: userId,
        payerName: displayName,
        recipientId: repaymentForm.recipient,
        recipientName: repaymentForm.recipient,
        amount,
        timestamp: repaymentForm.timestamp || new Date().toISOString(),
        notes: repaymentForm.notes.trim() || undefined,
      });
      if (result?.data) {
        setRepayments((current) => [
          {
            id: result.data.id,
            payerId: result.data.payerId,
            payerName: canonicalizeMember(result.data.payerName),
            recipientId: canonicalizeMember(result.data.recipientId),
            recipientName: canonicalizeMember(result.data.recipientName),
            amount: result.data.amount,
            timestamp: result.data.timestamp,
            notes: result.data.notes ?? undefined,
          },
          ...current,
        ]);
      }
      setRepaymentForm((current) => ({
        timestamp: getInitialDateInput(),
        recipient: current.recipient,
        amount: '',
        notes: '',
      }));
    } catch (err) {
      console.error('Failed to save repayment', err);
      setError('Failed to save repayment. Please try again.');
    }
  };

  const settlementsSummary =
    summary.settlements.length > 0
      ? summary.settlements
      : [
          {
            from: 'Everyone',
            to: '',
            amount: 0,
          },
        ];

  const currentBalance = summary.netBalances.find((entry) => entry.name === displayName)?.net ?? 0;

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-[hsl(var(--muted-foreground))]">eterra</p>
              <h1 className="text-3xl font-semibold">Private Expenses</h1>
              <p className="text-[hsl(var(--muted-foreground))]">
                Track personal contributions and repayments for Shend, Lorik, and Gentrit. Logged in as{' '}
                <span className="font-semibold text-[hsl(var(--foreground))]">{displayName}</span>.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => navigate(-1)}>
                Back
              </Button>
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Log Business Expense</CardTitle>
              <CardDescription>Record purchases you covered on behalf of the team.</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-3 rounded-md border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-3 text-sm text-[hsl(var(--destructive))]">
                  {error}
                </div>
              )}
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="expense-timestamp">Date & time</Label>
                  <Input
                    id="expense-timestamp"
                    type="datetime-local"
                    value={expenseForm.timestamp}
                    onChange={(event) => setExpenseForm((current) => ({ ...current, timestamp: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-description">Description</Label>
                  <Input
                    id="expense-description"
                    placeholder="Printer filament, packaging, etc."
                    value={expenseForm.description}
                    onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-amount">Amount (EUR)</Label>
                  <Input
                    id="expense-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={expenseForm.amount}
                    onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-evidence">Evidence URL (optional)</Label>
                  <Input
                    id="expense-evidence"
                    type="url"
                    placeholder="https://drive.google.com/receipt"
                    value={expenseForm.evidence}
                    onChange={(event) => setExpenseForm((current) => ({ ...current, evidence: event.target.value }))}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Save Expense
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Log Repayment</CardTitle>
              <CardDescription>Track when you reimburse Lorik or Gentrit (or vice versa).</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddRepayment} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="repayment-timestamp">Date & time</Label>
                  <Input
                    id="repayment-timestamp"
                    type="datetime-local"
                    value={repaymentForm.timestamp}
                    onChange={(event) => setRepaymentForm((current) => ({ ...current, timestamp: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repayment-recipient">Recipient</Label>
                  <select
                    id="repayment-recipient"
                    className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2"
                    value={repaymentForm.recipient}
                    onChange={(event) =>
                      setRepaymentForm((current) => ({
                        ...current,
                        recipient: event.target.value as MemberName,
                      }))
                    }
                  >
                    {MEMBERS.filter((member) => member !== displayName).map((member) => (
                      <option key={member} value={member}>
                        {member}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repayment-amount">Amount (EUR)</Label>
                  <Input
                    id="repayment-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={repaymentForm.amount}
                    onChange={(event) => setRepaymentForm((current) => ({ ...current, amount: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repayment-notes">Notes (optional)</Label>
                  <textarea
                    id="repayment-notes"
                    className="min-h-[80px] w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
                    placeholder="Reference number, cash hand-off, etc."
                    value={repaymentForm.notes}
                    onChange={(event) => setRepaymentForm((current) => ({ ...current, notes: event.target.value }))}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Save Repayment
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Automatic split across Shend, Lorik, and Gentrit.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Total expenses</p>
              <p className="text-3xl font-semibold">{formatCurrency(summary.totalExpenses)}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Share per person: {formatCurrency(summary.sharePerPerson || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Your balance</p>
              <p className="text-3xl font-semibold">
                {formatCurrency(currentBalance)}
                <span className="ml-2 text-base font-medium text-[hsl(var(--muted-foreground))]">
                  {currentBalance > 0 ? 'owed to you' : currentBalance < 0 ? 'you owe' : ''}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Participants</p>
              <div className="text-base font-medium">{participantNames.join(', ')}</div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Balances</CardTitle>
              <CardDescription>Positive values mean others owe that person.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.netBalances.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/80 px-3 py-2"
                >
                  <span className="font-medium">{entry.name}</span>
                  <span className={entry.net >= 0 ? 'text-green-600' : 'text-[hsl(var(--destructive))]'}>
                    {formatCurrency(entry.net)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Who owes whom</CardTitle>
              <CardDescription>
                Breakdown of outstanding balances based on expenses and recorded repayments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {settlementsSummary[0]?.amount === 0 ? (
                <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                  Everyone is settled up!
                </div>
              ) : (
                summary.settlements.map((entry) => (
                  <div
                    key={`${entry.from}-${entry.to}-${entry.amount}`}
                    className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--accent))]/30 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{entry.from}</span> owes{' '}
                    <span className="font-medium">{entry.to}</span> {formatCurrency(entry.amount)}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
              <CardDescription>Newest entries appear first.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                  Loading...
                </div>
              ) : expenses.length === 0 ? (
                <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                  No expenses logged yet.
                </div>
              ) : (
                expenses.slice(0, 5).map((expense) => (
                  <div
                    key={expense.id}
                    className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 p-3 shadow-sm"
                  >
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{expense.userName}</span>
                      <span className="text-[hsl(var(--muted-foreground))]">{formatDate(expense.timestamp)}</span>
                    </div>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{expense.description}</p>
                    <p className="text-lg font-semibold text-[hsl(var(--foreground))]">
                      {formatCurrency(expense.amount)}
                    </p>
                    {expense.evidenceUrl && (
                      <a
                        href={expense.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[hsl(var(--primary))] underline"
                      >
                        View evidence
                      </a>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Recent Repayments</CardTitle>
              <CardDescription>Track returned amounts between members.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                  Loading...
                </div>
              ) : repayments.length === 0 ? (
                <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                  No repayments recorded yet.
                </div>
              ) : (
                repayments.slice(0, 5).map((repayment) => (
                  <div
                    key={repayment.id}
                    className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 p-3 shadow-sm"
                  >
                    <div className="flex justify-between text-sm">
                      <span>
                        <span className="font-semibold">{repayment.payerName}</span> →{' '}
                        <span className="font-semibold">{repayment.recipientName}</span>
                      </span>
                      <span className="text-[hsl(var(--muted-foreground))]">{formatDate(repayment.timestamp)}</span>
                    </div>
                    <p className="text-lg font-semibold text-[hsl(var(--foreground))]">
                      {formatCurrency(repayment.amount)}
                    </p>
                    {repayment.notes && (
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">{repayment.notes}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
