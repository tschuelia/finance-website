/* cspell:words Buchungsdetails Kontoexport Kontoinhaber Zuordnungsvorschläge */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCheck, Plus, Save, Tags } from 'lucide-react'
import { useReducer, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { commitCsvImport, previewCsvImport } from '@/api/imports'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  ImportProgress,
  ImportFilterBar,
  ImportSkippedRows,
  ImportSummary,
  ImportUpload
} from '@/features/transactions/transaction-import-layout'
import {
  initialTransactionImportState,
  transactionImportReducer
} from '@/features/transactions/transaction-import-state'
import { useTransactionFormOptions } from '@/features/transactions/use-transaction-form-options'
import { useAccount } from '@/hooks/use-accounts'
import { parseDecimalInput, parsePositiveId } from '@/lib/format'
import { HOME, accountUrl } from '@/routes/urls'
import type { Category } from '@/types/categories'
import type { ContractSummary } from '@/types/contracts'
import type { TransactionDraft } from '@/features/transactions/transaction-draft'
import type { ImportRow } from '@/features/transactions/transaction-import-state'
import type { TransactionWrite } from '@/types/transactions'

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
  const [importState, dispatch] = useReducer(
    transactionImportReducer,
    undefined,
    initialTransactionImportState
  )
  const {
    bulkCategory,
    bulkContract,
    categoryDialogOpen,
    contractDialogOpen,
    editingKey,
    fileInputKey,
    fileName,
    filter,
    formError,
    rows,
    selectedKeys,
    skippedRows,
    stage
  } = importState
  const patchState = (patch: Partial<typeof importState>) => dispatch({ type: 'patch', patch })
  const updateRows = (update: (current: ImportRow[]) => ImportRow[]) =>
    dispatch({ type: 'update-rows', update })
  const updateSelection = (update: (current: Set<string>) => Set<string>) =>
    dispatch({ type: 'update-selection', update })
  const preview = useMutation({
    mutationFn: async (selectedFile: File) => await previewCsvImport(accountId, selectedFile),
    onSuccess: (result, selectedFile) => {
      patchState({
        rows: result.items.map((item) => ({
          preview: item,
          draft: transactionDraftFromWrite(item.transaction)
        })),
        skippedRows: result.skipped_rows,
        fileName: selectedFile.name,
        stage: 'preview',
        selectedKeys: new Set(),
        formError: undefined
      })
    },
    onError: (error) => {
      const message = mutationErrorMessage(error)
      patchState({ formError: message })
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
      patchState({ formError: message })
      toast.error('Der CSV-Import konnte nicht gespeichert werden.', {
        description: message,
        id: `csv-commit-error-${accountId}-${message.slice(0, 100)}`
      })
    }
  })

  const updateRow = (key: string, update: (draft: TransactionDraft) => TransactionDraft) => {
    updateRows((current) =>
      current.map((row) => (rowKey(row) === key ? { ...row, draft: update(row.draft) } : row))
    )
  }

  const previewFile = (file: File | undefined) => {
    if (file === undefined) {
      return
    }
    patchState({ formError: undefined })
    preview.mutate(file)
  }

  const changeFile = () => {
    if (rows.length > 0 && !window.confirm('Möchtest Du die bearbeitete Vorschau verwerfen?')) {
      return
    }
    patchState({
      stage: 'upload',
      fileName: undefined,
      rows: [],
      skippedRows: [],
      selectedKeys: new Set(),
      formError: undefined,
      fileInputKey: fileInputKey + 1
    })
  }

  const commitPreview = () => {
    const items: TransactionWrite[] = []
    for (const row of rows) {
      const parsed = transactionWriteFromDraft(accountId, row.draft)
      if (parsed.status === 'invalid') {
        patchState({ formError: `CSV-Zeile ${row.preview.source_row}: ${parsed.message}` })
        return
      }
      items.push(parsed.value)
    }
    if (items.length === 0) {
      patchState({ formError: 'Es ist keine Transaktion mehr zum Übernehmen vorhanden.' })
      return
    }
    patchState({ formError: undefined })
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
    updateRows((current) =>
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
    updateRows((current) =>
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
      <ImportProgress committing={commit.isPending} stage={stage} />
      {stage === 'upload' ? (
        <ImportUpload
          accountBank={account.data.bank}
          accountName={account.data.name}
          fileInputKey={fileInputKey}
          fileInputRef={fileInputRef}
          formError={formError}
          onFile={previewFile}
          pending={preview.isPending}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          action={<Button onClick={changeFile}>Andere Datei wählen</Button>}
          description="Du hast alle Zeilen aus der Vorschau entfernt."
          title="Keine Importzeilen übrig"
        />
      ) : (
        <section className="grid gap-4" aria-label="Vorschau des CSV-Imports">
          <ImportSummary
            categoryAttention={categoryAttention}
            contractAttention={contractAttention}
            rowCount={rows.length}
          />
          <ImportFilterBar
            fileName={fileName}
            filter={filter}
            onChangeFile={changeFile}
            onFilter={(value) => patchState({ filter: value })}
            rowCount={rows.length}
          />
          <ImportSkippedRows rows={skippedRows} />
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 pt-4">
              <Button
                onClick={() =>
                  patchState({
                    selectedKeys:
                      visibleSelectedCount === filteredRows.length
                        ? new Set([...selectedKeys].filter((key) => !visibleKeys.has(key)))
                        : new Set([...selectedKeys, ...visibleKeys])
                  })
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
                onValueChange={(value) => patchState({ bulkCategory: value })}
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
                  onClick={() => patchState({ categoryDialogOpen: true })}
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
                onValueChange={(value) => patchState({ bulkContract: value })}
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
                onClick={() => patchState({ contractDialogOpen: true })}
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
              onEdit={(key) => patchState({ editingKey: key })}
              onRemove={(key) => {
                updateRows((current) => current.filter((row) => rowKey(row) !== key))
                updateSelection((current) => {
                  const next = new Set(current)
                  next.delete(key)
                  return next
                })
              }}
              onSelectionChange={(key, selected) =>
                updateSelection((current) => {
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
        <Dialog onOpenChange={(open) => !open && patchState({ editingKey: undefined })} open>
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
        <QuickCategoryDialog
          onCreated={applyCategory}
          onOpenChange={(open) => patchState({ categoryDialogOpen: open })}
          open
        />
      ) : null}
      {contractDialogOpen ? (
        <QuickContractDialog
          onCreated={applyContract}
          onOpenChange={(open) => patchState({ contractDialogOpen: open })}
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
