/* cspell:words Buchungsreferenz Empfänger Wertstellungsdatum */

import { CalendarDays, ChevronDown, FileText, Landmark, Tag, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator
} from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

type CategoryOption = {
  category: Category | null
  label: string
  value: string
}

type ContractOption = {
  contract: ContractSummary | null
  label: string
  value: string
}

type ContractGroup = {
  items: ContractOption[]
  value: 'active' | 'inactive'
}

const noCategoryOption: CategoryOption = {
  category: null,
  label: 'Keine Kategorie',
  value: noSelection
}

const noContractOption: ContractOption = {
  contract: null,
  label: 'Kein Vertrag',
  value: noSelection
}

export const TransactionDraftFields = ({
  accountId,
  categories,
  contracts,
  draft,
  idPrefix,
  onChange
}: TransactionDraftFieldsProps) => {
  const categoryOptions: CategoryOption[] = [
    noCategoryOption,
    ...categories.map((category) => ({
      category,
      label: category.name,
      value: String(category.id)
    }))
  ]
  const contractOptions: ContractOption[] = contracts.map((contract) => ({
    contract,
    label: contract.name,
    value: String(contract.id)
  }))
  const selectedCategory =
    categoryOptions.find((option) => option.value === draft.categoryId) ?? noCategoryOption
  const selectedContract =
    contractOptions.find((option) => option.value === draft.contractId) ?? noContractOption
  const contractGroups = [
    {
      value: 'active',
      items: [
        noContractOption,
        ...contractOptions.filter((option) => option.contract?.is_active === true)
      ]
    },
    {
      value: 'inactive',
      items: contractOptions.filter((option) => option.contract?.is_active === false)
    }
  ] satisfies ContractGroup[]
  const populatedContractGroups = contractGroups.filter((group) => group.items.length > 0)

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
        <Combobox
          isItemEqualToValue={(item: CategoryOption, value: CategoryOption) =>
            item.value === value.value
          }
          itemToStringLabel={(option: CategoryOption) => option.label}
          itemToStringValue={(option: CategoryOption) => option.value}
          items={categoryOptions}
          onValueChange={(option: CategoryOption | null) =>
            onChange({
              ...draft,
              categoryId: option?.category === null ? '' : (option?.value ?? ''),
              categoryReviewed: true
            })
          }
          value={selectedCategory}
        >
          <ComboboxInput
            className="w-full"
            id={`${idPrefix}-category`}
            placeholder="Keine Kategorie"
          />
          <ComboboxContent>
            <ComboboxEmpty>Keine passende Kategorie gefunden.</ComboboxEmpty>
            <ComboboxList>
              {(option: CategoryOption) => (
                <ComboboxItem key={option.value} value={option}>
                  {option.label}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-contract`}>
          <Landmark className="size-3.5" aria-hidden />
          Vertrag
        </Label>
        <Combobox
          isItemEqualToValue={(item: ContractOption, value: ContractOption) =>
            item.value === value.value
          }
          itemToStringLabel={(option: ContractOption) => option.label}
          itemToStringValue={(option: ContractOption) => option.value}
          items={populatedContractGroups}
          onValueChange={(option: ContractOption | null) =>
            onChange({
              ...draft,
              contractId: option?.contract === null ? '' : (option?.value ?? ''),
              contractReviewed: true
            })
          }
          value={selectedContract}
        >
          <ComboboxInput
            className="w-full"
            id={`${idPrefix}-contract`}
            placeholder="Kein Vertrag"
          />
          <ComboboxContent>
            <ComboboxEmpty>Kein passender Vertrag gefunden.</ComboboxEmpty>
            <ComboboxList>
              {(group: ContractGroup, index: number) => (
                <ComboboxGroup key={group.value} items={group.items}>
                  {index > 0 ? <ComboboxSeparator /> : null}
                  <ComboboxLabel>
                    {group.value === 'active' ? 'Aktive Verträge' : 'Inaktive Verträge'}
                  </ComboboxLabel>
                  <ComboboxCollection>
                    {(option: ContractOption) => (
                      <ComboboxItem
                        className={group.value === 'inactive' ? 'text-muted-foreground' : undefined}
                        key={option.value}
                        value={option}
                      >
                        {option.label}
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                </ComboboxGroup>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
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
