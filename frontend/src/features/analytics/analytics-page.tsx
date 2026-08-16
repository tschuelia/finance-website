/* cspell:words Auswertungen Cashflow Finanz Cockpit Kontenauswahl Vermögensquellen */

import { CalendarRange, Check, ChevronDown, Landmark, PiggyBank, WalletCards } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { PageHeader } from '@/components/shared/page-header'
import { AnalyticsDashboard } from '@/features/analytics/analytics-dashboard'
import { usePortfolioOverview } from '@/hooks/use-accounts'
import { displayName } from '@/lib/format'
import type { CashFlowQuery, WealthQuery } from '@/types/analytics'
import type { PortfolioOverview } from '@/types/accounts'

type AnalyticsTab = 'cashflow' | 'wealth'

type AccountOption = {
  id: number
  label: string
  ownerId: number
  ownerName: string
  newestDate: string
  source: string
  type: 'account'
}

type DepotOption = {
  id: number
  label: string
  ownerId: number
  ownerName: string
  newestDate: string
  source: string
  type: 'depot'
}

type SourceOption = AccountOption | DepotOption

const validMonth = (value: string | null): value is string =>
  value !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)

const shiftMonth = (value: string, offset: number): string => {
  const [yearText, monthText] = value.split('-')
  const shifted = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + offset, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

const monthDistance = (start: string, end: string): number => {
  const [startYear, startMonth] = start.split('-').map(Number)
  const [endYear, endMonth] = end.split('-').map(Number)
  return (endYear - startYear) * 12 + endMonth - startMonth + 1
}

const previousMonth = (): string => {
  const today = new Date()
  return shiftMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`, -1)
}

const optionsFromPortfolio = (portfolio: PortfolioOverview) => {
  const accounts: AccountOption[] = []
  const depots: DepotOption[] = []
  for (const group of portfolio.groups) {
    const ownerName = displayName(group.owner)
    for (const account of group.accounts) {
      accounts.push({
        id: account.id,
        label: `${account.name} · ${account.bank}`,
        ownerId: group.owner.id,
        ownerName,
        newestDate:
          account.maximum_absolute_transaction_amount === 0 ? '' : account.newest_transaction_date,
        source: `account:${account.id}`,
        type: 'account'
      })
    }
    for (const depot of group.depots) {
      depots.push({
        id: depot.id,
        label: depot.name,
        ownerId: group.owner.id,
        ownerName,
        newestDate: depot.last_update,
        source: `depot:${depot.id}`,
        type: 'depot'
      })
    }
  }
  return { accounts, depots }
}

type SelectionPopoverProps = {
  icon: typeof WalletCards
  items: SourceOption[]
  label: string
  onChange: (values: string[]) => void
  selected: string[]
}

const SelectionPopover = ({
  icon: Icon,
  items,
  label,
  onChange,
  selected
}: SelectionPopoverProps) => {
  const ownerGroups = new Map<string, SourceOption[]>()
  for (const item of items) {
    const key = `${item.ownerId}:${item.ownerName}`
    ownerGroups.set(key, [...(ownerGroups.get(key) ?? []), item])
  }
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      if (selected.length > 1) {
        onChange(selected.filter((candidate) => candidate !== value))
      }
      return
    }
    onChange([...selected, value])
  }

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button className="w-full justify-between sm:w-72" variant="outline">
            <span className="flex min-w-0 items-center gap-2">
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="truncate">
                {selected.length === items.length
                  ? 'Alle sichtbar'
                  : selected.length === 1
                    ? items.find((item) => item.source === selected[0])?.label
                    : `${selected.length} ausgewählt`}
              </span>
            </span>
            <ChevronDown className="size-4" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-96 w-80 overflow-y-auto">
          {[...ownerGroups.entries()].map(([ownerKey, ownerItems]) => (
            <section className="grid gap-1" key={ownerKey}>
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                {ownerItems[0]?.ownerName}
              </p>
              {ownerItems.map((item) => {
                const checked = selected.includes(item.source)
                return (
                  <button
                    aria-pressed={checked}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    key={item.source}
                    onClick={() => toggle(item.source)}
                    type="button"
                  >
                    <span className="flex size-4 items-center justify-center rounded border">
                      {checked ? <Check className="size-3" aria-hidden /> : null}
                    </span>
                    {item.type === 'account' ? (
                      <Landmark className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    ) : (
                      <PiggyBank className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <span className="min-w-0 truncate">{item.label}</span>
                  </button>
                )
              })}
            </section>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  )
}

type PeriodSelectorProps = {
  endMonth: string
  onChange: (start: string, end: string) => void
  startMonth: string
}

const PeriodSelector = ({ endMonth, onChange, startMonth }: PeriodSelectorProps) => {
  const count = monthDistance(startMonth, endMonth)
  const setPreset = (months: number) => onChange(shiftMonth(endMonth, -(months - 1)), endMonth)

  return (
    <div className="grid gap-3">
      <Label className="flex items-center gap-2">
        <CalendarRange className="size-4" aria-hidden /> Zeitraum
      </Label>
      <div className="flex flex-wrap gap-2">
        {[6, 12, 24].map((months) => (
          <Button
            key={months}
            onClick={() => setPreset(months)}
            size="sm"
            type="button"
            variant={count === months ? 'default' : 'outline'}
          >
            {months} Monate
          </Button>
        ))}
        <Button
          onClick={() => onChange(`${endMonth.slice(0, 4)}-01`, endMonth)}
          size="sm"
          type="button"
          variant={startMonth === `${endMonth.slice(0, 4)}-01` ? 'default' : 'outline'}
        >
          Kalenderjahr
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="analytics-start-month">Von</Label>
          <Input
            id="analytics-start-month"
            max={endMonth}
            onChange={(event) => {
              if (validMonth(event.target.value)) {
                onChange(event.target.value, endMonth)
              }
            }}
            type="month"
            value={startMonth}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="analytics-end-month">Bis</Label>
          <Input
            id="analytics-end-month"
            min={startMonth}
            onChange={(event) => {
              if (validMonth(event.target.value)) {
                onChange(startMonth, event.target.value)
              }
            }}
            type="month"
            value={endMonth}
          />
        </div>
      </div>
    </div>
  )
}

export const AnalyticsPage = () => {
  const portfolio = usePortfolioOverview()
  const [searchParams, setSearchParams] = useSearchParams()

  if (portfolio.status === 'loading') {
    return <LoadingState title="Finanz-Cockpit wird vorbereitet" />
  }
  if (portfolio.status === 'error') {
    return <ErrorState error={portfolio.error} />
  }

  const { accounts, depots } = optionsFromPortfolio(portfolio.data)
  if (accounts.length === 0) {
    return (
      <EmptyState description="Für Auswertungen benötigst Du mindestens ein zugeordnetes Bankkonto." />
    )
  }

  const allAccountSources = accounts.map((account) => account.source)
  const allWealthSources = [...allAccountSources, ...depots.map((depot) => depot.source)]
  const requestedAccounts = searchParams
    .getAll('konto')
    .filter((source) => allAccountSources.includes(source))
  const selectedAccounts = requestedAccounts.length > 0 ? requestedAccounts : allAccountSources
  const defaultWealthSources = [...selectedAccounts, ...depots.map((depot) => depot.source)]
  const requestedWealth = searchParams
    .getAll('quelle')
    .filter((source) => allWealthSources.includes(source))
  const selectedWealth = requestedWealth.length > 0 ? requestedWealth : defaultWealthSources
  const activeTab: AnalyticsTab = searchParams.get('tab') === 'wealth' ? 'wealth' : 'cashflow'

  const selectedAccountOptions = accounts.filter((account) =>
    selectedAccounts.includes(account.source)
  )
  const dates = [...accounts, ...depots]
    .filter((item) => selectedWealth.includes(item.source))
    .map((item) => item.newestDate.slice(0, 7))
    .filter(Boolean)
    .sort()
  const latestSourceMonth = dates.at(-1) ?? previousMonth()
  const defaultEnd = [latestSourceMonth, previousMonth()].sort()[0] ?? previousMonth()
  const requestedStart = searchParams.get('von')
  const requestedEnd = searchParams.get('bis')
  const requestedRangeValid =
    validMonth(requestedStart) &&
    validMonth(requestedEnd) &&
    monthDistance(requestedStart, requestedEnd) >= 1 &&
    monthDistance(requestedStart, requestedEnd) <= 120
  const startMonth = requestedRangeValid ? requestedStart : shiftMonth(defaultEnd, -11)
  const endMonth = requestedRangeValid ? requestedEnd : defaultEnd

  const updateRepeated = (key: string, values: string[], allValues: string[]) => {
    const next = new URLSearchParams(searchParams)
    next.delete(key)
    if (values.length !== allValues.length) {
      for (const value of values) {
        next.append(key, value)
      }
    }
    setSearchParams(next)
  }

  const cashFlowQuery: CashFlowQuery = {
    account_ids: selectedAccountOptions.map((account) => account.id),
    start_month: startMonth,
    end_month: endMonth
  }
  const wealthQuery: WealthQuery = {
    sources: selectedWealth,
    start_month: startMonth,
    end_month: endMonth
  }

  return (
    <>
      <PageHeader
        description="Verstehe gemeinsamen Cashflow, Ausgabentreiber und Vermögensentwicklung ohne Kontensilos."
        title="Finanz-Cockpit"
      />
      <Card>
        <CardHeader>
          <CardTitle>Analyse eingrenzen</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[auto_auto_1fr] lg:items-end">
          <SelectionPopover
            icon={WalletCards}
            items={accounts}
            label="Cashflow-Konten"
            onChange={(values) => updateRepeated('konto', values, allAccountSources)}
            selected={selectedAccounts}
          />
          {activeTab === 'wealth' ? (
            <SelectionPopover
              icon={PiggyBank}
              items={[...accounts, ...depots]}
              label="Vermögensquellen"
              onChange={(values) => updateRepeated('quelle', values, defaultWealthSources)}
              selected={selectedWealth}
            />
          ) : null}
          <PeriodSelector
            endMonth={endMonth}
            onChange={(start, end) => {
              const next = new URLSearchParams(searchParams)
              next.set('von', start)
              next.set('bis', end)
              setSearchParams(next)
            }}
            startMonth={startMonth}
          />
        </CardContent>
      </Card>
      <AnalyticsDashboard
        activeTab={activeTab}
        cashFlowQuery={cashFlowQuery}
        onTabChange={(tab) => {
          const next = new URLSearchParams(searchParams)
          if (tab === 'cashflow') {
            next.delete('tab')
          } else {
            next.set('tab', tab)
          }
          setSearchParams(next)
        }}
        wealthQuery={wealthQuery}
      />
    </>
  )
}
