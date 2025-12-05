import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { assertNoDataErrors, dataClient, ensureAuthSession } from '@/lib/api-client';
import { formatTiranaDateTime, getTiranaDateParts, getTiranaNowDateTimeLocal, toISOInTirana } from '@/lib/timezone';

type ProcessStatus = 'to_be_printed' | 'for_shipping' | 'delivering' | 'completed';

type Sale = {
  id: string;
  description: string;
  saleType: string;
  amount: number;
  shippingCost?: number;
  netAfterShipping: number;
  paymentStatus: ProcessStatus;
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

type SaleHistory = {
  id: string;
  saleId: string;
  field: string;
  oldValue?: string;
  newValue?: string;
  changeType: string;
  changedById: string;
  changedByName: string;
  timestamp: string;
};

const PROCESS_STATUS_OPTIONS: { value: ProcessStatus; label: string }[] = [
  { value: 'to_be_printed', label: 'To be printed' },
  { value: 'for_shipping', label: 'For shipping' },
  { value: 'delivering', label: 'Delivering' },
  { value: 'completed', label: 'Completed' },
];

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatDate = (value: string) => formatTiranaDateTime(value);
const getInitialDateInput = () => getTiranaNowDateTimeLocal();
const formatProcessStatus = (status: ProcessStatus) =>
  PROCESS_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;

const mapLegacyStatus = (status: string | null | undefined): ProcessStatus => {
  if (status === 'pending') return 'delivering';
  if (status === 'waiting') return 'for_shipping';
  if (status === 'received') return 'completed';
  if (status === 'to_be_printed' || status === 'for_shipping' || status === 'delivering' || status === 'completed') {
    return status;
  }
  return 'to_be_printed';
};

export default function EterraExpensesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.name || user?.email || 'Unknown member';
  const userId = user?.id || displayName;

  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [saleHistories, setSaleHistories] = useState<Record<string, SaleHistory[]>>({});
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editingSaleForm, setEditingSaleForm] = useState({
    description: '',
    amount: '',
    saleType: 'Privat',
    shippingCost: '',
    paymentStatus: 'to_be_printed' as ProcessStatus,
    notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [saleForm, setSaleForm] = useState({
    timestamp: getInitialDateInput(),
    description: '',
    amount: '',
    saleType: 'Privat',
    customSaleType: '',
    shippingCost: '',
    paymentStatus: 'to_be_printed' as ProcessStatus,
    notes: '',
  });

  const [purchaseForm, setPurchaseForm] = useState({
    timestamp: getInitialDateInput(),
    description: '',
    amount: '',
    notes: '',
  });

  const [saleStatusFilter, setSaleStatusFilter] = useState<'all' | ProcessStatus>('all');
  const [saleSearch, setSaleSearch] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [confirmSaleId, setConfirmSaleId] = useState<string | null>(null);
  const [visibleSalesCount, setVisibleSalesCount] = useState(5);
  const [showMetricCards, setShowMetricCards] = useState(false);

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
        const historyModel = models['EterraSaleHistory'];

        const [salesResult, purchasesResult, historyResult] = await Promise.all([
          saleModel?.list?.({ authMode: 'userPool' }) ?? { data: [] },
          purchaseModel?.list?.({ authMode: 'userPool' }) ?? { data: [] },
          historyModel?.list?.({ authMode: 'userPool' }) ?? { data: [] },
        ]);
        assertNoDataErrors(salesResult);
        assertNoDataErrors(purchasesResult);
        if (historyModel) {
          assertNoDataErrors(historyResult);
        }

        const normalizedSales =
          salesResult?.data
            ?.map((item: any) => ({
              id: item.id,
              description: item.description,
              saleType: item.saleType,
              amount: item.amount,
              shippingCost: item.shippingCost ?? 0,
              netAfterShipping: item.netAfterShipping,
              paymentStatus: mapLegacyStatus(item.paymentStatus),
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
        if (historyResult?.data) {
          const histories = (historyResult.data as any[]).reduce<Record<string, SaleHistory[]>>((acc, item) => {
            const entry: SaleHistory = {
              id: item.id,
              saleId: item.saleId,
              field: item.field,
              oldValue: item.oldValue ?? undefined,
              newValue: item.newValue ?? undefined,
              changeType: item.changeType,
              changedById: item.changedById,
              changedByName: item.changedByName,
              timestamp: item.timestamp,
            };
            acc[entry.saleId] = acc[entry.saleId] ? [...acc[entry.saleId], entry] : [entry];
            return acc;
          }, {});
          // sort newest first
          Object.keys(histories).forEach((key) => {
            histories[key] = histories[key].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
          });
          setSaleHistories(histories);
        } else {
          setSaleHistories({});
        }
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

  useEffect(() => {
    // Reset visible count when filter/search changes
    setVisibleSalesCount(5);
  }, [saleStatusFilter, saleSearch]);

  const summary = useMemo(() => {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const DAYS = 14;
    const dayBuckets = Array.from({ length: DAYS }, (_, idx) => {
      const start = new Date(dayStart.getTime() - (DAYS - 1 - idx) * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      return { start, end };
    });

    const revenueTrend = dayBuckets.map((bucket) =>
      sales.reduce((sum, sale) => {
        const ts = new Date(sale.timestamp).getTime();
        if (ts >= bucket.start.getTime() && ts < bucket.end.getTime()) {
          return sum + sale.netAfterShipping;
        }
        return sum;
      }, 0)
    );

    const pendingTrend = dayBuckets.map((bucket) =>
      sales.reduce((sum, sale) => {
        const ts = new Date(sale.timestamp).getTime();
        if (ts < bucket.end.getTime() && sale.paymentStatus !== 'completed') {
          return sum + sale.netAfterShipping;
        }
        return sum;
      }, 0)
    );

    const cashBoxTrend: number[] = [];
    dayBuckets.forEach((bucket) => {
      const received = sales
        .filter((sale) => sale.paymentStatus === 'completed' && new Date(sale.timestamp).getTime() <= bucket.end.getTime())
        .reduce((sum, sale) => sum + sale.netAfterShipping, 0);
      const spent = purchases
        .filter((purchase) => new Date(purchase.timestamp).getTime() <= bucket.end.getTime())
        .reduce((sum, purchase) => sum + purchase.amount, 0);
      cashBoxTrend.push(received - spent);
    });

    const nowParts = getTiranaDateParts();
    const isCurrentMonth = (timestamp: string) => {
      const date = getTiranaDateParts(timestamp);
      return date.month === nowParts.month && date.year === nowParts.year;
    };

    const monthlySales = sales.filter((sale) => isCurrentMonth(sale.timestamp));
    const monthlyPurchases = purchases.filter((purchase) => isCurrentMonth(purchase.timestamp));

    const monthlyRevenue = monthlySales.reduce((sum, sale) => sum + sale.netAfterShipping, 0);
    const pendingReceivables = sales
      .filter((sale) => sale.paymentStatus !== 'completed')
      .reduce((sum, sale) => sum + sale.netAfterShipping, 0);
    const monthlySpend = monthlyPurchases.reduce((sum, purchase) => sum + purchase.amount, 0);
    const shippingCostsMonth = monthlySales.reduce((sum, sale) => sum + (sale.shippingCost ?? 0), 0);

    const totalReceived = sales
      .filter((sale) => sale.paymentStatus === 'completed')
      .reduce((sum, sale) => sum + sale.netAfterShipping, 0);
    const totalPurchases = purchases.reduce((sum, purchase) => sum + purchase.amount, 0);
    const cashBox = totalReceived - totalPurchases;

    const bestSale = sales.reduce<Sale | null>((current, sale) => {
      if (!current || sale.netAfterShipping > current.netAfterShipping) {
        return sale;
      }
      return current;
    }, null);

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

  const handleMarkCompleted = async (saleId: string) => {
    await handleUpdateStatus(saleId, 'completed');
  };

  const handleUpdateStatus = async (saleId: string, nextStatus: ProcessStatus) => {
    try {
      const models = dataClient.models as Record<string, any>;
      const saleModel = models['EterraSale'];
      const saleBefore = sales.find((sale) => sale.id === saleId);
      if (!saleBefore) return;

      const result = await saleModel?.update?.(
        {
          id: saleId,
          paymentStatus: nextStatus,
        },
        { authMode: 'userPool' }
      );
      assertNoDataErrors(result);
      if (result?.data) {
        setSales((current) =>
          current.map((sale) => (sale.id === saleId ? { ...sale, paymentStatus: nextStatus } : sale))
        );

        if (saleBefore.paymentStatus !== nextStatus) {
          await recordHistoryEntries(saleId, [
            {
              field: 'processStatus',
              oldValue: saleBefore.paymentStatus,
              newValue: nextStatus,
              changeType: 'status',
              changedById: userId,
              changedByName: displayName,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      }
    } catch (err) {
      console.error('Failed to update status', err);
      setError('Could not update process status. Please try again.');
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

  const isDefaultSalesView = saleStatusFilter === 'all' && !saleSearch.trim();
  const visibleSales = isDefaultSalesView ? filteredSales.slice(0, visibleSalesCount) : filteredSales;

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

  const toBePrinted = useMemo(() => sales.filter((sale) => sale.paymentStatus === 'to_be_printed'), [sales]);

  const handleStartEditSale = (sale: Sale) => {
    setEditingSaleId(sale.id);
    setEditingSaleForm({
      description: sale.description,
      amount: sale.amount.toString(),
      saleType: sale.saleType,
      shippingCost: (sale.shippingCost ?? 0).toString(),
      paymentStatus: mapLegacyStatus(sale.paymentStatus),
      notes: sale.notes ?? '',
    });
  };

  const handleCancelEditSale = () => {
    setEditingSaleId(null);
  };

  const recordHistoryEntries = async (saleId: string, entries: Omit<SaleHistory, 'id' | 'saleId'>[]) => {
    const models = dataClient.models as Record<string, any>;
    const historyModel = models['EterraSaleHistory'];
    if (!historyModel) return;

    for (const entry of entries) {
      const result = await historyModel.create(
        {
          saleId,
          field: entry.field,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
          changeType: entry.changeType,
          changedById: entry.changedById,
          changedByName: entry.changedByName,
          timestamp: entry.timestamp,
        },
        { authMode: 'userPool' }
      );
      assertNoDataErrors(result);

      if (result?.data) {
        setSaleHistories((current) => {
          const list = current[saleId] ? [...current[saleId]] : [];
          const newEntry: SaleHistory = {
            id: result.data.id,
            saleId,
            field: result.data.field,
            oldValue: result.data.oldValue ?? undefined,
            newValue: result.data.newValue ?? undefined,
            changeType: result.data.changeType,
            changedById: result.data.changedById,
            changedByName: result.data.changedByName,
            timestamp: result.data.timestamp,
          };
          list.unshift(newEntry);
          return { ...current, [saleId]: list };
        });
      }
    }
  };

  const handleUpdateSale = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingSaleId) return;

    const original = sales.find((sale) => sale.id === editingSaleId);
    if (!original) return;

    const amountValue = parseFloat(editingSaleForm.amount);
    const shippingValue = parseFloat(editingSaleForm.shippingCost) || 0;
    if (!amountValue || amountValue <= 0) return;

    const netAfterShipping = Math.max(amountValue - shippingValue, 0);
    const saleType =
      editingSaleForm.saleType === 'other'
        ? editingSaleForm.saleType
        : editingSaleForm.saleType || 'Privat';

    try {
      const models = dataClient.models as Record<string, any>;
      const saleModel = models['EterraSale'];
      const result = await saleModel.update(
        {
          id: editingSaleId,
          description: editingSaleForm.description.trim() || 'Sale',
          saleType,
          amount: amountValue,
          shippingCost: shippingValue || undefined,
          netAfterShipping,
          paymentStatus: editingSaleForm.paymentStatus,
          notes: editingSaleForm.notes.trim() || undefined,
        },
        { authMode: 'userPool' }
      );
      assertNoDataErrors(result);

      if (result?.data) {
        setSales((current) =>
          current.map((sale) =>
            sale.id === editingSaleId
              ? {
                  ...sale,
                  description: result.data.description,
                  saleType: result.data.saleType,
                  amount: result.data.amount,
                  shippingCost: result.data.shippingCost ?? 0,
                  netAfterShipping: result.data.netAfterShipping,
                  paymentStatus: result.data.paymentStatus,
                  notes: result.data.notes ?? undefined,
                }
              : sale
          )
        );

        const changes: Omit<SaleHistory, 'id' | 'saleId'>[] = [];
        const now = new Date().toISOString();
        const pushChange = (field: string, oldValue?: any, newValue?: any, changeType = 'edit') => {
          if (`${oldValue ?? ''}` === `${newValue ?? ''}`) return;
          changes.push({
            field,
            oldValue: oldValue !== undefined ? String(oldValue) : undefined,
            newValue: newValue !== undefined ? String(newValue) : undefined,
            changeType,
            changedById: userId,
            changedByName: displayName,
            timestamp: now,
          });
        };

        pushChange('description', original.description, result.data.description);
        pushChange('saleType', original.saleType, result.data.saleType);
        pushChange('amount', original.amount, result.data.amount);
        pushChange('shippingCost', original.shippingCost ?? 0, result.data.shippingCost ?? 0);
        pushChange('netAfterShipping', original.netAfterShipping, result.data.netAfterShipping);
        pushChange('notes', original.notes ?? '', result.data.notes ?? '');
        pushChange('processStatus', original.paymentStatus, result.data.paymentStatus, 'status');

        if (changes.length) {
          await recordHistoryEntries(editingSaleId, changes);
        }
      }
    } catch (err) {
      console.error('Failed to update sale', err);
      setError('Failed to update sale. Please try again.');
    } finally {
      setEditingSaleId(null);
    }
  };

  const handleAddSale = async (event: React.FormEvent) => {
    event.preventDefault();
    const amountValue = parseFloat(saleForm.amount);
    if (Number.isNaN(amountValue) || amountValue < 0) return;
    const shippingValue = parseFloat(saleForm.shippingCost) || 0;
    const saleType =
      saleForm.saleType === 'other'
        ? saleForm.customSaleType.trim() || 'Other'
        : saleForm.saleType || 'Privat';

    try {
      // Convert datetime-local format (YYYY-MM-DDTHH:mm) to ISO 8601 with seconds
      const timestampISO = saleForm.timestamp
        ? toISOInTirana(saleForm.timestamp)
        : toISOInTirana(getInitialDateInput());

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
        paymentStatus: 'to_be_printed',
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
        ? toISOInTirana(purchaseForm.timestamp)
        : toISOInTirana(getInitialDateInput());

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
            <div className="flex w-full flex-wrap items-center justify-start gap-2 md:w-auto md:justify-end md:flex-nowrap">
              <Button variant="outline" onClick={() => setShowMetricCards((current) => !current)}>
                {showMetricCards ? 'Hide summary cards' : 'Show summary cards'}
              </Button>
              <Button variant="outline" onClick={() => navigate(-1)}>
                Back
              </Button>
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
            </div>
          </div>
        </header>

        {showMetricCards && (
          <section className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
            <MetricCard
              title="Revenue this month"
              value={formatCurrency(summary.monthlyRevenue)}
              subtitle={`${sales.length} logged sales`}
              trendData={summary.revenueTrend}
            />
            <MetricCard
              title="Open receivables"
              value={formatCurrency(summary.pendingReceivables)}
              subtitle="Not completed yet"
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
        )}

        <section className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Log sale or receivable</CardTitle>
              <CardDescription>Capture every sale, shipping cost, and process status.</CardDescription>
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
                    <Label htmlFor="payment-status">Process status</Label>
                    <select
                      id="payment-status"
                      className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2"
                      value={saleForm.paymentStatus}
                      onChange={(event) =>
                        setSaleForm((current) => ({
                          ...current,
                          paymentStatus: event.target.value as ProcessStatus,
                        }))
                      }
                    >
                      {PROCESS_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
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
                      <option value="Posta cheetah">Posta cheetah</option>
                      <option value="other">Other channel</option>
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
        </section>

        <section className="grid w-full gap-6 md:grid-cols-2">
          <Card className="shadow-sm w-full">
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

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>To be printed</CardTitle>
              <CardDescription>Jobs queued for printing.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading...</p>
              ) : toBePrinted.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Nothing waiting to be printed.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {toBePrinted.slice(0, 8).map((sale) => (
                    <div
                      key={sale.id}
                      className="h-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-3"
                    >
                      <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
                        <span>{formatDate(sale.timestamp)}</span>
                        <span className="uppercase tracking-[0.1em]">{sale.saleType}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[hsl(var(--foreground))] break-words">
                        {sale.description}
                      </p>
                      <p className="text-sm font-medium">{formatCurrency(sale.netAfterShipping)}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] break-words">
                        Logged by {sale.recordedByName}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-1">
          <Card className="shadow-sm w-full">
            <CardHeader>
              <CardTitle>Recent sales</CardTitle>
              <CardDescription>Newest entries first. Includes in-progress items.</CardDescription>
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
                    onChange={(e) => setSaleStatusFilter(e.target.value as 'all' | ProcessStatus)}
                  >
                    <option value="all">All</option>
                    <option value="to_be_printed">To be printed</option>
                    <option value="for_shipping">For shipping</option>
                    <option value="delivering">Delivering</option>
                    <option value="completed">Completed</option>
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
                visibleSales.map((sale) => (
                  <article key={sale.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 p-3">
                    <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium break-words">{sale.description}</span>
                      <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                        <span
                          className={`text-xs uppercase tracking-[0.2em] ${
                            sale.paymentStatus === 'completed'
                              ? 'text-emerald-600'
                              : sale.paymentStatus === 'delivering'
                              ? 'text-sky-600'
                              : sale.paymentStatus === 'for_shipping'
                              ? 'text-amber-600'
                              : 'text-[hsl(var(--primary))]'
                          }`}
                        >
                          {formatProcessStatus(sale.paymentStatus)}
                        </span>
                        {sale.paymentStatus === 'to_be_printed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="px-2"
                            onClick={() => handleUpdateStatus(sale.id, 'for_shipping')}
                          >
                            Mark for shipping
                          </Button>
                        )}
                        {sale.paymentStatus === 'for_shipping' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="px-2"
                            onClick={() => handleUpdateStatus(sale.id, 'delivering')}
                          >
                            Mark delivering
                          </Button>
                        )}
                        {sale.paymentStatus === 'delivering' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="px-2"
                            onClick={() => setConfirmSaleId(sale.id)}
                          >
                            Mark completed
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="px-2" onClick={() => handleStartEditSale(sale)}>
                          Edit
                        </Button>
                      </div>
                    </div>

                    {editingSaleId === sale.id ? (
                      <form className="mt-3 space-y-3" onSubmit={handleUpdateSale}>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor={`edit-description-${sale.id}`}>Description</Label>
                            <Input
                              id={`edit-description-${sale.id}`}
                              value={editingSaleForm.description}
                              onChange={(e) => setEditingSaleForm((prev) => ({ ...prev, description: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`edit-status-${sale.id}`}>Process status</Label>
                            <select
                              id={`edit-status-${sale.id}`}
                              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2"
                              value={editingSaleForm.paymentStatus}
                              onChange={(e) =>
                                setEditingSaleForm((prev) => ({ ...prev, paymentStatus: e.target.value as ProcessStatus }))
                              }
                            >
                              {PROCESS_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="space-y-1">
                            <Label htmlFor={`edit-amount-${sale.id}`}>Amount (EUR)</Label>
                            <Input
                              id={`edit-amount-${sale.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={editingSaleForm.amount}
                              onChange={(e) => setEditingSaleForm((prev) => ({ ...prev, amount: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`edit-shipping-${sale.id}`}>Shipping (EUR)</Label>
                            <Input
                              id={`edit-shipping-${sale.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={editingSaleForm.shippingCost}
                              onChange={(e) => setEditingSaleForm((prev) => ({ ...prev, shippingCost: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`edit-sale-type-${sale.id}`}>Sale type</Label>
                            <select
                              id={`edit-sale-type-${sale.id}`}
                              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2"
                              value={editingSaleForm.saleType}
                              onChange={(e) => setEditingSaleForm((prev) => ({ ...prev, saleType: e.target.value }))}
                            >
                              <option value="Privat">Privat (in-person)</option>
                              <option value="GjirafaMall">GjirafaMall</option>
                              <option value="Posta cheetah">Posta cheetah</option>
                              <option value="other">Other channel</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`edit-notes-${sale.id}`}>Notes</Label>
                          <textarea
                            id={`edit-notes-${sale.id}`}
                            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
                            value={editingSaleForm.notes}
                            onChange={(e) => setEditingSaleForm((prev) => ({ ...prev, notes: e.target.value }))}
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" type="button" onClick={handleCancelEditSale}>
                            Cancel
                          </Button>
                          <Button type="submit">Save changes</Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="text-lg font-semibold">{formatCurrency(sale.netAfterShipping)}</p>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                          {sale.saleType} - {formatDate(sale.timestamp)} - recorded by {sale.recordedByName}
                        </p>
                        {sale.notes && <p className="text-sm text-[hsl(var(--muted-foreground))]">{sale.notes}</p>}
                        {saleHistories[sale.id]?.length ? (
                          <div className="mt-2 border-t border-dashed border-[hsl(var(--border))] pt-2">
                            <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">History (latest)</p>
                            <ul className="space-y-1 text-xs text-[hsl(var(--muted-foreground))]">
                              {saleHistories[sale.id].slice(0, 3).map((history) => (
                                <li key={history.id}>
                                  <span className="font-medium text-[hsl(var(--foreground))]">{history.changedByName}</span>{' '}
                                  changed <span className="font-medium">{history.field}</span> from "{history.oldValue ?? '—'}" to "
                                  {history.newValue ?? '—'}" on {formatDate(history.timestamp)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </>
                    )}
                  </article>
                ))
              )}
              {isDefaultSalesView && filteredSales.length > visibleSalesCount && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleSalesCount((count) => count + 10)}
                  >
                    View more ({Math.min(visibleSalesCount + 10, filteredSales.length)} of {filteredSales.length})
                  </Button>
                </div>
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
            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Mark as completed?</h3>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              Confirm this sale is completed. This will switch the status to Completed.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmSaleId(null)}>
                Cancel
              </Button>
              <Button onClick={() => confirmSaleId && handleMarkCompleted(confirmSaleId)}>
                Mark completed
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
  showGraph = true,
}: {
  title: string;
  value: string;
  subtitle: string;
  trendData?: number[];
  showGraph?: boolean;
}) {
  const sparkPoints = trendData && trendData.length > 0 ? trendData : [0];
  const max = Math.max(...sparkPoints, 1);
  const width = 320;
  const height = 64;
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
        {showGraph ? (
          <div className="mt-2 rounded-md bg-[hsl(var(--muted))]/50 p-2">
            <svg
              role="presentation"
              width="100%"
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
            >
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
        ) : (
          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Graph hidden</p>
        )}
      </CardHeader>
    </Card>
  );
}











