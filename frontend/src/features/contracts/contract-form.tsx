/* cspell:words Vertragsinhaber Zuordnungsmuster */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import { createContract, updateContract } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { contractsQueryKey } from '@/hooks/use-contracts'
import { usePatternPreview } from '@/hooks/use-pattern-preview'
import { parsePositiveId } from '@/lib/format'
import type { UserSummary } from '@/types/common'
import type { ContractSummary, ContractWrite } from '@/types/contracts'

type ContractFormState = {
  ownerId: string
  name: string
  description: string
  patterns: string
  isActive: boolean
  startDate: string
  endDate: string
}

const emptyForm = (users: UserSummary[]): ContractFormState => ({
  ownerId: users[0] === undefined ? '' : String(users[0].id),
  name: '',
  description: '',
  patterns: '',
  isActive: true,
  startDate: '',
  endDate: ''
})

const formFromContract = (contract: ContractSummary): ContractFormState => ({
  ownerId: String(contract.owner.id),
  name: contract.name,
  description: contract.description ?? '',
  patterns: contract.patterns,
  isActive: contract.is_active,
  startDate: contract.start_date ?? '',
  endDate: contract.end_date ?? ''
})

const toContractWrite = (form: ContractFormState): ContractWrite | undefined => {
  const ownerId = parsePositiveId(form.ownerId)

  if (ownerId === undefined || form.name.trim() === '') {
    return undefined
  }

  return {
    owner_id: ownerId,
    name: form.name,
    description: form.description.trim() === '' ? null : form.description,
    patterns: form.patterns,
    is_active: form.isActive,
    start_date: form.startDate === '' ? null : form.startDate,
    end_date: form.endDate === '' ? null : form.endDate
  }
}

type ContractEditorFormProps = {
  contract?: ContractSummary
  idPrefix: string
  onSaved: (contract: ContractSummary) => void
  presentation: 'dialog' | 'page'
  users: UserSummary[]
}

export const ContractEditorForm = ({
  contract,
  idPrefix,
  onSaved,
  presentation,
  users
}: ContractEditorFormProps) => {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ContractFormState>(() =>
    contract === undefined ? emptyForm(users) : formFromContract(contract)
  )
  const [formError, setFormError] = useState<string | undefined>()
  const ownerId = parsePositiveId(form.ownerId)
  const matchPreview = usePatternPreview({
    patterns: form.patterns,
    owner_id: ownerId,
    start_date: form.startDate || null,
    end_date: form.endDate || null
  })
  const mutation = useMutation({
    mutationFn: async () => {
      const payload = toContractWrite(form)

      if (payload === undefined) {
        throw new Error('Bitte gib einen Namen und einen Vertragsinhaber an.')
      }

      return contract === undefined
        ? await createContract(payload)
        : await updateContract(contract.id, payload)
    },
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: contractsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['contract'] })
      ])
      toast.success(
        contract === undefined ? 'Der Vertrag wurde angelegt.' : 'Der Vertrag wurde gespeichert.',
        { id: `contract-saved-${saved.id}` }
      )
      onSaved(saved)
    },
    onError: (error) =>
      setFormError(
        error instanceof Error ? error.message : 'Der Vertrag konnte nicht gespeichert werden.'
      )
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(undefined)
    mutation.mutate()
  }

  const saveButton = (
    <Button disabled={mutation.isPending} type="submit">
      <Save aria-hidden />
      {mutation.isPending
        ? 'Wird gespeichert …'
        : contract === undefined
          ? 'Speichern'
          : 'Änderungen speichern'}
    </Button>
  )

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-owner`}>Vertragsinhaber</Label>
        <select
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          id={`${idPrefix}-owner`}
          onChange={(event) => setForm((current) => ({ ...current, ownerId: event.target.value }))}
          required
          value={form.ownerId}
        >
          <option value="">Bitte auswählen</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {`${user.first_name} ${user.last_name}`.trim() || user.username}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          maxLength={255}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          required
          value={form.name}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-description`}>Beschreibung</Label>
        <Textarea
          id={`${idPrefix}-description`}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
          value={form.description}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-patterns`}>Zuordnungsmuster</Label>
        <Textarea
          id={`${idPrefix}-patterns`}
          onChange={(event) => setForm((current) => ({ ...current, patterns: event.target.value }))}
          placeholder={'z. B. Stadtwerke\nKundennummer 1234'}
          value={form.patterns}
        />
        <p className="text-xs text-muted-foreground">
          Ein Begriff pro Zeile. Passende Buchungen erscheinen als Zuordnungsvorschlag.
        </p>
        {matchPreview.status === 'idle' ? null : matchPreview.status === 'loading' ? (
          <p className="text-xs text-muted-foreground">Passende Buchungen werden gesucht …</p>
        ) : matchPreview.status === 'error' ? (
          <p className="text-xs text-destructive">Die Treffervorschau ist fehlgeschlagen.</p>
        ) : (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium">
              {matchPreview.data.total === 1
                ? '1 historische Buchung passt'
                : `${matchPreview.data.total} historische Buchungen passen`}
            </p>
            {matchPreview.data.examples.map((example) => (
              <p className="mt-1 truncate text-xs text-muted-foreground" key={example.id}>
                {example.recipient || example.subject} · {example.account_name}
              </p>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-start`}>Beginn</Label>
          <Input
            id={`${idPrefix}-start`}
            onChange={(event) =>
              setForm((current) => ({ ...current, startDate: event.target.value }))
            }
            type="date"
            value={form.startDate}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-end`}>Ende</Label>
          <Input
            id={`${idPrefix}-end`}
            min={form.startDate === '' ? undefined : form.startDate}
            onChange={(event) =>
              setForm((current) => ({ ...current, endDate: event.target.value }))
            }
            type="date"
            value={form.endDate}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          aria-label="Vertrag ist aktiv"
          checked={form.isActive}
          id={`${idPrefix}-active`}
          onCheckedChange={(isActive) => setForm((current) => ({ ...current, isActive }))}
        />
        <Label htmlFor={`${idPrefix}-active`}>Vertrag ist aktiv</Label>
      </div>
      {formError === undefined ? null : <p className="text-sm text-destructive">{formError}</p>}
      {presentation === 'dialog' ? (
        <DialogFooter showCloseButton>{saveButton}</DialogFooter>
      ) : (
        <div className="flex justify-end">{saveButton}</div>
      )}
    </form>
  )
}
