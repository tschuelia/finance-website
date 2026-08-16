import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis
} from 'recharts'
import type { TooltipValueType } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'
import { MoneyTooltipValue } from '@/features/analytics/analytics-shared'
import { formatDecimal } from '@/lib/format'
import type { CashFlowDashboard as CashFlowData } from '@/types/analytics'

const moneyTooltip = (value: TooltipValueType | undefined, name: number | string | undefined) => (
  <MoneyTooltipValue name={name} value={value} />
)

export const CashFlowChart = ({ data }: { data: CashFlowData }) => (
  <ChartContainer
    className="h-80 w-full"
    config={{
      income: { label: 'Einnahmen', color: 'var(--chart-2)' },
      expense: { label: 'Ausgaben', color: 'var(--chart-5)' },
      net: { label: 'Überschuss', color: 'var(--chart-1)' }
    }}
  >
    <ComposedChart
      accessibilityLayer
      data={data.monthly.map((item) => ({ ...item, expenseDisplay: -item.expense }))}
      margin={{ left: 8, right: 8 }}
    >
      <CartesianGrid vertical={false} />
      <ReferenceLine y={0} />
      <XAxis dataKey="label" minTickGap={24} tickLine={false} tickMargin={8} />
      <YAxis
        tickFormatter={(value: number) => formatDecimal(Math.abs(value), { currency: false })}
        width={64}
      />
      <ChartTooltip
        content={<ChartTooltipContent formatter={moneyTooltip} />}
        cursor={false}
        isAnimationActive={false}
      />
      <ChartLegend content={<ChartLegendContent />} />
      <Bar
        dataKey="income"
        fill="var(--color-income)"
        isAnimationActive={false}
        name="Einnahmen"
        radius={[3, 3, 0, 0]}
        stackId="flow"
      />
      <Bar
        dataKey="expenseDisplay"
        fill="var(--color-expense)"
        isAnimationActive={false}
        name="Ausgaben"
        radius={[0, 0, 3, 3]}
        stackId="flow"
      />
      <Line
        dataKey="net"
        dot={false}
        isAnimationActive={false}
        name="Überschuss"
        stroke="var(--color-net)"
        strokeWidth={2}
      />
    </ComposedChart>
  </ChartContainer>
)

export const AccountComparisonChart = ({ data }: { data: CashFlowData }) => (
  <ChartContainer
    className="h-[min(28rem,calc(7rem+4rem*var(--account-count)))] w-full"
    config={{
      income: { label: 'Einnahmen', color: 'var(--chart-2)' },
      expense: { label: 'Ausgaben', color: 'var(--chart-5)' }
    }}
    style={{ '--account-count': data.accounts.length } as React.CSSProperties}
  >
    <BarChart accessibilityLayer data={data.accounts} layout="vertical" margin={{ left: 12 }}>
      <CartesianGrid horizontal={false} />
      <XAxis
        type="number"
        tickFormatter={(value: number) => formatDecimal(value, { currency: false })}
      />
      <YAxis dataKey="account_name" type="category" tickLine={false} width={100} />
      <ChartTooltip
        content={<ChartTooltipContent formatter={moneyTooltip} />}
        cursor={false}
        isAnimationActive={false}
      />
      <ChartLegend content={<ChartLegendContent />} />
      <Bar dataKey="income" fill="var(--color-income)" isAnimationActive={false} radius={3} />
      <Bar dataKey="expense" fill="var(--color-expense)" isAnimationActive={false} radius={3} />
    </BarChart>
  </ChartContainer>
)

const topCategories = (data: CashFlowData, limit: number) => {
  const visible = data.categories.slice(0, limit)
  const remaining = data.categories.slice(limit)
  const rows = visible.map((item) => ({
    category: item.category,
    current: item.expense,
    previous: item.previous_expense
  }))
  if (remaining.length > 0) {
    rows.push({
      category: 'Sonstige',
      current: remaining.reduce((sum, item) => sum + item.expense, 0),
      previous: remaining.reduce((sum, item) => sum + item.previous_expense, 0)
    })
  }
  return rows
}

export const CategoryComparisonChart = ({ data }: { data: CashFlowData }) => {
  const rows = topCategories(data, 8)
  const remaining = data.categories.slice(8)
  return (
    <div className="grid gap-2">
      <ChartContainer
        className="h-[30rem] w-full"
        config={{
          current: { label: data.period.label, color: 'var(--chart-1)' },
          previous: { label: data.comparison_period.label, color: 'var(--muted-foreground)' }
        }}
      >
        <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 16 }}>
          <CartesianGrid horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(value: number) => formatDecimal(value, { currency: false })}
          />
          <YAxis dataKey="category" type="category" tickLine={false} width={112} />
          <ChartTooltip
            content={<ChartTooltipContent formatter={moneyTooltip} />}
            cursor={false}
            isAnimationActive={false}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="current" fill="var(--color-current)" isAnimationActive={false} radius={3} />
          <Bar
            dataKey="previous"
            fill="var(--color-previous)"
            isAnimationActive={false}
            radius={3}
          />
        </BarChart>
      </ChartContainer>
      {remaining.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          „Sonstige“ enthält: {remaining.map((item) => item.category).join(', ')}.
        </p>
      ) : null}
    </div>
  )
}

const categoryColor = (index: number): string =>
  [`var(--chart-1)`, `var(--chart-2)`, `var(--chart-3)`, `var(--chart-4)`, `var(--chart-5)`][
    index % 5
  ] ?? 'var(--muted-foreground)'

export const CategoryTrendChart = ({ data }: { data: CashFlowData }) => {
  const categoryNames = data.categories.slice(0, 5).map((item) => item.category)
  const categoryKeys = categoryNames.map((category, index) => ({
    category,
    key: `category_${index}`
  }))
  const rows = data.monthly.map((period) => {
    const row: Record<string, number | string> = { ...period, Sonstige: 0 }
    for (const item of data.category_monthly.filter((item) => item.period === period.period)) {
      const key =
        categoryKeys.find((candidate) => candidate.category === item.category)?.key ?? 'other'
      row[key] = Number(row[key] ?? 0) + item.expense
    }
    return row
  })
  const keys = [...categoryKeys, { category: 'Sonstige', key: 'other' }]
  const config = Object.fromEntries(
    keys.map((item, index) => [
      item.key,
      {
        label: item.category,
        color: item.key === 'other' ? 'var(--muted-foreground)' : categoryColor(index)
      }
    ])
  )
  return (
    <ChartContainer className="h-80 w-full" config={config}>
      <BarChart accessibilityLayer data={rows} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" minTickGap={24} tickLine={false} tickMargin={8} />
        <YAxis
          tickFormatter={(value: number) => formatDecimal(value, { currency: false })}
          width={64}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={moneyTooltip} reverseItems />}
          cursor={false}
          isAnimationActive={false}
        />
        <ChartLegend content={<ChartLegendContent />} />
        {keys.map((item) => (
          <Bar
            dataKey={item.key}
            fill={`var(--color-${item.key})`}
            isAnimationActive={false}
            key={item.key}
            name={item.category}
            stackId="categories"
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

type ContractComparisonRow = {
  active?: number
  contract_name: string
  inactive?: number
}

export const ContractComparisonChart = ({ data }: { data: CashFlowData }) => {
  const visible = data.contracts.slice(0, 8)
  const remaining = data.contracts.slice(8)
  const rows: ContractComparisonRow[] = [
    ...visible.map((contract) => ({
      contract_name: contract.contract_name,
      ...(contract.is_active ? { active: contract.expense } : { inactive: contract.expense })
    })),
    ...(remaining.length === 0
      ? []
      : [
          {
            contract_name: 'Sonstige',
            active: remaining
              .filter((contract) => contract.is_active)
              .reduce((sum, contract) => sum + contract.expense, 0),
            inactive: remaining
              .filter((contract) => !contract.is_active)
              .reduce((sum, contract) => sum + contract.expense, 0)
          }
        ])
  ]
  return (
    <div className="grid gap-2">
      <ChartContainer
        className="h-[min(32rem,calc(7rem+3rem*var(--contract-count)))] w-full"
        config={{
          active: { label: 'Aktiv', color: 'var(--chart-2)' },
          inactive: { label: 'Inaktiv', color: 'var(--muted-foreground)' }
        }}
        style={{ '--contract-count': rows.length } as React.CSSProperties}
      >
        <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 16 }}>
          <CartesianGrid horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(value: number) => formatDecimal(value, { currency: false })}
          />
          <YAxis dataKey="contract_name" type="category" tickLine={false} width={128} />
          <ChartTooltip
            content={<ChartTooltipContent formatter={moneyTooltip} />}
            cursor={false}
            isAnimationActive={false}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="active"
            fill="var(--color-active)"
            isAnimationActive={false}
            radius={3}
            stackId="status"
          />
          <Bar
            dataKey="inactive"
            fill="var(--color-inactive)"
            isAnimationActive={false}
            radius={3}
            stackId="status"
          />
        </BarChart>
      </ChartContainer>
      {remaining.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          „Sonstige“ enthält: {remaining.map((contract) => contract.contract_name).join(', ')}.
        </p>
      ) : null}
    </div>
  )
}

export const ActiveContractHistoryChart = ({ data }: { data: CashFlowData }) => {
  const activeContracts = data.contracts.filter((contract) => contract.is_active)
  const visible = activeContracts.slice(0, 8)
  const remaining = activeContracts.slice(8)
  const visibleKeys = new Map(
    visible.map((contract) => [contract.contract_id, `contract_${contract.contract_id}`])
  )
  const activeIds = new Set(activeContracts.map((contract) => contract.contract_id))
  const monthlyAverage =
    activeContracts.reduce((sum, contract) => sum + contract.expense, 0) / data.period.month_count
  const rows = data.monthly.map((month) => {
    const row: Record<string, number | string> = {
      period: month.period,
      label: month.label,
      monthly_average: monthlyAverage
    }
    for (const item of data.contract_monthly.filter((item) => item.period === month.period)) {
      if (!activeIds.has(item.contract_id)) continue
      const key = visibleKeys.get(item.contract_id) ?? 'other'
      row[key] = Number(row[key] ?? 0) + item.expense
    }
    return row
  })
  const keys = [
    ...visible.map((contract) => ({
      key: `contract_${contract.contract_id}`,
      label: contract.contract_name
    })),
    ...(remaining.length > 0 ? [{ key: 'other', label: 'Sonstige' }] : [])
  ]
  const config = {
    ...Object.fromEntries(
      keys.map((item, index) => [
        item.key,
        {
          label: item.label,
          color: item.key === 'other' ? 'var(--muted-foreground)' : categoryColor(index)
        }
      ])
    ),
    monthly_average: { label: 'Monatsdurchschnitt', color: 'var(--foreground)' }
  }

  return (
    <div className="grid gap-2">
      <ChartContainer className="h-96 w-full" config={config}>
        <ComposedChart accessibilityLayer data={rows} margin={{ left: 8, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" minTickGap={24} tickLine={false} tickMargin={8} />
          <YAxis
            tickFormatter={(value: number) => formatDecimal(value, { currency: false })}
            width={64}
          />
          <ChartTooltip
            content={<ChartTooltipContent formatter={moneyTooltip} />}
            cursor={false}
            isAnimationActive={false}
          />
          <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
          {keys.map((item) => (
            <Bar
              dataKey={item.key}
              fill={`var(--color-${item.key})`}
              isAnimationActive={false}
              key={item.key}
              name={item.label}
              stackId="contracts"
            />
          ))}
          <Line
            dataKey="monthly_average"
            dot={false}
            isAnimationActive={false}
            stroke="var(--color-monthly_average)"
            strokeDasharray="6 4"
            strokeWidth={2}
          />
        </ComposedChart>
      </ChartContainer>
      {remaining.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          „Sonstige“ enthält: {remaining.map((contract) => contract.contract_name).join(', ')}.
        </p>
      ) : null}
    </div>
  )
}
