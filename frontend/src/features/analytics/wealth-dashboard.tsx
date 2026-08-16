import { Landmark, PiggyBank } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis
} from 'recharts'
import type { TooltipValueType } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/query-feedback'
import { formatPercentage } from '@/features/analytics/analytics-format'
import { MoneyTooltipValue } from '@/features/analytics/analytics-shared'
import { formatDecimal } from '@/lib/format'
import type { WealthDashboard as WealthData } from '@/types/analytics'

const moneyTooltip = (value: TooltipValueType | undefined, name: number | string | undefined) => (
  <MoneyTooltipValue name={name} value={value} />
)

const WealthTrendChart = ({ data }: { data: WealthData }) => (
  <ChartContainer
    className="h-80 w-full"
    config={{
      total: { label: 'Gesamtvermögen', color: 'var(--chart-1)' },
      bank_balance: { label: 'Bankkonten', color: 'var(--chart-2)' },
      depot_balance: { label: 'Depots', color: 'var(--chart-4)' }
    }}
  >
    <LineChart accessibilityLayer data={data.monthly} margin={{ left: 8, right: 8 }}>
      <CartesianGrid vertical={false} />
      <ReferenceLine y={0} />
      <XAxis dataKey="label" minTickGap={24} tickLine={false} tickMargin={8} />
      <YAxis
        tickFormatter={(value: number) => formatDecimal(value, { currency: false })}
        width={72}
      />
      <ChartTooltip
        content={<ChartTooltipContent formatter={moneyTooltip} />}
        isAnimationActive={false}
      />
      <ChartLegend content={<ChartLegendContent />} />
      <Line
        connectNulls={false}
        dataKey="total"
        dot={false}
        isAnimationActive={false}
        stroke="var(--color-total)"
        strokeWidth={3}
      />
      <Line
        dataKey="bank_balance"
        dot={false}
        isAnimationActive={false}
        stroke="var(--color-bank_balance)"
        strokeWidth={1.5}
      />
      <Line
        connectNulls={false}
        dataKey="depot_balance"
        dot={false}
        isAnimationActive={false}
        stroke="var(--color-depot_balance)"
        strokeDasharray="5 4"
        strokeWidth={1.5}
      />
    </LineChart>
  </ChartContainer>
)

const WealthAllocationChart = ({ data }: { data: WealthData }) => (
  <ChartContainer
    className="h-[min(32rem,calc(7rem+3.5rem*var(--source-count)))] w-full"
    config={{ balance: { label: 'Bestand', color: 'var(--chart-1)' } }}
    style={{ '--source-count': data.sources.length } as React.CSSProperties}
  >
    <BarChart accessibilityLayer data={data.sources} layout="vertical" margin={{ left: 16 }}>
      <CartesianGrid horizontal={false} />
      <ReferenceLine x={0} />
      <XAxis
        type="number"
        tickFormatter={(value: number) => formatDecimal(value, { currency: false })}
      />
      <YAxis dataKey="name" type="category" tickLine={false} width={112} />
      <ChartTooltip
        content={<ChartTooltipContent formatter={moneyTooltip} />}
        cursor={false}
        isAnimationActive={false}
      />
      <Bar dataKey="balance" fill="var(--color-balance)" isAnimationActive={false} radius={3} />
    </BarChart>
  </ChartContainer>
)

export const WealthDashboardView = ({ data }: { data: WealthData }) => {
  const knownPoints = data.monthly.filter((point) => point.total !== null)
  const containsEstimate = knownPoints.some((point) => point.estimated)
  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Gesamtvermögen</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatDecimal(data.current_total)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Veränderung im Zeitraum</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.absolute_change === null ? '–' : formatDecimal(data.absolute_change)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {data.percentage_change === null
                ? 'Noch keine gemeinsame Vergleichsbasis'
                : formatPercentage(data.percentage_change)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <Landmark className="size-4" aria-hidden /> Bankkonten
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatDecimal(data.liquid_total)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <PiggyBank className="size-4" aria-hidden /> Depots
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatDecimal(data.invested_total)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Vermögensverlauf</CardTitle>
          <CardDescription>
            Kontostände und bekannte Depotwerte · {data.period.label}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {knownPoints.length < 2 ? (
            <EmptyState description="Für einen belastbaren Gesamtverlauf werden mindestens zwei gemeinsame Vermögensstände benötigt." />
          ) : (
            <WealthTrendChart data={data} />
          )}
          {containsEstimate ? (
            <p className="text-xs text-muted-foreground">
              Gestrichelte Depotwerte verwenden den jeweils letzten bekannten Snapshot und sind als
              Schätzung zu lesen.
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Vermögensaufteilung heute</CardTitle>
        </CardHeader>
        <CardContent>
          <WealthAllocationChart data={data} />
        </CardContent>
      </Card>
    </div>
  )
}
