/* cspell:words Vertragslaufzeit Vertragsinhaber */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { createContract, updateContract } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { PageHeader } from '@/components/shared/page-header'
import { contractsQueryKey, useContract } from '@/hooks/use-contracts'
import { useUsers } from '@/hooks/use-users'
import { parsePositiveId } from '@/lib/format'
import { CONTRACTS, contractUrl } from '@/routes/urls'
import type { ContractSummary, ContractWrite } from '@/types/contracts'
import type { UserSummary } from '@/types/common'

type ContractFormState = {
  ownerId: string
  name: string
  description: string
  isActive: boolean
  startDate: string
  endDate: string
}

const emptyForm = (): ContractFormState => ({
  ownerId: '',
  name: '',
  description: '',
  isActive: true,
  startDate: '',
  endDate: ''
})

const formFromContract = (contract: ContractSummary): ContractFormState => ({
  ownerId: String(contract.owner.id),
  name: contract.name,
  description: contract.description ?? '',
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
    is_active: form.isActive,
    start_date: form.startDate === '' ? null : form.startDate,
    end_date: form.endDate === '' ? null : form.endDate
  }
}

type ContractFormPageProps = {
  mode: 'create' | 'edit'
}

export const ContractFormPage = ({ mode }: ContractFormPageProps) => {
  const { contractId: contractIdParam } = useParams()
  const contractId = parsePositiveId(contractIdParam)
  const users = useUsers()
  const contract = useContract(mode === 'edit' ? (contractId ?? Number.NaN) : Number.NaN)

  if (mode === 'edit' && contractId === undefined) {
    return (
      <EmptyState description="Die Vertrags-Adresse ist ungültig." title="Vertrag nicht gefunden" />
    )
  }

  if (mode === 'edit' && contract.status === 'loading') {
    return <LoadingState title="Vertrag wird geladen" />
  }

  if (mode === 'edit' && contract.status === 'error') {
    return <ErrorState error={contract.error} />
  }

  if (users.status === 'loading') {
    return <LoadingState title="Vertragsinhaber werden geladen" />
  }

  if (users.status === 'error') {
    return <ErrorState error={users.error} />
  }

  const initialForm =
    mode === 'edit' && contract.status === 'success'
      ? formFromContract(contract.data)
      : { ...emptyForm(), ownerId: users.data[0] === undefined ? '' : String(users.data[0].id) }

  return (
    <ContractEditor
      contractId={contractId}
      initialForm={initialForm}
      key={`${mode}-${contractId ?? 'new'}`}
      mode={mode}
      users={users.data}
    />
  )
}

type ContractEditorProps = {
  contractId?: number
  initialForm: ContractFormState
  mode: 'create' | 'edit'
  users: UserSummary[]
}

const ContractEditor = ({ contractId, initialForm, mode, users }: ContractEditorProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ContractFormState>(initialForm)
  const [formError, setFormError] = useState<string | undefined>()
  const mutation = useMutation({
    mutationFn: async () => {
      const payload = toContractWrite(form)

      if (payload === undefined) {
        throw new Error('Bitte gib einen Namen und einen Vertragsinhaber an.')
      }

      if (mode === 'create') {
        return await createContract(payload)
      }

      if (contractId === undefined) {
        throw new Error('Die Vertrags-Adresse ist ungültig.')
      }

      return await updateContract(contractId, payload)
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: contractsQueryKey })
      await queryClient.invalidateQueries({ queryKey: ['contract'] })
      toast.success(
        mode === 'create' ? 'Der Vertrag wurde angelegt.' : 'Der Vertrag wurde gespeichert.',
        {
          id: `contract-saved-${saved.id}`
        }
      )
      navigate(contractUrl(saved.id), { replace: true })
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

  return (
    <>
      <PageHeader
        breadcrumbs={
          mode === 'edit' && contractId !== undefined
            ? [
                { label: 'Verträge', to: CONTRACTS },
                { label: initialForm.name, to: contractUrl(contractId) },
                { label: 'Bearbeiten' }
              ]
            : [{ label: 'Verträge', to: CONTRACTS }, { label: 'Vertrag anlegen' }]
        }
        description={
          mode === 'create'
            ? 'Erfasse Laufzeit und Zuständigkeit für einen neuen Vertrag.'
            : 'Passe die Angaben zu diesem Vertrag an.'
        }
        title={mode === 'create' ? 'Vertrag anlegen' : 'Vertrag bearbeiten'}
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-4">
          <form className="grid gap-5" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="contract-owner">Vertragsinhaber</Label>
              <select
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                id="contract-owner"
                onChange={(event) =>
                  setForm((current) => ({ ...current, ownerId: event.target.value }))
                }
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
              <Label htmlFor="contract-name">Name</Label>
              <Input
                id="contract-name"
                maxLength={255}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                required
                value={form.name}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contract-description">Beschreibung</Label>
              <Textarea
                id="contract-description"
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                value={form.description}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="contract-start">Beginn</Label>
                <Input
                  id="contract-start"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, startDate: event.target.value }))
                  }
                  type="date"
                  value={form.startDate}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contract-end">Ende</Label>
                <Input
                  id="contract-end"
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
                id="contract-active"
                onCheckedChange={(isActive) => setForm((current) => ({ ...current, isActive }))}
              />
              <Label htmlFor="contract-active">Vertrag ist aktiv</Label>
            </div>
            {formError === undefined ? null : (
              <p className="text-sm text-destructive">{formError}</p>
            )}
            <div className="flex justify-end">
              <Button disabled={mutation.isPending} type="submit">
                <Save aria-hidden />
                Speichern
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
