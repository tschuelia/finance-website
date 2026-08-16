/* cspell:words Verträge */

import type { KeyboardEvent } from 'react'
import { useState } from 'react'
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
import type { Category } from '@/types/categories'
import type { ContractSummary } from '@/types/contracts'

type AssignmentComboboxProps = {
  ariaLabel: string
  className?: string
  id?: string
  noneLabel: string
  onValueChange: (value: string) => void
  placeholder: string
  value: string | undefined
}

const useAssignmentComboboxSearch = (selectedLabel: string) => {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)

  const start = (clearQuery = true) => {
    if (clearQuery) {
      setQuery('')
    }
    setSearching(true)
  }

  const stop = () => setSearching(false)

  const replaceLabelOnType = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!searching && event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.currentTarget.select()
    }
  }

  return {
    inputValue: searching ? query : selectedLabel,
    replaceLabelOnType,
    searching,
    setQuery,
    start,
    stop
  }
}

type CategoryComboboxProps = AssignmentComboboxProps & {
  categories: Category[]
}

type CategoryOption = {
  label: string
  value: string
}

export const CategoryAssignmentCombobox = ({
  ariaLabel,
  categories,
  className,
  id,
  noneLabel,
  onValueChange,
  placeholder,
  value
}: CategoryComboboxProps) => {
  const options: CategoryOption[] = [
    { label: noneLabel, value: '' },
    ...categories.map((category) => ({ label: category.name, value: String(category.id) }))
  ]
  const selectedOption = options.find((option) => option.value === value) ?? null
  const search = useAssignmentComboboxSearch(selectedOption?.label ?? '')

  return (
    <Combobox
      inputValue={search.inputValue}
      isItemEqualToValue={(item: CategoryOption, selected: CategoryOption) =>
        item.value === selected.value
      }
      itemToStringLabel={(option: CategoryOption) => option.label}
      itemToStringValue={(option: CategoryOption) => option.value}
      items={options}
      onInputValueChange={search.setQuery}
      onOpenChange={(open, { reason }) => {
        if (open) {
          search.start(reason !== 'input-change')
        } else {
          search.stop()
        }
      }}
      onValueChange={(option: CategoryOption | null) => {
        if (option !== null) {
          onValueChange(option.value)
        }
      }}
      value={selectedOption}
    >
      <ComboboxInput
        aria-label={ariaLabel}
        className={className}
        id={id}
        onBlur={search.stop}
        onFocus={() => search.start()}
        onKeyDown={search.replaceLabelOnType}
        placeholder={search.searching ? 'Kategorie suchen …' : placeholder}
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
  )
}

type ContractComboboxProps = AssignmentComboboxProps & {
  contracts: ContractSummary[]
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

export const ContractAssignmentCombobox = ({
  ariaLabel,
  className,
  contracts,
  id,
  noneLabel,
  onValueChange,
  placeholder,
  value
}: ContractComboboxProps) => {
  const noContractOption: ContractOption = {
    contract: null,
    label: noneLabel,
    value: ''
  }
  const contractOptions: ContractOption[] = contracts.map((contract) => ({
    contract,
    label: `${contract.name}${contract.is_active ? '' : ' (inaktiv)'}`,
    value: String(contract.id)
  }))
  const selectedOption =
    contractOptions.find((option) => option.value === value) ??
    (value === '' ? noContractOption : null)
  const search = useAssignmentComboboxSearch(selectedOption?.label ?? '')
  const contractGroups: ContractGroup[] = [
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
  ]
  const groups = contractGroups.filter((group) => group.items.length > 0)

  return (
    <Combobox
      inputValue={search.inputValue}
      isItemEqualToValue={(item: ContractOption, selected: ContractOption) =>
        item.value === selected.value
      }
      itemToStringLabel={(option: ContractOption) => option.label}
      itemToStringValue={(option: ContractOption) => option.value}
      items={groups}
      onInputValueChange={search.setQuery}
      onOpenChange={(open, { reason }) => {
        if (open) {
          search.start(reason !== 'input-change')
        } else {
          search.stop()
        }
      }}
      onValueChange={(option: ContractOption | null) => {
        if (option !== null) {
          onValueChange(option.value)
        }
      }}
      value={selectedOption}
    >
      <ComboboxInput
        aria-label={ariaLabel}
        className={className}
        id={id}
        onBlur={search.stop}
        onFocus={() => search.start()}
        onKeyDown={search.replaceLabelOnType}
        placeholder={search.searching ? 'Vertrag suchen …' : placeholder}
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
  )
}
