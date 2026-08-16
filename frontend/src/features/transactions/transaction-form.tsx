/* cspell:words Buchungsreferenz Empfänger Wertstellungsdatum */

import { CalendarDays, ChevronDown, FileText, Landmark, Tag, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  CategoryAssignmentCombobox,
  ContractAssignmentCombobox
} from '@/features/assignments/assignment-comboboxes'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Category } from '@/types/categories'
import type { ContractSummary } from '@/types/contracts'
import type { TransactionDraft } from '@/features/transactions/transaction-draft'

type TransactionDraftFieldsProps = {
  accountId: number
  categories: Category[]
  contracts: ContractSummary[]
  draft: TransactionDraft
  idPrefix: string
  onChange: (draft: TransactionDraft) => void
}

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
        <CategoryAssignmentCombobox
          ariaLabel="Kategorie"
          categories={categories}
          className="w-full"
          id={`${idPrefix}-category`}
          noneLabel="Keine Kategorie"
          onValueChange={(value) =>
            onChange({
              ...draft,
              categoryId: value,
              categoryReviewed: true
            })
          }
          placeholder="Keine Kategorie"
          value={draft.categoryId}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-contract`}>
          <Landmark className="size-3.5" aria-hidden />
          Vertrag
        </Label>
        <ContractAssignmentCombobox
          ariaLabel="Vertrag"
          className="w-full"
          contracts={contracts}
          id={`${idPrefix}-contract`}
          noneLabel="Kein Vertrag"
          onValueChange={(value) =>
            onChange({
              ...draft,
              contractId: value,
              contractReviewed: true
            })
          }
          placeholder="Kein Vertrag"
          value={draft.contractId}
        />
      </div>
      <Collapsible className="group md:col-span-2 xl:col-span-4">
        <CollapsibleTrigger asChild>
          <Button
            className="w-full justify-between px-0 hover:bg-transparent"
            id={`${idPrefix}-reference-trigger`}
            type="button"
            variant="ghost"
          >
            Gesamte Buchungsreferenz
            <ChevronDown
              aria-hidden
              className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Textarea
            aria-labelledby={`${idPrefix}-reference-trigger`}
            id={`${idPrefix}-reference`}
            onChange={(event) => change('fullSubjectString', event.target.value)}
            placeholder="Optional: vollständiger Text aus dem Kontoauszug"
            rows={3}
            value={draft.fullSubjectString}
          />
        </CollapsibleContent>
      </Collapsible>
      <input name={`${idPrefix}-account`} type="hidden" value={accountId} />
    </div>
  )
}
