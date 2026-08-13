/* cspell:words Buchungsreferenz Empfänger Wertstellungsdatum */

import { CalendarDays, FileText, Landmark, Tag, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Category } from '@/types/categories'
import type { ContractSummary } from '@/types/contracts'
import type { TransactionDraft } from '@/features/transactions/transaction-draft'

const noSelection = '__none__'

type TransactionDraftFieldsProps = {
  accountId: number
  categories: Category[]
  contracts: ContractSummary[]
  draft: TransactionDraft
  idPrefix: string
  onChange: (draft: TransactionDraft) => void
}

const selectValue = (value: string): string | undefined => (value === '' ? undefined : value)

const fromSelectValue = (value: string): string => (value === noSelection ? '' : value)

export const TransactionDraftFields = ({
  accountId,
  categories,
  contracts,
  draft,
  idPrefix,
  onChange
}: TransactionDraftFieldsProps) => {
  const change = <Key extends keyof TransactionDraft>(key: Key, value: TransactionDraft[Key]) => {
    onChange({ ...draft, [key]: value })
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-recipient`}>
          <UserRound className="size-3.5" aria-hidden />
          Zahlung an/von
        </Label>
        <Input
          id={`${idPrefix}-recipient`}
          onChange={(event) => change('recipient', event.target.value)}
          placeholder="Zum Beispiel ‚Stadtwerke‘"
          value={draft.recipient}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-amount`}>Betrag</Label>
        <Input
          id={`${idPrefix}-amount`}
          inputMode="decimal"
          onChange={(event) => change('amount', event.target.value)}
          placeholder="Zum Beispiel -42,50"
          required
          value={draft.amount}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-date-issue`}>
          <CalendarDays className="size-3.5" aria-hidden />
          Buchungsdatum
        </Label>
        <Input
          id={`${idPrefix}-date-issue`}
          onChange={(event) => change('dateIssue', event.target.value)}
          required
          type="date"
          value={draft.dateIssue}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-date-booking`}>Wertstellungsdatum</Label>
        <Input
          id={`${idPrefix}-date-booking`}
          onChange={(event) => change('dateBooking', event.target.value)}
          type="date"
          value={draft.dateBooking}
        />
      </div>
      <div className="grid gap-2 md:col-span-2">
        <Label htmlFor={`${idPrefix}-subject`}>
          <FileText className="size-3.5" aria-hidden />
          Betreff
        </Label>
        <Input
          id={`${idPrefix}-subject`}
          onChange={(event) => change('subject', event.target.value)}
          required
          value={draft.subject}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-category`}>
          <Tag className="size-3.5" aria-hidden />
          Kategorie
        </Label>
        <Select
          onValueChange={(value) => change('categoryId', fromSelectValue(value))}
          value={selectValue(draft.categoryId)}
        >
          <SelectTrigger id={`${idPrefix}-category`} className="w-full">
            <SelectValue placeholder="Keine Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={noSelection}>Keine Kategorie</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-contract`}>
          <Landmark className="size-3.5" aria-hidden />
          Vertrag
        </Label>
        <Select
          onValueChange={(value) => change('contractId', fromSelectValue(value))}
          value={selectValue(draft.contractId)}
        >
          <SelectTrigger id={`${idPrefix}-contract`} className="w-full">
            <SelectValue placeholder="Kein Vertrag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={noSelection}>Kein Vertrag</SelectItem>
            {contracts.map((contract) => (
              <SelectItem key={contract.id} value={String(contract.id)}>
                {contract.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2 md:col-span-2 xl:col-span-4">
        <Label htmlFor={`${idPrefix}-reference`}>Gesamte Buchungsreferenz</Label>
        <Textarea
          id={`${idPrefix}-reference`}
          onChange={(event) => change('fullSubjectString', event.target.value)}
          placeholder="Optional: vollständiger Text aus dem Kontoauszug"
          rows={3}
          value={draft.fullSubjectString}
        />
      </div>
      <input name={`${idPrefix}-account`} type="hidden" value={accountId} />
    </div>
  )
}

type TransactionFormProps = TransactionDraftFieldsProps & {
  error?: string
  isSubmitting: boolean
  onSubmit: () => void
  submitLabel: string
}

export const TransactionForm = ({
  error,
  isSubmitting,
  onSubmit,
  submitLabel,
  ...fieldsProps
}: TransactionFormProps) => {
  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <TransactionDraftFields {...fieldsProps} />
      {error === undefined ? null : <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Wird gespeichert …' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
