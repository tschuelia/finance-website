/* cspell:words Buchungsdatum Kategorien Transaktionsfilter */

import type { FormEvent } from 'react'
import { useState } from 'react'
import { Filter, RotateCcw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { decimalInputValue, parseDecimalInput } from '@/lib/format'
import type { Category } from '@/types/categories'
import type { TransactionFilters, TransactionType } from '@/types/transactions'
import { defaultTransactionFilters } from '@/features/transactions/transaction-search'

type TransactionFilterFormProps = {
  categories: Category[]
  categoriesError?: string
  categoriesLoading: boolean
  filters: TransactionFilters
  onApply: (filters: TransactionFilters) => void
}

type TransactionFilterDraft = {
  q: string
  dateStart: string
  dateEnd: string
  amountMin: string
  amountMax: string
  categoryIds: number[]
  transactionType: TransactionType
}

const draftFromFilters = (filters: TransactionFilters): TransactionFilterDraft => ({
  q: filters.q ?? '',
  dateStart: filters.date_start ?? '',
  dateEnd: filters.date_end ?? '',
  amountMin: filters.amount_min === undefined ? '' : decimalInputValue(filters.amount_min),
  amountMax: filters.amount_max === undefined ? '' : decimalInputValue(filters.amount_max),
  categoryIds: filters.category_ids,
  transactionType: filters.transaction_type
})

const filterAmount = (value: string): string | undefined | null => {
  if (value.trim() === '') {
    return undefined
  }

  const parsed = parseDecimalInput(value)
  return parsed === undefined || parsed.startsWith('-') ? null : parsed
}

const validDateRange = (start: string, end: string): boolean =>
  start === '' || end === '' || start <= end

const validAmountRange = (minimum: string | undefined, maximum: string | undefined): boolean => {
  if (minimum === undefined || maximum === undefined) {
    return true
  }

  const [minimumInteger, minimumFraction = ''] = minimum.split('.')
  const [maximumInteger, maximumFraction = ''] = maximum.split('.')
  const normalizedMinimum = `${minimumInteger}.${minimumFraction.padEnd(2, '0')}`
  const normalizedMaximum = `${maximumInteger}.${maximumFraction.padEnd(2, '0')}`

  return BigInt(normalizedMinimum.replace('.', '')) <= BigInt(normalizedMaximum.replace('.', ''))
}

export const TransactionFilterForm = ({
  categories,
  categoriesError,
  categoriesLoading,
  filters,
  onApply
}: TransactionFilterFormProps) => {
  const [draft, setDraft] = useState(() => draftFromFilters(filters))
  const [formError, setFormError] = useState<string | undefined>()

  const change = <Key extends keyof TransactionFilterDraft>(
    key: Key,
    value: TransactionFilterDraft[Key]
  ) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const toggleCategory = (categoryId: number, checked: boolean) => {
    change(
      'categoryIds',
      checked
        ? [...new Set([...draft.categoryIds, categoryId])]
        : draft.categoryIds.filter((currentId) => currentId !== categoryId)
    )
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amountMin = filterAmount(draft.amountMin)
    const amountMax = filterAmount(draft.amountMax)

    if (amountMin === null || amountMax === null) {
      setFormError('Bitte gib für die Betragsgrenzen nur nichtnegative Beträge ein.')
      return
    }

    if (!validDateRange(draft.dateStart, draft.dateEnd)) {
      setFormError('Das Enddatum darf nicht vor dem Startdatum liegen.')
      return
    }

    if (!validAmountRange(amountMin, amountMax)) {
      setFormError('Der Höchstbetrag darf nicht kleiner als der Mindestbetrag sein.')
      return
    }

    setFormError(undefined)
    onApply({
      q: draft.q.trim() || undefined,
      date_start: draft.dateStart || undefined,
      date_end: draft.dateEnd || undefined,
      amount_min: amountMin,
      amount_max: amountMax,
      category_ids: draft.categoryIds,
      transaction_type: draft.transactionType,
      page: 1,
      page_size: filters.page_size
    })
  }

  const reset = () => {
    const resetFilters = {
      ...defaultTransactionFilters(),
      page_size: filters.page_size
    }
    setDraft(draftFromFilters(resetFilters))
    setFormError(undefined)
    onApply(resetFilters)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="size-4" aria-hidden />
          Transaktionen filtern
        </CardTitle>
        <CardDescription>
          Die Filter werden in der Adresse gespeichert und bleiben beim Weiterblättern erhalten.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="grid gap-2 xl:col-span-2">
              <Label htmlFor="transaction-search">Suche</Label>
              <Input
                id="transaction-search"
                onChange={(event) => change('q', event.target.value)}
                placeholder="Empfänger oder Betreff"
                value={draft.q}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transaction-date-start">Von</Label>
              <Input
                id="transaction-date-start"
                onChange={(event) => change('dateStart', event.target.value)}
                type="date"
                value={draft.dateStart}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transaction-date-end">Bis</Label>
              <Input
                id="transaction-date-end"
                onChange={(event) => change('dateEnd', event.target.value)}
                type="date"
                value={draft.dateEnd}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transaction-type">Art</Label>
              <Select
                onValueChange={(value) => change('transactionType', value as TransactionType)}
                value={draft.transactionType}
              >
                <SelectTrigger id="transaction-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="income">Einnahmen</SelectItem>
                  <SelectItem value="expense">Ausgaben</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transaction-amount-min">Mindestbetrag</Label>
              <Input
                id="transaction-amount-min"
                inputMode="decimal"
                onChange={(event) => change('amountMin', event.target.value)}
                placeholder="0,00"
                value={draft.amountMin}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transaction-amount-max">Höchstbetrag</Label>
              <Input
                id="transaction-amount-max"
                inputMode="decimal"
                onChange={(event) => change('amountMax', event.target.value)}
                placeholder="0,00"
                value={draft.amountMax}
              />
            </div>
          </div>
          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium">Kategorien</legend>
            {categoriesLoading ? (
              <p className="text-sm text-muted-foreground">Kategorien werden geladen …</p>
            ) : null}
            {categoriesError === undefined ? null : (
              <p className="text-sm text-destructive" role="alert">
                Kategorien konnten nicht geladen werden: {categoriesError}
              </p>
            )}
            {!categoriesLoading && categoriesError === undefined && categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Es sind noch keine Kategorien angelegt.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-x-5 gap-y-3">
              {categories.map((category) => (
                <div className="flex items-center gap-2" key={category.id}>
                  <Checkbox
                    checked={draft.categoryIds.includes(category.id)}
                    id={`transaction-category-${category.id}`}
                    onCheckedChange={(checked) => toggleCategory(category.id, checked === true)}
                  />
                  <Label htmlFor={`transaction-category-${category.id}`}>{category.name}</Label>
                </div>
              ))}
            </div>
          </fieldset>
          {formError === undefined ? null : <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={reset} type="button" variant="outline">
              <RotateCcw aria-hidden />
              Filter zurücksetzen
            </Button>
            <Button type="submit">
              <Search aria-hidden />
              Filtern
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
