import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { assertNoDataErrors, dataClient, ensureAuthSession } from '@/lib/api-client';

type Sale = {
  id: string;
  description: string;
  saleType: string;
  amount: number;
  shippingCost?: number;
  netAfterShipping: number;
  paymentStatus: string; // 'pending' | 'received'
  recordedById: string;
  recordedByName: string;
  notes?: string;
  timestamp: string;
};

type Purchase = {
  id: string;
  description: string;
  amount: number;
  timestamp: string;
  recordedById: string;
  recordedByName: string;
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

export default function EterraExpensesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.name || user?.email || 'Unknown member';
  const userId = user?.id || displayName;

  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [saleForm, setSaleForm] = useState({
    timestamp: getInitialDateInput(),
    description: '',
    amount: '',
    saleType: 'Privat',
    customSaleType: '',
    shippingCost: '',
    paymentStatus: 'pending',
    notes: '',
  });

  const [purchaseForm, setPurchaseForm] = useState({
    timestamp: getInitialDateInput(),
    description: '',
    amount: '',
    notes: '',
  });

  const [saleStatusFilter, setSaleStatusFilter] = useState<'all' | 'pending' | 'received'>('all');
  const [saleSearch, setSaleSearch] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [confirmSaleId, setConfirmSaleId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false);
        navigate('/login');
        return;
      }

      try {
        await ensureAuthSession();
        setLoading(true);
        const models = dataClient.models as Record<string, any>;
        const saleModel = models['EterraSale'];
        const purchaseModel = models['EterraPurchase'];

        const [salesResult, purchasesResult] = await Promise.all([
          saleModel?.list?.({ authMode: 'userPool' }) ?? { data: [] },
          purchaseModel?.list?.({ authMode: 'userPool' }) ?? { data: [] },
        ]);
        assertNoDataErrors(salesResult);
        assertNoDataErrors(purchasesResult);

        const normalizedSales =
          salesResult?.data
            ?.map((item: any) => ({
              id: item.id,
              description: item.description,
              saleType: item.saleType,
              amount: item.amount,
              shippingCost: item.shippingCost ?? 0,
              netAfterShipping: item.netAfterShipping,
              paymentStatus: item.paymentStatus ?? 'pending',
              recordedById: item.recordedById,
              recordedByName: item.recordedByName,
              notes: item.notes ?? undefined,
              timestamp: item.timestamp,
            }))
            .sort((a: Sale, b: Sale) => (a.timestamp < b.timestamp ? 1 : -1)) ?? [];

        const normalizedPurchases =
          purchasesResult?.data
            ?.map((item: any) => ({
              id: item.id,
              description: item.description,
              amount: item.amount,
              timestamp: item.timestamp,
              recordedById: item.recordedById,
              recordedByName: item.recordedByName,
              notes: item.notes ?? undefined,
            }))
            .sort((a: Purchase, b: Purchase) => (a.timestamp < b.timestamp ? 1 : -1)) ?? [];

        setSales(normalizedSales);
        setPurchases(normalizedPurchases);
        setError(null);
      } catch (err) {
        console.error('Failed to load data', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [user, navigate]);

  const summary = useMemo(() => {
    const now = new Date();
    const isCurrentMonth = (timestamp: string) => {
      const date = new Date(timestamp);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    };

    const monthlySales = sales.filter((sale) => isCurrentMonth(sale.timestamp));
    const monthlyPurchases = purchases.filter((purchase) => isCurrentMonth(purchase.timestamp));

    const monthlyRevenue = monthlySales.reduce((sum, sale) => sum + sale.netAfterShipping, 0);
    const pendingReceivables = monthlySales
      .filter((sale) => sale.paymentStatus === 'pending')
      .reduce((sum, sale) => sum + sale.netAfterShipping, 0);
    const monthlySpend = monthlyPurchases.reduce((sum, purchase) => sum + purchase.amount, 0);
    const shippingCostsMonth = monthlySales.reduce((sum, sale) => sum + (sale.shippingCost ?? 0), 0);

    const totalReceived = sales
      .filter((sale) => sale.paymentStatus === 'received')
      .reduce((sum, sale) => sum + sale.netAfterShipping, 0);
    const totalPurchases = purchases.reduce((sum, purchase) => sum + purchase.amount, 0);
    const cashBox = totalReceived - totalPurchases;

    const bestSale = sales.reduce<Sale | null>((current, sale) => {
      if (!current || sale.netAfterShipping > current.netAfterShipping) {
        return sale;
      }
      return current;
    }, null);

    // Build tiny trend arrays for sparklines
    const orderedMonthlySales = [...monthlySales].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const orderedMonthlyPurchases = [...monthlyPurchases].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const revenueTrend = orderedMonthlySales.slice(-10).map((sale) => sale.netAfterShipping);
    const pendingTrend = orderedMonthlySales.filter((sale) => sale.paymentStatus === 'pending').slice(-10).map((sale) => sale.netAfterShipping);
    const cashBoxTrend: number[] = [];
    let runningCash = 0;
    const combined = [
      ...orderedMonthlySales.map((sale) => ({ ts: sale.timestamp, delta: sale.netAfterShipping })),
      ...orderedMonthlyPurchases.map((purchase) => ({ ts: purchase.timestamp, delta: -purchase.amount })),
    ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    combined.forEach((entry) => {
      runningCash += entry.delta;
      cashBoxTrend.push(runningCash);
    });

    return {
      monthlyRevenue,
      pendingReceivables,
      monthlySpend,
      shippingCostsMonth,
      cashBox,
      bestSale,
      revenueTrend,
      pendingTrend,
      cashBoxTrend,
    };
  }, [sales, purchases]);

  const handleMarkReceived = async (saleId: string) => {
    try {
      const models = dataClient.models as Record<string, any>;
      const saleModel = models['EterraSale'];
      const result = await saleModel?.update?.(
        {
          id: saleId,
          paymentStatus: 'received',
        },
        { authMode: 'userPool' }
      );
      assertNoDataErrors(result);
      if (result?.data) {
        setSales((current) =>
          current.map((sale) => (sale.id === saleId ? { ...sale, paymentStatus: 'received' } : sale))
        );
      }
    } catch (err) {
      console.error('Failed to mark sale as received', err);
      setError('Could not update payment status. Please try again.');
    } finally {
      setConfirmSaleId(null);
    }
  };

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const matchesStatus =
        saleStatusFilter === 'all' ? true : sale.paymentStatus === saleStatusFilter;
      const query = saleSearch.toLowerCase();
      const matchesQuery =
        !query ||
        sale.description.toLowerCase().includes(query) ||
        sale.recordedByName.toLowerCase().includes(query) ||
        sale.saleType.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [sales, saleStatusFilter, saleSearch]);

  const filteredPurchases = useMemo(() => {
    const query = purchaseSearch.toLowerCase();
    return purchases.filter((purchase) => {
      if (!query) return true;
      return (
        purchase.description.toLowerCase().includes(query) ||
        purchase.recordedByName.toLowerCase().includes(query)
      );
    });
  }, [purchases, purchaseSearch]);

  const handleAddSale = async (event: React.FormEvent) => {
    event.preventDefault();
    const amountValue = parseFloat(saleForm.amount);
    if (!amountValue || amountValue <= 0) return;
    const shippingValue = parseFloat(saleForm.shippingCost) || 0;
    const saleType =
      saleForm.saleType === 'other'
        ? saleForm.customSaleType.trim() || 'Other'
        : saleForm.saleType || 'Privat';

    try {
      // Convert datetime-local format (YYYY-MM-DDTHH:mm) to ISO 8601 with seconds
      const timestampISO = saleForm.timestamp
        ? new Date(saleForm.timestamp).toISOString()
        : new Date().toISOString();

      const models = dataClient.models as Record<string, any>;
      const saleModel = models['EterraSale'];
      const result = await saleModel?.create?.(
        {
          description: saleForm.description.trim() || 'Sale',
          saleType,
          amount: amountValue,
          shippingCost: shippingValue || undefined,
          netAfterShipping: Math.max(amountValue - shippingValue, 0),
          paymentStatus: saleForm.paymentStatus,
          recordedById: userId,
          recordedByName: displayName,
          notes: saleForm.notes.trim() || undefined,
          timestamp: timestampISO,
        },
        { authMode: 'userPool' }
      );
      assertNoDataErrors(result);

      if (result?.data) {
        setSales((current) => [
          {
            id: result.data.id,
            description: result.data.description,
            saleType: result.data.saleType,
            amount: result.data.amount,
            shippingCost: result.data.shippingCost ?? 0,
            netAfterShipping: result.data.netAfterShipping,
            paymentStatus: result.data.paymentStatus,
            recordedById: result.data.recordedById,
            recordedByName: result.data.recordedByName,
            notes: result.data.notes ?? undefined,
            timestamp: result.data.timestamp,
          },
          ...current,
        ]);
      }

      setSaleForm({
        timestamp: getInitialDateInput(),
        description: '',
        amount: '',
        saleType: 'Privat',
        customSaleType: '',
        shippingCost: '',
        paymentStatus: 'pending',
        notes: '',
      });
    } catch (err) {
      console.error('Failed to save sale', err);
      setError('Failed to save sale. Please try again.');
    }
  };

  const handleAddPurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    const amountValue = parseFloat(purchaseForm.amount);
    if (!amountValue || amountValue <= 0) return;

    try {
      // Convert datetime-local format (YYYY-MM-DDTHH:mm) to ISO 8601 with seconds
      const timestampISO = purchaseForm.timestamp
        ? new Date(purchaseForm.timestamp).toISOString()
        : new Date().toISOString();

      const models = dataClient.models as Record<string, any>;
      const purchaseModel = models['EterraPurchase'];
      const result = await purchaseModel?.create?.(
        {
          description: purchaseForm.description.trim() || 'Purchase',
          amount: amountValue,
          timestamp: timestampISO,
          recordedById: userId,
          recordedByName: displayName,
          notes: purchaseForm.notes.trim() || undefined,
        },
        { authMode: 'userPool' }
      );
      assertNoDataErrors(result);

      if (result?.data) {
        setPurchases((current) => [
          {
            id: result.data.id,
            description: result.data.description,
            amount: result.data.amount,
            timestamp: result.data.timestamp,
            recordedById: result.data.recordedById,
            recordedByName: result.data.recordedByName,
            notes: result.data.notes ?? undefined,
          },
          ...current,
        ]);
      }

      setPurchaseForm({
        timestamp: getInitialDateInput(),
        description: '',
        amount: '',
        notes: '',
      });
    } catch (err) {
      console.error('Failed to save purchase', err);
      setError('Failed to save purchase. Please try again.');
    }
  };

  const saleNetPreview = Math.max(
    (parseFloat(saleForm.amount) || 0) - (parseFloat(saleForm.shippingCost) || 0),
    0,
  );

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

        <section className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
          <MetricCard
            title="Revenue this month"
            value={formatCurrency(summary.monthlyRevenue)}
            subtitle={`${sales.length} logged sales`}
            trendData={summary.revenueTrend}
          />
          <MetricCard
            title="Pending receivables"
            value={formatCurrency(summary.pendingReceivables)}
            subtitle="Waiting to be collected"
            trendData={summary.pendingTrend}
          />
          <MetricCard
            title="Cash box after spend"
            value={formatCurrency(summary.cashBox)}
            subtitle={
              summary.monthlySpend
                ? `${formatCurrency(summary.monthlySpend)} spent this month`
                : 'No spend recorded this month'
            }
            trendData={summary.cashBoxTrend}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Log sale or receivable</CardTitle>
              <CardDescription>Capture every sale, shipping cost, and payment status.</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-3 rounded-md border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-3 text-sm text-[hsl(var(--destructive))]">
                  {error}
                </div>
              )}
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
                <div className="grid gap-4 sm:grid-cols-1">
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
                      Net after shipping:{' '}
                      <span className="font-semibold text-[hsl(var(--foreground))]">{formatCurrency(saleNetPreview)}</span>
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-1">
                  <div className="space-y-2">
                    <Label htmlFor="sale-type">Sale type</Label>
                    <select
                      id="sale-type"
                      className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2"
                      value={saleForm.saleType}
                      onChange={(event) => setSaleForm((current) => ({ ...current, saleType: event.target.value }))}
                    >
                      <option value="Privat">Privat (in-person)</option>
                      <option value="GjirafaMall">GjirafaMall</option>
                      <option value="other">Other channel</option>
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
                      <option value="pending">Pending</option>
                      <option value="received">Received</option>
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
                  {summary.pendingReceivables > 0 && (
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />
                      <span>Follow up on pending invoices to turn them into cash.</span>
                    </li>
                  )}
                  {summary.shippingCostsMonth > summary.monthlyRevenue * 0.2 && (
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />
                      <span>Shipping is consuming more than 20% of net revenue this month. Double-check carrier rates.</span>
                    </li>
                  )}
                  {!summary.pendingReceivables && summary.shippingCostsMonth <= summary.monthlyRevenue * 0.2 && (
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />
                      <span>Everything is on track. Keep logging sales and purchases for accurate reporting.</span>
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
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

        <section className="grid gap-6 lg:grid-cols-1">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Recent sales</CardTitle>
              <CardDescription>Newest entries first. Includes pending receivables.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label htmlFor="sale-status-filter" className="text-sm text-[hsl(var(--muted-foreground))]">
                    Sales status
                  </Label>
                  <select
                    id="sale-status-filter"
                    className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
                    value={saleStatusFilter}
                    onChange={(e) => setSaleStatusFilter(e.target.value as 'all' | 'pending' | 'received')}
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="received">Received</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="sale-search" className="text-sm text-[hsl(var(--muted-foreground))]">
                    Search sales
                  </Label>
                  <Input
                    id="sale-search"
                    className="mt-1"
                    placeholder="Description, channel, recorder"
                    value={saleSearch}
                    onChange={(e) => setSaleSearch(e.target.value)}
                  />
                </div>
              </div>
              {loading ? (
                <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                  Loading...
                </p>
              ) : filteredSales.length === 0 ? (
                <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                  No sales logged yet.
                </p>
              ) : (
                filteredSales.slice(0, 5).map((sale) => (
                  <article key={sale.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{sale.description}</span>
                      {sale.paymentStatus === "pending" ? (
                        <button
                          type="button"
                          className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--destructive))] underline-offset-4 hover:underline"
                          onClick={() => setConfirmSaleId(sale.id)}
                        >
                          Pending
                        </button>
                      ) : (
                        <span className="text-xs uppercase tracking-[0.2em] text-emerald-600">Received</span>
                      )}
                    </div>
                    <p className="text-lg font-semibold">{formatCurrency(sale.netAfterShipping)}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      {sale.saleType} – {formatDate(sale.timestamp)} – recorded by {sale.recordedByName}
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
              <div>
                <Label htmlFor="purchase-search" className="text-sm text-[hsl(var(--muted-foreground))]">
                  Search purchases
                </Label>
                <Input
                  id="purchase-search"
                  className="mt-1"
                  placeholder="Description or recorder"
                  value={purchaseSearch}
                  onChange={(e) => setPurchaseSearch(e.target.value)}
                />
              </div>

              {loading ? (
                <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                  Loading...
                </p>
              ) : filteredPurchases.length === 0 ? (
                <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                  No purchases logged yet.
                </p>
              ) : (
                filteredPurchases.slice(0, 5).map((purchase) => (
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

      {confirmSaleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Mark as received?</h3>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              Confirm you received payment for this sale. This will switch the status from Pending to Received.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmSaleId(null)}>
                Cancel
              </Button>
              <Button onClick={() => confirmSaleId && handleMarkReceived(confirmSaleId)}>
                Mark received
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  trendData,
}: {
  title: string;
  value: string;
  subtitle: string;
  trendData?: number[];
}) {
  const sparkPoints = trendData && trendData.length > 0 ? trendData : [0];
  const max = Math.max(...sparkPoints, 1);
  const width = 140;
  const height = 48;
  const step = sparkPoints.length > 1 ? width / (sparkPoints.length - 1) : width;
  const path = sparkPoints
    .map((point, index) => {
      const x = index * step;
      const y = height - (point / max) * (height - 6);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{title}</CardTitle>
        <p className="text-2xl font-semibold text-[hsl(var(--foreground))]">{value}</p>
        <CardDescription>{subtitle}</CardDescription>
        <div className="mt-2 rounded-md bg-[hsl(var(--muted))]/50 p-2">
          <svg width={width} height={height} role="presentation">
            <path
              d={`${path} L ${width} ${height} L 0 ${height} Z`}
              fill="url(#spark-gradient)"
              opacity="0.3"
            />
            <path d={path} stroke="hsl(var(--primary))" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <defs>
              <linearGradient id="spark-gradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </CardHeader>
    </Card>
  );
}











