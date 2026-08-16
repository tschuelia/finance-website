import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { TooltipValueType } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPercentage } from '@/features/analytics/analytics-format'
import { formatDecimal } from '@/lib/format'

type MoneyTooltipValueProps = {
  name: number | string | undefined
  value: TooltipValueType | undefined
}

export const MoneyTooltipValue = ({ name, value }: MoneyTooltipValueProps) => {
  const amount = Array.isArray(value) ? Number(value[0] ?? 0) : Number(value ?? 0)
  return (
    <>
      <span className="text-muted-foreground">{name}</span>
      <span className="ml-auto font-mono font-medium tabular-nums">
        {formatDecimal(Math.abs(amount))}
      </span>
    </>
  )
}

type MetricCardProps = {
  compareLabel: string
  invertTrend?: boolean
  label: string
  percentage?: boolean
  previousValue: number
  value: number | null
}

export const MetricCard = ({
  compareLabel,
  invertTrend = false,
  label,
  percentage = false,
  previousValue,
  value
}: MetricCardProps) => {
  if (value === null) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-2xl tabular-nums">–</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Keine Einnahmen im Zeitraum</p>
        </CardContent>
      </Card>
    )
  }
  const change = value - previousValue
  const favorable = invertTrend ? change <= 0 : change >= 0
  const TrendIcon = change >= 0 ? ArrowUpRight : ArrowDownRight
  const formatted = percentage ? formatPercentage(value) : formatDecimal(value)
  const comparison =
    previousValue === 0
      ? `${compareLabel}: ${percentage ? formatPercentage(previousValue) : formatDecimal(previousValue)}`
      : `${formatPercentage(change / Math.abs(previousValue))} ggü. ${compareLabel}`

  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{formatted}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={
            change === 0
              ? 'text-xs text-muted-foreground'
              : favorable
                ? 'flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400'
                : 'flex items-center gap-1 text-xs text-destructive'
          }
        >
          {change === 0 ? null : <TrendIcon className="size-3.5" aria-hidden />}
          {comparison}
        </p>
      </CardContent>
    </Card>
  )
}
