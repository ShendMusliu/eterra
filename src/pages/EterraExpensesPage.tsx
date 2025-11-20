
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SALE_TYPES = [
  { label: 'Privat (in-person)', value: 'Privat' },
  { label: 'GjirafaMall', value: 'GjirafaMall' },
  { label: 'Other channel', value: 'other' },
];

const PAYMENT_OPTIONS = [
  { label: 'Received', value: 'received' },
  { label: 'Pending', value: 'pending' },
];

const STORAGE_KEY = 'eterra_expenses_ledger';

interface SaleRecord {
  id: string;
  timestamp: string;
  description: string;
  amount: number;
  saleType: string;
  shippingCost?: number;
  netAfterShipping: number;
  paymentStatus: 'received' | 'pending';
  notes?: string;
  recordedById: string;
  recordedByName: string;
}

interface PurchaseRecord {
  id: string;
  timestamp: string;
  description: string;
  amount: number;
  notes?: string;
  recordedById: string;
  recordedByName: string;
}

interface Ledger {
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatDate = (value: string) => new Date(value).toLocaleString();
const getDefaultTimestamp = () => new Date().toISOString().slice(0, 16);

const getDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildTrend = <T,>(items: T[], getTimestamp: (record: T) => string, getValue: (record: T) => number) => {
  const today = new Date();
  const values = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(day.getDate() - (6 - index));
    const key = getDateKey(day);
    const total = items.reduce((sum, item) => {
      return getDateKey(getTimestamp(item)) === key ? sum + getValue(item) : sum;
    }, 0);
    return total;
  });
  const max = Math.max(...values, 1);
  return values.map((value) => (value / max) * 100);
};

export default function EterraExpensesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.name || user?.email || 'Unknown member';
  const userId = user?.id || displayName;

  const [ledger, setLedger] = useState<Ledger>({ sales: [], purchases: [] });
  const [initialized, setInitialized] = useState(false);

  const [saleForm, setSaleForm] = useState({
    timestamp: getDefaultTimestamp(),
    description: '',
    amount: '',
    saleType: SALE_TYPES[0].value,
    customSaleType: '',
    shippingCost: '',
    paymentStatus: PAYMENT_OPTIONS[0].value,
    notes: '',
  });

  const [purchaseForm, setPurchaseForm] = useState({
    timestamp: getDefaultTimestamp(),
    description: '',
    amount: '',
    notes: '',
  });

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      try {
        const parsed: Ledger = JSON.parse(stored);
        setLedger({
          sales: parsed.sales ?? [],
          purchases: parsed.purchases ?? [],
        });
      } catch (error) {
        console.error('Failed to parse eterra ledger', error);
      }
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
  }, [ledger, initialized]);

  const resolvedSaleType = saleForm.saleType === 'other'
    ? saleForm.customSaleType.trim() || 'Other'
    : saleForm.saleType;

  const saleNetPreview = Math.max(
    (parseFloat(saleForm.amount) || 0) - (parseFloat(saleForm.shippingCost) || 0),
    0,
  );

  const handleAddSale = (event: React.FormEvent) => {
    event.preventDefault();
    const amountValue = parseFloat(saleForm.amount);
    if (!amountValue || amountValue <= 0) {
      return;
    }
    const shippingValue = parseFloat(saleForm.shippingCost) || 0;
    const record: SaleRecord = {
      id: crypto.randomUUID(),
      timestamp: saleForm.timestamp || new Date().toISOString(),
      description: saleForm.description.trim() || 'Sale',
      amount: amountValue,
      saleType: resolvedSaleType,
      shippingCost: shippingValue || undefined,
      netAfterShipping: Math.max(amountValue - shippingValue, 0),
      paymentStatus: saleForm.paymentStatus as 'received' | 'pending',
      notes: saleForm.notes.trim() || undefined,
      recordedById: userId,
      recordedByName: displayName,
    };
    setLedger((previous) => ({
      ...previous,
      sales: [record, ...previous.sales],
    }));
    setSaleForm({
      timestamp: getDefaultTimestamp(),
      description: '',
      amount: '',
      saleType: SALE_TYPES[0].value,
      customSaleType: '',
      shippingCost: '',
      paymentStatus: PAYMENT_OPTIONS[0].value,
      notes: '',
    });
  };

  const handleAddPurchase = (event: React.FormEvent) => {
    event.preventDefault();
    const amountValue = parseFloat(purchaseForm.amount);
    if (!amountValue || amountValue <= 0) {
      return;
    }
    const record: PurchaseRecord = {
      id: crypto.randomUUID(),
      timestamp: purchaseForm.timestamp || new Date().toISOString(),
      description: purchaseForm.description.trim() || 'Purchase',
      amount: amountValue,
      notes: purchaseForm.notes.trim() || undefined,
      recordedById: userId,
      recordedByName: displayName,
    };
    setLedger((previous) => ({
      ...previous,
      purchases: [record, ...previous.purchases],
    }));
    setPurchaseForm({
      timestamp: getDefaultTimestamp(),
      description: '',
      amount: '',
      notes: '',
    });
  };

  const summary = useMemo(() => {
    const now = new Date();
    const isCurrentMonth = (timestamp: string) => {
      const date = new Date(timestamp);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    };

    const monthlySales = ledger.sales.filter((sale) => isCurrentMonth(sale.timestamp));
    const monthlyPurchases = ledger.purchases.filter((purchase) => isCurrentMonth(purchase.timestamp));

    const monthlyRevenue = monthlySales.reduce((sum, sale) => sum + sale.netAfterShipping, 0);
    const pendingReceivables = ledger.sales
      .filter((sale) => sale.paymentStatus === 'pending')
      .reduce((sum, sale) => sum + sale.netAfterShipping, 0);
    const monthlySpend = monthlyPurchases.reduce((sum, purchase) => sum + purchase.amount, 0);
    const shippingCostsMonth = monthlySales.reduce((sum, sale) => sum + (sale.shippingCost ?? 0), 0);

    const totalReceived = ledger.sales
      .filter((sale) => sale.paymentStatus === 'received')
      .reduce((sum, sale) => sum + sale.netAfterShipping, 0);
    const totalPurchases = ledger.purchases.reduce((sum, purchase) => sum + purchase.amount, 0);
    const cashBox = totalReceived - totalPurchases;

    const channelTotals = monthlySales.reduce<Record<string, number>>((acc, sale) => {
      acc[sale.saleType] = (acc[sale.saleType] || 0) + sale.netAfterShipping;
      return acc;
    }, {});

    const channelBreakdown = Object.entries(channelTotals)
      .map(([channel, value]) => ({
        channel,
        value,
      }))
      .sort((a, b) => b.value - a.value);

    const bestSale = ledger.sales.reduce<SaleRecord | null>((current, sale) => {
      if (!current || sale.netAfterShipping > current.netAfterShipping) {
        return sale;
      }
      return current;
    }, null);

    const revenueTrend = buildTrend(ledger.sales, (sale) => sale.timestamp, (sale) => sale.netAfterShipping);
    const pendingTrend = buildTrend(
      ledger.sales.filter((sale) => sale.paymentStatus === 'pending'),
      (sale) => sale.timestamp,
      (sale) => sale.netAfterShipping,
    );
    const spendTrend = buildTrend(ledger.purchases, (purchase) => purchase.timestamp, (purchase) => purchase.amount);

    return {
      monthlyRevenue,
      monthlySalesCount: monthlySales.length,
      pendingReceivables,
      monthlySpend,
      shippingCostsMonth,
      cashBox,
      channelBreakdown,
      bestSale,
      revenueTrend,
      pendingTrend,
      spendTrend,
    };
  }, [ledger]);

  const actionItems = useMemo(() => {
    const tasks: string[] = [];
    if (summary.pendingReceivables > 0) {
      tasks.push('Follow up on pending invoices to turn them into cash.');
    }
    if (summary.shippingCostsMonth > summary.monthlyRevenue * 0.2) {
      tasks.push('Shipping is consuming more than 20% of net revenue this month. Double-check carrier rates.');
    }
    if ((summary.bestSale?.netAfterShipping || 0) > summary.monthlyRevenue * 0.4) {
      tasks.push('One sale makes up a large share of revenue. Diversify channels to reduce risk.');
    }
    if (!tasks.length) {
      tasks.push('Everything is on track. Keep logging sales and purchases for accurate reporting.');
    }
    return tasks;
  }, [summary]);

  const recentSales = ledger.sales.slice(0, 5);
  const recentPurchases = ledger.purchases.slice(0, 5);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-[hsl(var(--muted-foreground))]">eterra</p>
              <h1 className="text-3xl font-semibold">eterra Expenses</h1>
              <p className="text-[hsl(var(--muted-foreground))]">
                Centralize sales, receivables, and business purchases. Logged in as{' '}
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

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="Revenue this month"
            value={formatCurrency(summary.monthlyRevenue)}
            subtitle={`${summary.monthlySalesCount} logged sales`}
            trend={summary.revenueTrend}
            accent="from-[hsl(var(--primary))]/70 to-transparent"
          />
          <MetricCard
            title="Pending receivables"
            value={formatCurrency(summary.pendingReceivables)}
            subtitle="Waiting to be collected"
            trend={summary.pendingTrend}
            accent="from-orange-400/60 to-transparent"
          />
          <MetricCard
            title="Cash box after spend"
            value={formatCurrency(summary.cashBox)}
            subtitle={summary.monthlySpend ? `${formatCurrency(summary.monthlySpend)} spent this month` : 'No spend recorded this month'}
            trend={summary.spendTrend}
            accent="from-emerald-400/60 to-transparent"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Log sale or receivable</CardTitle>
              <CardDescription>Capture every sale, shipping cost, and payment status.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleAddSale}>
                <div className="space-y-2">
                  <Label htmlFor="sale-timestamp">Date & time</Label>
                  <Input
                    id="sale-timestamp"
                    type="datetime-local"
                    value={saleForm.timestamp}
                    onChange={(event) => setSaleForm((current) => ({ ...current, timestamp: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sale-description">Description</Label>
                  <Input
                    id="sale-description"
                    placeholder="Product, SKU, or client"
                    value={saleForm.description}
                    onChange={(event) => setSaleForm((current) => ({ ...current, description: event.target.value }))}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sale-amount">Amount (EUR)</Label>
                    <Input
                      id="sale-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={saleForm.amount}
                      onChange={(event) => setSaleForm((current) => ({ ...current, amount: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sale-shipping">Shipping cost (EUR)</Label>
                    <Input
                      id="sale-shipping"
                      type="number"
                      min="0"
                      step="0.01"
                      value={saleForm.shippingCost}
                      placeholder="0"
                      onChange={(event) => setSaleForm((current) => ({ ...current, shippingCost: event.target.value }))}
                    />
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Net after shipping: <span className="font-semibold text-[hsl(var(--foreground))]">{formatCurrency(saleNetPreview)}</span>
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sale-type">Sale type</Label>
                    <select
                      id="sale-type"
                      className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2"
                      value={saleForm.saleType}
                      onChange={(event) => setSaleForm((current) => ({ ...current, saleType: event.target.value }))}
                    >
                      {SALE_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment-status">Payment status</Label>
                    <select
                      id="payment-status"
                      className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2"
                      value={saleForm.paymentStatus}
                      onChange={(event) => setSaleForm((current) => ({ ...current, paymentStatus: event.target.value }))}
                    >
                      {PAYMENT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {saleForm.saleType === 'other' && (
                  <div className="space-y-2">
                    <Label htmlFor="sale-custom-type">Custom sale channel</Label>
                    <Input
                      id="sale-custom-type"
                      placeholder="Enter channel name"
                      value={saleForm.customSaleType}
                      onChange={(event) => setSaleForm((current) => ({ ...current, customSaleType: event.target.value }))}
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="sale-notes">Notes (optional)</Label>
                  <textarea
                    id="sale-notes"
                    className="min-h-[80px] w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
                    placeholder="Reference, invoice number, etc."
                    value={saleForm.notes}
                    onChange={(event) => setSaleForm((current) => ({ ...current, notes: event.target.value }))}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Save Sale
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Log purchase paid by eterra</CardTitle>
                <CardDescription>Track supplies bought directly from the cash box.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleAddPurchase}>
                  <div className="space-y-2">
                    <Label htmlFor="purchase-timestamp">Date & time</Label>
                    <Input
                      id="purchase-timestamp"
                      type="datetime-local"
                      value={purchaseForm.timestamp}
                      onChange={(event) => setPurchaseForm((current) => ({ ...current, timestamp: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purchase-description">Description</Label>
                    <Input
                      id="purchase-description"
                      placeholder="Packaging, filament, shipping labels, etc."
                      value={purchaseForm.description}
                      onChange={(event) => setPurchaseForm((current) => ({ ...current, description: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purchase-amount">Amount (EUR)</Label>
                    <Input
                      id="purchase-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={purchaseForm.amount}
                      onChange={(event) => setPurchaseForm((current) => ({ ...current, amount: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purchase-notes">Notes (optional)</Label>
                    <textarea
                      id="purchase-notes"
                      className="min-h-[80px] w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
                      placeholder="Supplier, receipt link, justification"
                      value={purchaseForm.notes}
                      onChange={(event) => setPurchaseForm((current) => ({ ...current, notes: event.target.value }))}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Save Purchase
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>Operational checklist</CardTitle>
                <CardDescription>Quick reminders based on this month's activity.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
                  {actionItems.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Channel breakdown (current month)</CardTitle>
              <CardDescription>Compare how each channel performs after shipping costs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.channelBreakdown.length === 0 ? (
                <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                  No sales recorded this month yet.
                </p>
              ) : (
                summary.channelBreakdown.map(({ channel, value }) => {
                  const totalMonth = summary.channelBreakdown.reduce((sum, entry) => sum + entry.value, 0);
                  const percentage = totalMonth ? Math.round((value / totalMonth) * 100) : 0;
                  return (
                    <div key={channel} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{channel}</span>
                        <span className="text-[hsl(var(--muted-foreground))]">
                          {formatCurrency(value)} · {percentage}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[hsl(var(--muted))]/40">
                        <div
                          className="h-full rounded-full bg-[hsl(var(--primary))]"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Largest recorded sale</CardTitle>
              <CardDescription>Useful for understanding dependency on big clients.</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.bestSale ? (
                <div className="space-y-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-4">
                  <div className="flex items-center justify-between text-sm text-[hsl(var(--muted-foreground))]">
                    <span>{formatDate(summary.bestSale.timestamp)}</span>
                    <span>{summary.bestSale.saleType}</span>
                  </div>
                  <p className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                    {formatCurrency(summary.bestSale.netAfterShipping)}
                  </p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Recorded by {summary.bestSale.recordedByName}
                  </p>
                  {summary.bestSale.notes && (
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{summary.bestSale.notes}</p>
                  )}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                  Log a sale to highlight it here.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Recent sales</CardTitle>
              <CardDescription>Newest entries first. Includes pending receivables.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentSales.length === 0 ? (
                <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                  No sales logged yet.
                </p>
              ) : (
                recentSales.map((sale) => (
                  <article key={sale.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{sale.description}</span>
                      <span className={`text-xs uppercase tracking-[0.2em] ${sale.paymentStatus === 'pending' ? 'text-[hsl(var(--destructive))]' : 'text-emerald-600'}`}>
                        {sale.paymentStatus === 'pending' ? 'Pending' : 'Received'}
                      </span>
                    </div>
                    <p className="text-lg font-semibold">{formatCurrency(sale.netAfterShipping)}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      {sale.saleType} · {formatDate(sale.timestamp)} · recorded by {sale.recordedByName}
                    </p>
                    {sale.notes && <p className="text-sm text-[hsl(var(--muted-foreground))]">{sale.notes}</p>}
                  </article>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Recent purchases</CardTitle>
              <CardDescription>Track outgoing cash to keep the box healthy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentPurchases.length === 0 ? (
                <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                  No purchases logged yet.
                </p>
              ) : (
                recentPurchases.map((purchase) => (
                  <article key={purchase.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{purchase.description}</span>
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">{formatDate(purchase.timestamp)}</span>
                    </div>
                    <p className="text-lg font-semibold">{formatCurrency(purchase.amount)}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Recorded by {purchase.recordedByName}</p>
                    {purchase.notes && <p className="text-sm text-[hsl(var(--muted-foreground))]">{purchase.notes}</p>}
                  </article>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  trend,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  trend: number[];
  accent: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{title}</CardTitle>
        <p className="text-2xl font-semibold text-[hsl(var(--foreground))]">{value}</p>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`flex h-16 items-end gap-1 rounded-xl bg-[hsl(var(--muted))]/30 p-2`}>
          {trend.map((height, index) => (
            <span
              key={index}
              className={`flex-1 rounded-full bg-gradient-to-t ${accent}`}
              style={{ height: `${Math.max(height, 8)}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
