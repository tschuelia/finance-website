/* cspell:words Buchungsreferenz CSV-Datei Kontoexport Kontotransaktionen */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileSearch, Save, Trash2, Upload } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { commitCsvImport, previewCsvImport } from '@/api/imports'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { useAccount } from '@/hooks/use-accounts'
import { parsePositiveId } from '@/lib/format'
import { HOME, accountUrl } from '@/routes/urls'
import {
  transactionDraftFromWrite,
  transactionWriteFromDraft
} from '@/features/transactions/transaction-draft'
import { TransactionDraftFields } from '@/features/transactions/transaction-form'
import { invalidateAccountTransactionData } from '@/features/transactions/transaction-query'
import { useTransactionFormOptions } from '@/features/transactions/use-transaction-form-options'
import type { TransactionDraft } from '@/features/transactions/transaction-draft'
import type { TransactionWrite } from '@/types/transactions'

type ImportStage = 'upload' | 'preview'

type TransactionImportContentProps = {
  accountId: number
}

const mutationErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Die CSV-Datei konnte nicht verarbeitet werden.'

const TransactionImportContent = ({ accountId }: TransactionImportContentProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const account = useAccount(accountId)
  const options = useTransactionFormOptions()
  const [stage, setStage] = useState<ImportStage>('upload')
  const [file, setFile] = useState<File | undefined>()
  const [fileInputKey, setFileInputKey] = useState(0)
  const [rows, setRows] = useState<TransactionDraft[]>([])
  const [formError, setFormError] = useState<string | undefined>()
  const preview = useMutation({
    mutationFn: async (selectedFile: File) => await previewCsvImport(accountId, selectedFile),
    onSuccess: (result, selectedFile) => {
      setRows(result.items.map(transactionDraftFromWrite))
      setStage('preview')
      setFormError(undefined)
      toast.success('Die CSV-Datei wurde geprüft.', {
        description:
          result.items.length === 1
            ? 'Eine Transaktion kann nun bearbeitet und übernommen werden.'
            : `${result.items.length} Transaktionen können nun bearbeitet und übernommen werden.`,
        id: `csv-preview-${accountId}-${selectedFile.name}-${Date.now()}`
      })
    },
    onError: (error) => {
      const message = mutationErrorMessage(error)
      setFormError(message)
      toast.error('Die CSV-Datei konnte nicht geprüft werden.', {
        description: message,
        id: `csv-preview-error-${accountId}-${message.slice(0, 100)}`
      })
    }
  })
  const commit = useMutation({
    mutationFn: async (items: TransactionWrite[]) => await commitCsvImport(accountId, items),
    onSuccess: async (result) => {
      await invalidateAccountTransactionData(queryClient, accountId)
      toast.success('Der CSV-Import wurde gespeichert.', {
        description:
          result.created === 1
            ? 'Eine Transaktion wurde atomar übernommen.'
            : `${result.created} Transaktionen wurden atomar übernommen.`,
        id: `csv-commit-${accountId}-${Date.now()}`
      })
      navigate(accountUrl(accountId, location.search), { replace: true })
    },
    onError: (error) => {
      const message = mutationErrorMessage(error)
      setFormError(message)
      toast.error('Der CSV-Import konnte nicht gespeichert werden.', {
        description: message,
        id: `csv-commit-error-${accountId}-${message.slice(0, 100)}`
      })
    }
  })

  const updateRow = (rowIndex: number, draft: TransactionDraft) => {
    setRows((current) => current.map((row, index) => (index === rowIndex ? draft : row)))
  }

  const removeRow = (rowIndex: number) => {
    setRows((current) => current.filter((_, index) => index !== rowIndex))
  }

  const changeFile = () => {
    setStage('upload')
    setFile(undefined)
    setRows([])
    setFormError(undefined)
    setFileInputKey((value) => value + 1)
  }

  const previewFile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (file === undefined) {
      setFormError('Bitte wähle eine CSV-Datei aus.')
      return
    }

    setFormError(undefined)
    preview.mutate(file)
  }

  const commitPreview = () => {
    const items: TransactionWrite[] = []

    for (const [index, row] of rows.entries()) {
      const parsed = transactionWriteFromDraft(accountId, row)

      if (parsed.status === 'invalid') {
        setFormError(`Zeile ${index + 1}: ${parsed.message}`)
        return
      }

      items.push(parsed.value)
    }

    if (items.length === 0) {
      setFormError('Es ist keine Transaktion mehr zum Übernehmen vorhanden.')
      return
    }

    setFormError(undefined)
    commit.mutate(items)
  }

  if (account.status === 'loading' || options.status === 'loading') {
    return <LoadingState title="CSV-Import wird vorbereitet" />
  }

  if (account.status === 'error') {
    return <ErrorState error={account.error} title="Konto konnte nicht geladen werden" />
  }

  if (options.status === 'error') {
    return <ErrorState error={options.error} title="CSV-Import konnte nicht vorbereitet werden" />
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Übersicht', to: HOME },
          { label: account.data.name, to: accountUrl(accountId, location.search) },
          { label: 'CSV-Import' }
        ]}
        description="Prüfe jede importierte Zeile, bevor Du sie gemeinsam und atomar übernimmst."
        title="CSV-Import"
      />
      {stage === 'upload' ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="size-4" aria-hidden />
              Kontoexport hochladen
            </CardTitle>
            <CardDescription>
              Wähle eine CSV-Datei Deines Kontoexports aus. Die Datei wird zuerst nur geprüft.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={previewFile}>
              <div className="grid gap-2">
                <Label htmlFor="transaction-csv-file">CSV-Datei</Label>
                <Input
                  accept=".csv,text/csv"
                  id="transaction-csv-file"
                  key={fileInputKey}
                  onChange={(event) => {
                    setFile(event.currentTarget.files?.[0])
                    setFormError(undefined)
                  }}
                  type="file"
                />
              </div>
              {formError === undefined ? null : (
                <p className="text-sm text-destructive">{formError}</p>
              )}
              <div className="flex justify-end">
                <Button disabled={preview.isPending} type="submit">
                  <FileSearch aria-hidden />
                  {preview.isPending ? 'Datei wird geprüft …' : 'Vorschau erstellen'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={changeFile} variant="outline">
              Andere Datei wählen
            </Button>
          }
          description="Du hast alle Zeilen aus der Vorschau entfernt. Wähle eine andere Datei oder kehre zu den Transaktionen zurück."
          title="Keine Importzeilen übrig"
        />
      ) : (
        <section className="grid gap-4" aria-label="Vorschau des CSV-Imports">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Importvorschau</CardTitle>
                <CardDescription>
                  {rows.length === 1
                    ? 'Eine Zeile wird erst nach Deiner Bestätigung gespeichert.'
                    : `${rows.length} Zeilen werden erst nach Deiner Bestätigung gespeichert.`}
                </CardDescription>
              </div>
              <Button disabled={commit.isPending} onClick={changeFile} variant="outline">
                Andere Datei wählen
              </Button>
            </CardHeader>
          </Card>
          {rows.map((row, index) => (
            <Card key={`csv-row-${index}`}>
              <CardHeader>
                <CardTitle className="text-base">Zeile {index + 1}</CardTitle>
                <CardAction>
                  <Button
                    aria-label={`Importzeile ${index + 1} entfernen`}
                    disabled={commit.isPending}
                    onClick={() => removeRow(index)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden className="text-destructive" />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <TransactionDraftFields
                  accountId={accountId}
                  categories={options.categories}
                  contracts={options.contracts}
                  draft={row}
                  idPrefix={`csv-${index}`}
                  onChange={(draft) => updateRow(index, draft)}
                />
              </CardContent>
            </Card>
          ))}
          {formError === undefined ? null : <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex justify-end">
            <Button disabled={commit.isPending} onClick={commitPreview}>
              <Save aria-hidden />
              {commit.isPending
                ? 'Wird atomar gespeichert …'
                : `${rows.length} Zeilen atomar übernehmen`}
            </Button>
          </div>
        </section>
      )}
    </>
  )
}

export const TransactionImportPage = () => {
  const { accountId: accountIdParam } = useParams()
  const accountId = parsePositiveId(accountIdParam)

  if (accountId === undefined) {
    return <EmptyState description="Die Konto-Adresse ist ungültig." title="Konto nicht gefunden" />
  }

  return <TransactionImportContent accountId={accountId} />
}
