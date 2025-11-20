import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const METERS_PER_KG: Record<string, Record<string, number>> = {
  '1.75': { PLA: 335, ABS: 400, PETG: 327, 'TPU/TPE': 346, ASA: 389 },
  '2.85': { PLA: 126, ABS: 151, PETG: 123, 'TPU/TPE': 131, ASA: 147 },
};

const PRINTER_PROFILES = {
  custom: {
    label: 'Use custom values',
    power: 0,
    range: 'Manually enter the printer wattage and run time based on your measurements.',
  },
  ender3v3ke: {
    label: 'Creality Ender-3 V3 KE',
    power: 350,
    range: 'Roughly 200-360 W during active printing.',
  },
  crealityhicombo: {
    label: 'Creality Hi Combo',
    power: 480,
    range: 'Roughly 350-520 W during active printing.',
  },
} as const;

const PACKAGING_OPTIONS = [
  { label: 'No extra packaging (0 €)', value: '0' },
  { label: 'Basic packaging (0.12 €)', value: '0.12' },
  { label: 'Full packaging (0.15 €)', value: '0.15' },
];

const PLATFORM_OPTIONS = [
  { label: 'No marketplace (0%)', value: '0' },
  { label: 'GjirafaMall (15%)', value: '0.15' },
  { label: 'Shopaz (15%)', value: '0.15' },
  { label: 'Foleja (15%)', value: '0.15' },
];

const FIXED_COST = 1.2;

const currencyFormatter = new Intl.NumberFormat('sq-AL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('sq-AL', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const formatCurrency = (value: number) => {
  if (!isFinite(value)) return '-';
  const absolute = Math.abs(value);
  if (absolute > 0 && absolute < 0.01) {
    const sign = value < 0 ? '-' : '';
    return `${sign}<${currencyFormatter.format(0.01)}`;
  }
  return currencyFormatter.format(value);
};

const formatNumber = (value: number, suffix = '') =>
  isFinite(value) ? `${numberFormatter.format(value)}${suffix}` : '-';

interface CalculationResult {
  valid: boolean;
  metersPerKg: number;
  spoolGrams: number;
  costPerGram: number;
  filamentGrams: number;
  equivalentMeters: number;
  filamentCost: number;
  packagingCost: number;
  energyConsumption: number;
  energyCost: number;
  totalCost: number;
  finalPrice: number;
  platformFee: number;
  netRevenue: number;
  netProfit: number;
  profitVsCost: number;
  profitVsPrice: number;
  breakEvenPrice: number;
  platformRate: number;
  energyCostShare: number;
}

const defaultResult: CalculationResult = {
  valid: false,
  metersPerKg: 0,
  spoolGrams: 0,
  costPerGram: 0,
  filamentGrams: 0,
  equivalentMeters: 0,
  filamentCost: 0,
  packagingCost: 0,
  energyConsumption: 0,
  energyCost: 0,
  totalCost: 0,
  finalPrice: 0,
  platformFee: 0,
  netRevenue: 0,
  netProfit: 0,
  profitVsCost: 0,
  profitVsPrice: 0,
  breakEvenPrice: 0,
  platformRate: 0,
  energyCostShare: 0,
};

export default function CalculatorPage() {
  const navigate = useNavigate();
  const [filamentPrice, setFilamentPrice] = useState('22');
  const [spoolWeight, setSpoolWeight] = useState('1');
  const [filamentDiameter, setFilamentDiameter] = useState('1.75');
  const [materialType, setMaterialType] = useState('PLA');
  const [filamentUsed, setFilamentUsed] = useState('0');
  const [profitMargin, setProfitMargin] = useState('35');
  const [packagingOption, setPackagingOption] = useState('0.15');
  const [salesPlatform, setSalesPlatform] = useState('0');
  const [energyPrice, setEnergyPrice] = useState('0.09');
  const [printerProfile, setPrinterProfile] = useState<keyof typeof PRINTER_PROFILES>('custom');
  const [printerPower, setPrinterPower] = useState('180');
  const [printHours, setPrintHours] = useState('2');

  useEffect(() => {
    if (printerProfile === 'custom') {
      return;
    }
    const profile = PRINTER_PROFILES[printerProfile];
    setPrinterPower(profile.power.toString());
  }, [printerProfile]);

  const metersPerKg = METERS_PER_KG[filamentDiameter]?.[materialType] ?? 0;

  const calculation = useMemo<CalculationResult>(() => {
    const filamentPriceValue = parseFloat(filamentPrice);
    const spoolWeightValue = parseFloat(spoolWeight);
    const filamentUsedValue = parseFloat(filamentUsed);
    const profitMarginValue = parseFloat(profitMargin);
    const packagingCostValue = parseFloat(packagingOption);
    const platformRateValue = parseFloat(salesPlatform);
    const energyPriceValue = parseFloat(energyPrice);
    const printerPowerValue = parseFloat(printerPower);
    const printHoursValue = parseFloat(printHours);

    const invalid =
      !isFinite(filamentPriceValue) ||
      filamentPriceValue < 0 ||
      !isFinite(spoolWeightValue) ||
      spoolWeightValue <= 0 ||
      !isFinite(filamentUsedValue) ||
      filamentUsedValue < 0 ||
      !isFinite(profitMarginValue) ||
      profitMarginValue < 0 ||
      !isFinite(packagingCostValue) ||
      packagingCostValue < 0 ||
      !isFinite(platformRateValue) ||
      platformRateValue < 0 ||
      platformRateValue >= 1 ||
      metersPerKg <= 0;

    if (invalid) {
      return defaultResult;
    }

    const spoolGrams = spoolWeightValue * 1000;
    const costPerGram = spoolGrams > 0 ? filamentPriceValue / spoolGrams : 0;
    const filamentCost = filamentUsedValue * costPerGram;
    const totalMeters = metersPerKg * spoolWeightValue;
    const equivalentMeters = spoolGrams > 0 ? (filamentUsedValue / spoolGrams) * totalMeters : 0;
    const energyConsumption = (Math.max(printerPowerValue, 0) * Math.max(printHoursValue, 0)) / 1000;
    const energyCost = energyConsumption * Math.max(energyPriceValue, 0);
    const totalCost = filamentCost + packagingCostValue + FIXED_COST + energyCost;

    const marginRate = profitMarginValue / 100;
    const targetNetRevenue = totalCost * (1 + marginRate);
    const finalPrice = targetNetRevenue / (1 - platformRateValue);
    const platformFee = finalPrice * platformRateValue;
    const netRevenue = finalPrice - platformFee;
    const netProfit = netRevenue - totalCost;
    const profitVsCost = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
    const profitVsPrice = finalPrice > 0 ? (netProfit / finalPrice) * 100 : 0;
    const breakEvenPrice = totalCost / (1 - platformRateValue);

    return {
      valid: true,
      metersPerKg,
      spoolGrams,
      costPerGram,
      filamentGrams: filamentUsedValue,
      equivalentMeters,
      filamentCost,
      packagingCost: packagingCostValue,
      energyConsumption,
      energyCost,
      totalCost,
      finalPrice,
      platformFee,
      netRevenue,
      netProfit,
      profitVsCost,
      profitVsPrice,
      breakEvenPrice,
      platformRate: platformRateValue,
      energyCostShare: totalCost > 0 ? energyCost / totalCost : 0,
    };
  }, [
    filamentPrice,
    spoolWeight,
    filamentUsed,
    profitMargin,
    packagingOption,
    salesPlatform,
    energyPrice,
    printerPower,
    printHours,
    metersPerKg,
  ]);

  const insights = useMemo(() => {
    if (!calculation.valid) return [];

    const tips: string[] = [];

    if (calculation.filamentGrams === 0) {
      tips.push('Enter the grams of filament used to generate accurate cost calculations.');
    }

    if (calculation.energyConsumption === 0) {
      tips.push('Add printer wattage, run time, and energy rate to capture electricity costs.');
    }

    if (calculation.netProfit < 0) {
      const difference = calculation.finalPrice - calculation.breakEvenPrice;
      tips.push(
        `Current price is ${formatCurrency(Math.abs(difference))} ${
          difference < 0 ? 'below' : 'above'
        } the break-even point. Reduce costs or raise the price to stay profitable.`
      );
    } else {
      if (calculation.profitVsCost < 20) {
        tips.push('Profit versus cost is low. Consider a higher margin or trim packaging/production costs.');
      }
      if (calculation.profitVsPrice < 15) {
        tips.push('Only a small portion of the final price is profit. Try channels with lower fees to grow margin.');
      }
    }

    if (calculation.platformRate === 0) {
      tips.push('No marketplace fees — leverage this advantage to offer more competitive pricing.');
    }

    if (calculation.energyCostShare > 0.2) {
      tips.push('Energy represents over 20% of total cost. Revisit printer settings or confirm your electricity rate.');
    }

    return tips;
  }, [calculation]);

  const platformNote = calculation.platformRate
    ? `${numberFormatter.format(calculation.platformRate * 100)}% of the final price goes to the marketplace.`
    : 'No marketplace commission.';

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col">
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[hsl(var(--muted-foreground))]">eterra</p>
            <h1 className="text-2xl font-semibold">3D Printing Cost Calculator</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Enter your real production costs, selling channel, and desired profit margin.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
            <Button onClick={() => navigate(-1)}>Back</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 bg-[hsl(var(--background))]">
        <div className="max-w-6xl mx-auto grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Filament</CardTitle>
                <CardDescription>Choose filament type and spool parameters.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    id="filamentPrice"
                    label="Filament price (€/spool)"
                    value={filamentPrice}
                    onChange={setFilamentPrice}
                    min="0"
                    step="0.01"
                  />
                  <NumberField
                    id="spoolWeight"
                    label="Spool weight (kg)"
                    value={spoolWeight}
                    onChange={setSpoolWeight}
                    min="0.1"
                    step="0.1"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                    id="filamentDiameter"
                    label="Filament diameter"
                    value={filamentDiameter}
                    onChange={setFilamentDiameter}
                    options={[
                      { label: '1.75 mm', value: '1.75' },
                      { label: '2.85 mm', value: '2.85' },
                    ]}
                  />
                <SelectField
                    id="materialType"
                    label="Material"
                    value={materialType}
                    onChange={setMaterialType}
                    options={Object.keys(METERS_PER_KG['1.75']).map((material) => ({
                      label: material,
                      value: material,
                    }))}
                  />
                </div>
                <details className="rounded-lg border border-dashed border-[hsl(var(--border))] p-4 text-sm text-[hsl(var(--muted-foreground))]">
                  <summary className="cursor-pointer text-[hsl(var(--foreground))]">View standard meters per kg</summary>
                  <p className="mt-2">
                    Values assume 1 kg spools. Adjust the table in code if your supplier uses different specs.
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="font-semibold text-[hsl(var(--foreground))]">Material</div>
                    <div className="font-semibold text-center text-[hsl(var(--foreground))]">1.75 mm</div>
                    <div className="font-semibold text-center text-[hsl(var(--foreground))]">2.85 mm</div>
                    {Object.keys(METERS_PER_KG['1.75']).map((material) => (
                      <Fragment key={material}>
                        <div>{material}</div>
                        <div className="text-center">{METERS_PER_KG['1.75'][material]} m</div>
                        <div className="text-center">{METERS_PER_KG['2.85'][material]} m</div>
                      </Fragment>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Production & Profit</CardTitle>
                <CardDescription>Track consumed grams and target profit margin.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    id="filamentUsed"
                    label="Filament used (g)"
                    value={filamentUsed}
                    onChange={setFilamentUsed}
                    min="0"
                    step="1"
                  />
                  <NumberField
                    id="profitMargin"
                    label="Profit margin (%)"
                    value={profitMargin}
                    onChange={setProfitMargin}
                    min="0"
                    step="1"
                  />
                </div>
                <SelectField
                  id="packagingOption"
                  label="Packaging"
                  value={packagingOption}
                  onChange={setPackagingOption}
                  options={PACKAGING_OPTIONS}
                  hint="Only the built-in packaging presets are available. Customize the code for more options."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Energy</CardTitle>
                <CardDescription>Printer profile and electricity rates.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SelectField
                  id="printerProfile"
                  label="Printer profile"
                  value={printerProfile}
                  onChange={(value) => setPrinterProfile(value as keyof typeof PRINTER_PROFILES)}
                  options={Object.entries(PRINTER_PROFILES).map(([key, profile]) => ({
                    label: profile.label,
                    value: key,
                  }))}
                  hint={PRINTER_PROFILES[printerProfile].range}
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberField
                    id="energyPrice"
                    label="Energy price (€/kWh)"
                    value={energyPrice}
                    onChange={setEnergyPrice}
                    min="0"
                    step="0.01"
                  />
                  <NumberField
                    id="printerPower"
                    label="Printer power (W)"
                    value={printerPower}
                    onChange={(value) => {
                      setPrinterPower(value);
                      setPrinterProfile('custom');
                    }}
                    min="0"
                    step="10"
                  />
                  <NumberField
                    id="printHours"
                    label="Print time (hours)"
                    value={printHours}
                    onChange={setPrintHours}
                    min="0"
                    step="0.1"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Selling channel</CardTitle>
                <CardDescription>Select the commission your final price must cover.</CardDescription>
              </CardHeader>
              <CardContent>
                <SelectField
                  id="salesPlatform"
                  label="Marketplace fee"
                  value={salesPlatform}
                  onChange={setSalesPlatform}
                  options={PLATFORM_OPTIONS}
                  hint="Fee is applied on top of the final price collected by the platform."
                />
              </CardContent>
            </Card>
          </section>

          <section className="space-y-6">
            <Card className="bg-[hsl(var(--card))]/90 backdrop-blur shadow-lg">
              <CardHeader>
                <CardTitle>Pricing summary</CardTitle>
                <CardDescription>Live outputs based on the inputs above.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatCard title="Final price" value={formatCurrency(calculation.finalPrice)} />
                  <StatCard title="Kosto totale" value={formatCurrency(calculation.totalCost)} />
                  <StatCard title="Marketplace fee" value={formatCurrency(calculation.platformFee)} note={platformNote} />
                  <StatCard
                    title="Fitimi neto"
                    value={formatCurrency(calculation.netProfit)}
                    highlight
                    negative={calculation.netProfit < 0}
                  />
                </div>

                <DataSection
                  title="Cost breakdown"
                  rows={[
                    ['Meters per kg', formatNumber(calculation.metersPerKg, ' m')],
                    ['Total grams on spool', formatNumber(calculation.spoolGrams, ' g')],
                    ['Cost per gram', formatCurrency(calculation.costPerGram)],
                    ['Grams used', formatNumber(calculation.filamentGrams, ' g')],
                    ['Equivalent meters', formatNumber(calculation.equivalentMeters, ' m')],
                    ['Filament cost', formatCurrency(calculation.filamentCost)],
                    ['Packaging cost', formatCurrency(calculation.packagingCost)],
                    ['Fixed cost', formatCurrency(FIXED_COST)],
                    ['Energy consumption', formatNumber(calculation.energyConsumption, ' kWh')],
                    ['Energy cost', formatCurrency(calculation.energyCost)],
                    ['Total cost (no margin)', formatCurrency(calculation.totalCost)],
                  ]}
                />

                <DataSection
                  title="Sales overview"
                  rows={[
                    ['Final price', formatCurrency(calculation.finalPrice)],
                    [
                      'Marketplace fee',
                      calculation.platformRate
                        ? `${formatCurrency(calculation.platformFee)} (${formatNumber(calculation.platformRate * 100, '%')})`
                        : '-',
                    ],
                    ['Revenue after fees', formatCurrency(calculation.netRevenue)],
                  ]}
                />

                <DataSection
                  title="Profit analysis"
                  rows={[
                    ['Net profit', formatCurrency(calculation.netProfit)],
                    ['Profit vs cost', formatNumber(calculation.profitVsCost, '%')],
                    ['Profit vs final price', formatNumber(calculation.profitVsPrice, '%')],
                    ['Break-even price', formatCurrency(calculation.breakEvenPrice)],
                  ]}
                />

                {insights.length > 0 && (
                  <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-4">
                    <SectionTitle>Intelligent insights</SectionTitle>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[hsl(var(--muted-foreground))]">
                      {insights.map((tip, index) => (
                        <li key={index}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  step,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  step?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" value={value} min={min} step={step} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>}
    </div>
  );
}

function StatCard({
  title,
  value,
  note,
  highlight,
  negative,
}: {
  title: string;
  value: string;
  note?: string;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <article
      className={`rounded-xl border border-[hsl(var(--border))] p-4 shadow-sm ${
        highlight ? 'bg-[hsl(var(--primary))]/10' : 'bg-[hsl(var(--card))]'
      } ${negative ? 'border-[hsl(var(--destructive))]' : ''}`}
    >
      <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{title}</h3>
      <p className="text-2xl font-semibold text-[hsl(var(--foreground))]">{value}</p>
      {note && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{note}</p>}
    </article>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">{children}</h3>;
}

function DataSection({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="space-y-3 rounded-xl border border-[hsl(var(--border))] p-4">
      <SectionTitle>{title}</SectionTitle>
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-lg bg-[hsl(var(--muted))]/30 px-3 py-2">
            <dt className="text-[hsl(var(--muted-foreground))]">{label}</dt>
            <dd className="font-medium text-[hsl(var(--foreground))]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
