/* cspell:words Vertragslaufzeit Vertragsinhaber Vertragsunterlagen Dateiupload Buchungsvorgang */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, Pencil, Plus, Save, Trash2, Upload } from 'lucide-react'
import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import {
  createContract,
  deleteContractFile,
  downloadContractFile,
  updateContract,
  uploadContractFile
} from '@/api/contracts'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { PageHeader } from '@/components/shared/page-header'
import { contractsQueryKey, useContract, useContracts } from '@/hooks/use-contracts'
import { useUsers } from '@/hooks/use-users'
import { formatDate, formatDecimal, parsePositiveId } from '@/lib/format'
import { CONTRACT_NEW, CONTRACTS, accountUrl, contractEditUrl, contractUrl } from '@/routes/urls'
import type {
  ContractDetail,
  ContractFile,
  ContractSummary,
  ContractWrite
} from '@/types/contracts'
import type { UserSummary } from '@/types/common'

const ContractCard = ({ contract }: { contract: ContractSummary }) => {
  const owner =
    `${contract.owner.first_name} ${contract.owner.last_name}`.trim() || contract.owner.username

  return (
    <Link className="group" to={contractUrl(contract.id)}>
      <Card className="h-full transition-colors group-hover:bg-muted/60">
        <CardHeader>
          <CardDescription className="flex items-center justify-between gap-2">
            <span>{owner}</span>
            <Badge variant={contract.is_active ? 'default' : 'secondary'}>
              {contract.is_active ? 'Aktiv' : 'Inaktiv'}
            </Badge>
          </CardDescription>
          <CardTitle>{contract.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
            {contract.description === null || contract.description === ''
              ? 'Keine Beschreibung hinterlegt.'
              : contract.description}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(contract.start_date)} – {formatDate(contract.end_date)}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}

const ContractGrid = ({
  contracts,
  emptyText
}: {
  contracts: ContractSummary[]
  emptyText: string
}) => {
  if (contracts.length === 0) {
    return <EmptyState description={emptyText} />
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {contracts.map((contract) => (
        <ContractCard contract={contract} key={contract.id} />
      ))}
    </div>
  )
}

export const ContractsPage = () => {
  const contracts = useContracts()

  if (contracts.status === 'loading') {
    return <LoadingState title="Verträge werden geladen" />
  }

  if (contracts.status === 'error') {
    return <ErrorState error={contracts.error} />
  }

  return (
    <>
      <PageHeader
        actions={
          <Button asChild>
            <Link to={CONTRACT_NEW}>
              <Plus aria-hidden />
              Vertrag anlegen
            </Link>
          </Button>
        }
        description="Behalte Vertragslaufzeiten, Buchungen und Unterlagen zusammen im Blick."
        title="Verträge"
      />
      <Tabs className="gap-5" defaultValue="active">
        <TabsList aria-label="Vertragsstatus">
          <TabsTrigger value="active">Aktiv ({contracts.data.active.length})</TabsTrigger>
          <TabsTrigger value="inactive">Inaktiv ({contracts.data.inactive.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <ContractGrid
            contracts={contracts.data.active}
            emptyText="Es gibt derzeit keine aktiven Verträge."
          />
        </TabsContent>
        <TabsContent value="inactive">
          <ContractGrid
            contracts={contracts.data.inactive}
            emptyText="Es gibt derzeit keine inaktiven Verträge."
          />
        </TabsContent>
      </Tabs>
    </>
  )
}

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
      await queryClient.invalidateQueries({ queryKey: ['contract', saved.id] })
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
        actions={
          <Button asChild variant="outline">
            <Link
              to={mode === 'edit' && contractId !== undefined ? contractUrl(contractId) : CONTRACTS}
            >
              <ArrowLeft aria-hidden />
              Zurück
            </Link>
          </Button>
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

const ContractFiles = ({ contract }: { contract: ContractDetail }) => {
  const queryClient = useQueryClient()
  const [uploadError, setUploadError] = useState<string | undefined>()
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => await uploadContractFile(contract.id, file),
    onSuccess: async (file) => {
      await queryClient.invalidateQueries({ queryKey: ['contract', contract.id] })
      toast.success('Die Datei wurde hochgeladen.', {
        id: `contract-file-uploaded-${contract.id}-${file.id}`
      })
    },
    onError: (error) =>
      setUploadError(
        error instanceof Error ? error.message : 'Die Datei konnte nicht hochgeladen werden.'
      )
  })
  const deleteMutation = useMutation({
    mutationFn: async (fileId: number) => await deleteContractFile(contract.id, fileId),
    onSuccess: async (_, fileId) => {
      await queryClient.invalidateQueries({ queryKey: ['contract', contract.id] })
      toast.success('Die Datei wurde gelöscht.', {
        id: `contract-file-deleted-${contract.id}-${fileId}`
      })
    }
  })

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (file === undefined) {
      return
    }

    setUploadError(undefined)
    uploadMutation.mutate(file)
    event.target.value = ''
  }

  const download = async (file: ContractFile) => {
    try {
      const blob = await downloadContractFile(file.download_url)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.filename
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Die Datei konnte nicht geladen werden.'
      toast.error('Der Download ist fehlgeschlagen.', {
        description: message,
        id: `contract-file-download-error-${contract.id}-${file.id}`
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unterlagen</CardTitle>
        <CardDescription>
          Lade Vertragsunterlagen hoch oder lade vorhandene Dateien herunter.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-sm font-medium hover:bg-muted">
          <Upload className="size-4" aria-hidden />
          {uploadMutation.isPending ? 'Datei wird hochgeladen …' : 'Datei hochladen'}
          <input
            className="sr-only"
            disabled={uploadMutation.isPending}
            onChange={upload}
            type="file"
          />
        </label>
        {uploadError === undefined ? null : (
          <p className="text-sm text-destructive">{uploadError}</p>
        )}
        {contract.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Dateien hinterlegt.</p>
        ) : (
          <ul className="grid divide-y rounded-lg border">
            {contract.files.map((file) => (
              <li className="flex flex-wrap items-center justify-between gap-3 p-3" key={file.id}>
                <span className="min-w-0 truncate text-sm font-medium">{file.filename}</span>
                <div className="flex gap-1">
                  <Button
                    onClick={() => void download(file)}
                    size="icon-sm"
                    title="Datei herunterladen"
                    variant="ghost"
                  >
                    <Download aria-hidden />
                    <span className="sr-only">{file.filename} herunterladen</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon-sm" title="Datei löschen" variant="ghost">
                        <Trash2 aria-hidden />
                        <span className="sr-only">{file.filename} löschen</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Datei löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          „{file.filename}“ wird dauerhaft vom Vertrag entfernt.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(file.id)}
                          variant="destructive"
                        >
                          Löschen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export const ContractDetailPage = () => {
  const { contractId: contractIdParam } = useParams()
  const contractId = parsePositiveId(contractIdParam)
  const contract = useContract(contractId ?? Number.NaN)

  if (contractId === undefined) {
    return (
      <EmptyState description="Die Vertrags-Adresse ist ungültig." title="Vertrag nicht gefunden" />
    )
  }

  if (contract.status === 'loading') {
    return <LoadingState title="Vertrag wird geladen" />
  }

  if (contract.status === 'error') {
    return <ErrorState error={contract.error} />
  }

  const owner =
    `${contract.data.owner.first_name} ${contract.data.owner.last_name}`.trim() ||
    contract.data.owner.username
  const firstAccountTransaction = contract.data.transactions.find(
    (transaction) => transaction.bank_account_id !== null
  )

  return (
    <>
      <PageHeader
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={CONTRACTS}>
                <ArrowLeft aria-hidden />
                Verträge
              </Link>
            </Button>
            <Button asChild>
              <Link to={contractEditUrl(contract.data.id)}>
                <Pencil aria-hidden />
                Bearbeiten
              </Link>
            </Button>
          </>
        }
        description={`Vertragsinhaber: ${owner}`}
        title={contract.data.name}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Status</CardDescription>
            <CardTitle>{contract.data.is_active ? 'Aktiv' : 'Inaktiv'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Vertragslaufzeit</CardDescription>
            <CardTitle className="text-base">
              {formatDate(contract.data.start_date)} – {formatDate(contract.data.end_date)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Buchungssaldo</CardDescription>
            <CardTitle>{formatDecimal(contract.data.balance)}</CardTitle>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Beschreibung</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {contract.data.description === null || contract.data.description === ''
              ? 'Keine Beschreibung hinterlegt.'
              : contract.data.description}
          </p>
        </CardContent>
      </Card>
      <ContractFiles contract={contract.data} />
      <Card>
        <CardHeader>
          <CardTitle>Zugeordnete Buchungen</CardTitle>
          <CardDescription>
            {contract.data.first_transaction_date === null
              ? 'Noch keine Buchungen zugeordnet.'
              : `${formatDate(contract.data.first_transaction_date)} bis ${formatDate(contract.data.last_transaction_date)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contract.data.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Buchungen zugeordnet.</p>
          ) : (
            <ul className="grid divide-y rounded-lg border">
              {contract.data.transactions.map((transaction) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                  key={transaction.id}
                >
                  <span className="min-w-0 font-medium">
                    {transaction.recipient || transaction.subject}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(transaction.date_issue)}
                  </span>
                  <span className="font-medium">{formatDecimal(transaction.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          {firstAccountTransaction === undefined ? null : (
            <Button asChild className="mt-3" size="sm" variant="outline">
              <Link to={accountUrl(firstAccountTransaction.bank_account_id as number)}>
                Zum zugehörigen Konto
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  )
}
