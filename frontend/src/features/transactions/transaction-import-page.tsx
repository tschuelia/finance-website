/* cspell:words Buchungsdetails Kontoexport Kontoinhaber Zuordnungsvorschläge */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCheck, FileUp, Plus, Save, Tags, Upload } from 'lucide-react'
import type { ChangeEvent, DragEvent } from 'react'
import { useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { commitCsvImport, previewCsvImport } from '@/api/imports'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { PageHeader } from '@/components/shared/page-header'
import {
  CategoryAssignmentCombobox,
  ContractAssignmentCombobox
} from '@/features/assignments/assignment-comboboxes'
import {
  AssignmentReviewTable,
  type AssignmentTableRow
} from '@/features/assignments/assignment-review-table'
import {
  QuickCategoryDialog,
  QuickContractDialog
} from '@/features/assignments/inline-assignment-editors'
import { useAuth } from '@/features/auth/use-auth'
import {
  transactionDraftFromWrite,
  transactionWriteFromDraft
} from '@/features/transactions/transaction-draft'
import { TransactionDraftFields } from '@/features/transactions/transaction-form'
import { invalidateAccountTransactionData } from '@/features/transactions/transaction-query'
import { useTransactionFormOptions } from '@/features/transactions/use-transaction-form-options'
import { useAccount } from '@/hooks/use-accounts'
import { parseDecimalInput, parsePositiveId } from '@/lib/format'
import { HOME, accountUrl } from '@/routes/urls'
import type { Category } from '@/types/categories'
import type { ContractSummary } from '@/types/contracts'
import type { CsvPreviewRow } from '@/types/imports'
import type { TransactionDraft } from '@/features/transactions/transaction-draft'
import type { TransactionWrite } from '@/types/transactions'

type ImportStage = 'upload' | 'preview'
type ImportFilter = 'all' | 'attention' | 'category' | 'contract'

type ImportRow = {
  draft: TransactionDraft
  preview: CsvPreviewRow
}

type TransactionImportContentProps = {
  accountId: number
}

const mutationErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Die CSV-Datei konnte nicht verarbeitet werden.'

const rowKey = (row: ImportRow): string => String(row.preview.source_row)

const needsCategoryAttention = (row: ImportRow): boolean => !row.draft.categoryReviewed

const needsContractAttention = (row: ImportRow): boolean => !row.draft.contractReviewed

const TransactionImportContent = ({ accountId }: TransactionImportContentProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { state: authState } = useAuth()
  const account = useAccount(accountId)
  const options = useTransactionFormOptions()
  const [stage, setStage] = useState<ImportStage>('upload')
  const [fileName, setFileName] = useState<string | undefined>()
  const [fileInputKey, setFileInputKey] = useState(0)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [skippedRows, setSkippedRows] = useState<{ source_row: number; reason: string }[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<ImportFilter>('all')
  const [bulkCategory, setBulkCategory] = useState<string>()
  const [bulkContract, setBulkContract] = useState<string>()
  const [editingKey, setEditingKey] = useState<string | undefined>()
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [contractDialogOpen, setContractDialogOpen] = useState(false)
  const [formError, setFormError] = useState<string | undefined>()
  const preview = useMutation({
    mutationFn: async (selectedFile: File) => await previewCsvImport(accountId, selectedFile),
    onSuccess: (result, selectedFile) => {
      setRows(
        result.items.map((item) => ({
          preview: item,
          draft: transactionDraftFromWrite(item.transaction)
        }))
      )
      setSkippedRows(result.skipped_rows)
      setFileName(selectedFile.name)
      setStage('preview')
      setSelectedKeys(new Set())
      setFormError(undefined)
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
      await queryClient.invalidateQueries({ queryKey: ['assignment-review'] })
      toast.success('Der CSV-Import wurde gespeichert.', {
        description:
          result.created === 1
            ? 'Eine Transaktion wurde übernommen.'
            : `${result.created} Transaktionen wurden übernommen.`,
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

  const updateRow = (key: string, update: (draft: TransactionDraft) => TransactionDraft) => {
    setRows((current) =>
      current.map((row) => (rowKey(row) === key ? { ...row, draft: update(row.draft) } : row))
    )
  }

  const previewFile = (file: File | undefined) => {
    if (file === undefined) {
      return
    }
    setFormError(undefined)
    preview.mutate(file)
  }

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    previewFile(event.currentTarget.files?.[0])
  }

  const changeFile = () => {
    if (rows.length > 0 && !window.confirm('Möchtest Du die bearbeitete Vorschau verwerfen?')) {
      return
    }
    setStage('upload')
    setFileName(undefined)
    setRows([])
    setSkippedRows([])
    setSelectedKeys(new Set())
    setFormError(undefined)
    setFileInputKey((value) => value + 1)
  }

  const commitPreview = () => {
    const items: TransactionWrite[] = []
    for (const row of rows) {
      const parsed = transactionWriteFromDraft(accountId, row.draft)
      if (parsed.status === 'invalid') {
        setFormError(`CSV-Zeile ${row.preview.source_row}: ${parsed.message}`)
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

  const categoryAttention = rows.filter(needsCategoryAttention).length
  const contractAttention = rows.filter(needsContractAttention).length
  const filteredRows = rows.filter((row) => {
    if (filter === 'category') return needsCategoryAttention(row)
    if (filter === 'contract') return needsContractAttention(row)
    if (filter === 'attention') return needsCategoryAttention(row) || needsContractAttention(row)
    return true
  })
  const visibleKeys = new Set(filteredRows.map(rowKey))
  const visibleSelectedCount = [...selectedKeys].filter((key) => visibleKeys.has(key)).length
  const canManageCategories = authState.status === 'authenticated' && authState.user.is_superuser
  const editingRow = rows.find((row) => rowKey(row) === editingKey)
  const tableRows: AssignmentTableRow[] = filteredRows.map((row) => ({
    amount: parseDecimalInput(row.draft.amount) ?? 0,
    categoryId: row.draft.categoryId,
    categoryMatch: row.preview.category_match,
    contractId: row.draft.contractId,
    contractMatch: row.preview.contract_match,
    dateIssue: row.draft.dateIssue,
    key: rowKey(row),
    ownerId: account.data.owner.id,
    recipient: row.draft.recipient,
    selected: selectedKeys.has(rowKey(row)),
    sourceLabel: `CSV-Zeile ${row.preview.source_row}`,
    subject: row.draft.subject
  }))

  const applyCategory = (category?: Category) => {
    const value = category === undefined ? bulkCategory : String(category.id)
    if (value === undefined) return
    setRows((current) =>
      current.map((row) =>
        selectedKeys.has(rowKey(row))
          ? {
              ...row,
              draft: {
                ...row.draft,
                categoryId: value,
                categoryReviewed: true
              }
            }
          : row
      )
    )
  }

  const applyContract = (contract?: ContractSummary) => {
    const value = contract === undefined ? bulkContract : String(contract.id)
    if (value === undefined) return
    setRows((current) =>
      current.map((row) =>
        selectedKeys.has(rowKey(row))
          ? {
              ...row,
              draft: {
                ...row.draft,
                contractId: value,
                contractReviewed: true
              }
            }
          : row
      )
    )
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Übersicht', to: HOME },
          { label: account.data.name, to: accountUrl(accountId, location.search) },
          { label: 'CSV-Import' }
        ]}
        description="Importiere den Kontoexport und prüfe nur Zuordnungen, die Aufmerksamkeit benötigen."
        title="CSV-Import"
      />
      <ol className="grid gap-3 sm:grid-cols-3" aria-label="Importschritte">
        {[
          ['1', 'Datei auswählen', stage === 'upload'],
          ['2', 'Zuordnungen prüfen', stage === 'preview' && !commit.isPending],
          ['3', 'Importieren', commit.isPending]
        ].map(([number, label, active]) => (
          <li
            className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${
              active ? 'border-primary bg-primary/5 font-medium' : 'text-muted-foreground'
            }`}
            key={number as string}
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-muted font-medium">
              {number}
            </span>
            {label}
          </li>
        ))}
      </ol>
      {stage === 'upload' ? (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Kontoexport hochladen</CardTitle>
            <CardDescription>
              Konto: {account.data.name} · Bank: {account.data.bank}. Unterstützt werden CSV-Exporte
              von Comdirect, DKB, Holvi und N26.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <button
              className="grid min-h-48 cursor-pointer place-items-center gap-3 rounded-xl border-2 border-dashed border-input p-8 text-center transition-colors hover:border-primary hover:bg-primary/5"
              disabled={preview.isPending}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event: DragEvent<HTMLButtonElement>) => {
                event.preventDefault()
                previewFile(event.dataTransfer.files[0])
              }}
              type="button"
            >
              {preview.isPending ? (
                <FileUp className="size-10 animate-pulse text-primary" aria-hidden />
              ) : (
                <Upload className="size-10 text-primary" aria-hidden />
              )}
              <span className="grid gap-1">
                <span className="font-medium">
                  {preview.isPending ? 'CSV-Datei wird geprüft …' : 'CSV-Datei hier ablegen'}
                </span>
                <span className="text-sm text-muted-foreground">
                  oder klicken, um eine Datei auszuwählen
                </span>
              </span>
            </button>
            <input
              accept=".csv,text/csv"
              className="sr-only"
              key={fileInputKey}
              onChange={selectFile}
              ref={fileInputRef}
              type="file"
            />
            {formError === undefined ? null : (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          action={<Button onClick={changeFile}>Andere Datei wählen</Button>}
          description="Du hast alle Zeilen aus der Vorschau entfernt."
          title="Keine Importzeilen übrig"
        />
      ) : (
        <section className="grid gap-4" aria-label="Vorschau des CSV-Imports">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>Importbereit</CardDescription>
                <CardTitle>{rows.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Kategorien prüfen</CardDescription>
                <CardTitle>{categoryAttention}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Verträge prüfen</CardDescription>
                <CardTitle>{contractAttention}</CardTitle>
              </CardHeader>
            </Card>
          </div>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-2 pt-4">
              <span className="mr-auto text-sm text-muted-foreground">
                {fileName} · {rows.length} importierbare Zeilen
              </span>
              {(['all', 'attention', 'category', 'contract'] as const).map((value) => (
                <Button
                  key={value}
                  onClick={() => setFilter(value)}
                  size="sm"
                  variant={filter === value ? 'default' : 'outline'}
                >
                  {value === 'all'
                    ? 'Alle'
                    : value === 'attention'
                      ? 'Nur offene'
                      : value === 'category'
                        ? 'Kategorien'
                        : 'Verträge'}
                </Button>
              ))}
              <Button onClick={changeFile} size="sm" variant="outline">
                Andere Datei
              </Button>
            </CardContent>
          </Card>
          {skippedRows.length === 0 ? null : (
            <Card className="border-amber-300 bg-amber-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4" aria-hidden />
                  {skippedRows.length} Zeilen werden nicht importiert
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm">
                {skippedRows.map((row) => (
                  <p key={`${row.source_row}-${row.reason}`}>
                    CSV-Zeile {row.source_row}: {row.reason}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 pt-4">
              <Button
                onClick={() =>
                  setSelectedKeys(
                    visibleSelectedCount === filteredRows.length
                      ? new Set([...selectedKeys].filter((key) => !visibleKeys.has(key)))
                      : new Set([...selectedKeys, ...visibleKeys])
                  )
                }
                variant="outline"
              >
                <CheckCheck aria-hidden />
                {visibleSelectedCount === filteredRows.length
                  ? 'Auswahl aufheben'
                  : 'Sichtbare auswählen'}
              </Button>
              <CategoryAssignmentCombobox
                ariaLabel="Kategorie gemeinsam zuordnen"
                categories={options.categories}
                className="w-56 max-w-full"
                noneLabel="Bewusst ohne Kategorie"
                onValueChange={setBulkCategory}
                placeholder="Kategorie auswählen"
                value={bulkCategory}
              />
              <Button
                disabled={selectedKeys.size === 0 || bulkCategory === undefined}
                onClick={() => applyCategory()}
                variant="secondary"
              >
                <Tags aria-hidden />
                Kategorie anwenden
              </Button>
              {canManageCategories ? (
                <Button
                  disabled={selectedKeys.size === 0}
                  onClick={() => setCategoryDialogOpen(true)}
                  variant="outline"
                >
                  <Plus aria-hidden />
                  Neue Kategorie
                </Button>
              ) : null}
              <ContractAssignmentCombobox
                ariaLabel="Vertrag gemeinsam zuordnen"
                className="w-56 max-w-full"
                contracts={options.contracts.filter(
                  (contract) => contract.owner.id === account.data.owner.id
                )}
                noneLabel="Bewusst ohne Vertrag"
                onValueChange={setBulkContract}
                placeholder="Vertrag auswählen"
                value={bulkContract}
              />
              <Button
                disabled={selectedKeys.size === 0 || bulkContract === undefined}
                onClick={() => applyContract()}
                variant="secondary"
              >
                Vertrag anwenden
              </Button>
              <Button
                disabled={selectedKeys.size === 0}
                onClick={() => setContractDialogOpen(true)}
                variant="outline"
              >
                <Plus aria-hidden />
                Neuer Vertrag
              </Button>
            </CardContent>
          </Card>
          {filteredRows.length === 0 ? (
            <EmptyState
              description="Alle Zuordnungen in diesem Filter sind geklärt."
              title="Keine offenen Zeilen"
            />
          ) : (
            <AssignmentReviewTable
              categories={options.categories}
              contracts={options.contracts}
              onAssignmentChange={(key, assignment, value) =>
                updateRow(key, (draft) =>
                  assignment === 'category'
                    ? { ...draft, categoryId: value, categoryReviewed: true }
                    : { ...draft, contractId: value, contractReviewed: true }
                )
              }
              onEdit={setEditingKey}
              onRemove={(key) => {
                setRows((current) => current.filter((row) => rowKey(row) !== key))
                setSelectedKeys((current) => {
                  const next = new Set(current)
                  next.delete(key)
                  return next
                })
              }}
              onSelectionChange={(key, selected) =>
                setSelectedKeys((current) => {
                  const next = new Set(current)
                  if (selected) next.add(key)
                  else next.delete(key)
                  return next
                })
              }
              onSubjectChange={(key, value) =>
                updateRow(key, (draft) => ({ ...draft, subject: value }))
              }
              rows={tableRows}
            />
          )}
          {formError === undefined ? null : (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}
          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge
                variant={categoryAttention + contractAttention === 0 ? 'default' : 'secondary'}
              >
                {categoryAttention + contractAttention === 0 ? 'Bereit' : 'Prüfung empfohlen'}
              </Badge>
              {rows.length} Buchungen werden importiert.
            </span>
            <Button disabled={commit.isPending} onClick={commitPreview}>
              <Save aria-hidden />
              {commit.isPending ? 'Wird gespeichert …' : `${rows.length} Buchungen importieren`}
            </Button>
          </div>
        </section>
      )}
      {editingRow === undefined ? null : (
        <Dialog onOpenChange={(open) => !open && setEditingKey(undefined)} open>
          <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Buchungsdetails bearbeiten</DialogTitle>
              <DialogDescription>CSV-Zeile {editingRow.preview.source_row}</DialogDescription>
            </DialogHeader>
            <TransactionDraftFields
              accountId={accountId}
              categories={options.categories}
              contracts={options.contracts.filter(
                (contract) => contract.owner.id === account.data.owner.id
              )}
              draft={editingRow.draft}
              idPrefix={`csv-${editingRow.preview.source_row}`}
              onChange={(draft) => updateRow(rowKey(editingRow), () => draft)}
            />
          </DialogContent>
        </Dialog>
      )}
      {categoryDialogOpen ? (
        <QuickCategoryDialog onCreated={applyCategory} onOpenChange={setCategoryDialogOpen} open />
      ) : null}
      {contractDialogOpen ? (
        <QuickContractDialog
          onCreated={applyContract}
          onOpenChange={setContractDialogOpen}
          open
          owner={account.data.owner}
        />
      ) : null}
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
