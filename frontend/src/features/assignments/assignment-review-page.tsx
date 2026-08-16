/* cspell:words Zuordnungen Zuordnungsvorschläge */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCheck, Link2, Plus, Search, Tags } from 'lucide-react'
import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { updateAssignments } from '@/api/review'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataPagination } from '@/components/shared/data-pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import {
  AssignmentReviewTable,
  type AssignmentTableRow
} from '@/features/assignments/assignment-review-table'
import {
  QuickCategoryDialog,
  QuickContractDialog
} from '@/features/assignments/inline-assignment-editors'
import { TransferReviewPanel } from '@/features/assignments/transfer-review-panel'
import { useAuth } from '@/features/auth/use-auth'
import { assignmentReviewQueryKey, useAssignmentReview } from '@/hooks/use-assignment-review'
import { usePortfolioOverview } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { useContracts } from '@/hooks/use-contracts'
import { PageHeader } from '@/components/shared/page-header'
import { parsePositiveId } from '@/lib/format'
import type { Category } from '@/types/categories'
import type { ContractSummary } from '@/types/contracts'
import type { AssignmentBulkUpdate, AssignmentReviewFilters, ReviewIssue } from '@/types/review'

const selectClassName =
  'h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

const defaultFilters = (): AssignmentReviewFilters => ({
  issue: 'all',
  page: 1,
  page_size: 50
})

const AssignmentReviewContent = () => {
  const [searchParams] = useSearchParams()
  const initialContractId = parsePositiveId(searchParams.get('contract_id') ?? undefined)
  const queryClient = useQueryClient()
  const { state } = useAuth()
  const [filters, setFilters] = useState<AssignmentReviewFilters>(() => ({
    ...defaultFilters(),
    issue: initialContractId === undefined ? 'all' : 'contract',
    contract_id: initialContractId
  }))
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkCategory, setBulkCategory] = useState('__unset__')
  const [bulkContract, setBulkContract] = useState(
    initialContractId === undefined ? '__unset__' : String(initialContractId)
  )
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [contractDialogOpen, setContractDialogOpen] = useState(false)
  const review = useAssignmentReview(filters)
  const categories = useCategories()
  const contracts = useContracts()
  const portfolio = usePortfolioOverview()
  const mutation = useMutation({
    mutationFn: updateAssignments,
    onSuccess: async (updated) => {
      setSelectedIds(new Set())
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: assignmentReviewQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['contracts'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] })
      ])
      toast.success(
        updated === 1
          ? 'Eine Buchung wurde zugeordnet.'
          : `${updated} Buchungen wurden zugeordnet.`,
        { id: `assignments-updated-${Date.now()}` }
      )
    },
    onError: (error) =>
      toast.error('Die Zuordnung konnte nicht gespeichert werden.', {
        description: error instanceof Error ? error.message : 'Bitte versuche es erneut.',
        id: `assignment-update-error-${Date.now()}`
      })
  })

  const contractItems =
    contracts.status === 'success' ? [...contracts.data.active, ...contracts.data.inactive] : []
  const categoryItems = categories.status === 'success' ? categories.data : []
  const selectedRows =
    review.status === 'success'
      ? review.data.items.filter((row) => selectedIds.has(row.transaction.id))
      : []
  const selectedOwnerIds = new Set(selectedRows.map((row) => row.owner.id))
  const selectedOwner = selectedOwnerIds.size === 1 ? selectedRows[0]?.owner : undefined
  const canManageCategories = state.status === 'authenticated' && state.user.is_superuser
  const accounts = useMemo(
    () =>
      portfolio.status === 'success'
        ? portfolio.data.groups.flatMap((group) =>
            group.accounts.map((account) => ({ account, owner: group.owner }))
          )
        : [],
    [portfolio]
  )

  const apply = (payload: Omit<AssignmentBulkUpdate, 'transaction_ids'>, ids?: number[]) => {
    const transactionIds = ids ?? [...selectedIds]
    if (transactionIds.length === 0) {
      return
    }
    mutation.mutate({ ...payload, transaction_ids: transactionIds })
  }

  const applyBulkCategory = (category?: Category) => {
    const value = category === undefined ? bulkCategory : String(category.id)
    if (value === '__unset__') {
      return
    }
    apply({
      set_category: true,
      category_id: value === '__none__' ? null : Number(value),
      set_contract: false
    })
  }

  const applyBulkContract = (contract?: ContractSummary) => {
    const value = contract === undefined ? bulkContract : String(contract.id)
    if (value === '__unset__') {
      return
    }
    apply({
      set_category: false,
      set_contract: true,
      contract_id: value === '__none__' ? null : Number(value)
    })
  }

  const changeIssue = (issue: ReviewIssue) => {
    setFilters((current) => ({ ...current, issue, contract_id: undefined, page: 1 }))
    setSelectedIds(new Set())
  }

  if (
    review.status === 'loading' ||
    categories.status === 'loading' ||
    contracts.status === 'loading'
  ) {
    return <LoadingState title="Zuordnungen werden vorbereitet" />
  }
  if (review.status === 'error') {
    return <ErrorState error={review.error} title="Zuordnungen konnten nicht geladen werden" />
  }
  if (categories.status === 'error') {
    return <ErrorState error={categories.error} title="Kategorien konnten nicht geladen werden" />
  }
  if (contracts.status === 'error') {
    return <ErrorState error={contracts.error} title="Verträge konnten nicht geladen werden" />
  }

  const rows: AssignmentTableRow[] = review.data.items.map((row) => ({
    accountName: row.account_name,
    amount: row.transaction.amount,
    categoryId: row.transaction.category_id === null ? '' : String(row.transaction.category_id),
    categoryMatch: row.category_match,
    contractId: row.transaction.contract_id === null ? '' : String(row.transaction.contract_id),
    contractMatch: row.contract_match,
    dateIssue: row.transaction.date_issue,
    key: String(row.transaction.id),
    ownerId: row.owner.id,
    ownerName: `${row.owner.first_name} ${row.owner.last_name}`.trim() || row.owner.username,
    recipient: row.transaction.recipient,
    selected: selectedIds.has(row.transaction.id),
    subject: row.transaction.subject
  }))

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Offene Buchungen filtern</CardTitle>
          <CardDescription>
            Zeige nur die Zuordnungen, die Du gerade bearbeiten möchtest.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 lg:grid-cols-[auto_1fr_auto_auto] lg:items-end"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              setFilters((current) => ({ ...current, q: search.trim() || undefined, page: 1 }))
            }}
          >
            <div className="flex flex-wrap gap-2">
              {(['all', 'category', 'contract'] as const).map((issue) => (
                <Button
                  key={issue}
                  onClick={() => changeIssue(issue)}
                  type="button"
                  variant={filters.issue === issue ? 'default' : 'outline'}
                >
                  {issue === 'all' ? 'Alle' : issue === 'category' ? 'Kategorien' : 'Verträge'}
                </Button>
              ))}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assignment-search">Suche</Label>
              <Input
                id="assignment-search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Empfänger oder Betreff"
                value={search}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assignment-owner">Inhaber</Label>
              <select
                className={selectClassName}
                id="assignment-owner"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    owner_id: event.target.value === '' ? undefined : Number(event.target.value),
                    account_id: undefined,
                    page: 1
                  }))
                }
                value={filters.owner_id ?? ''}
              >
                <option value="">Alle</option>
                {portfolio.status === 'success'
                  ? portfolio.data.groups.map((group) => (
                      <option key={group.owner.id} value={group.owner.id}>
                        {`${group.owner.first_name} ${group.owner.last_name}`.trim() ||
                          group.owner.username}
                      </option>
                    ))
                  : null}
              </select>
            </div>
            <Button type="submit">
              <Search aria-hidden />
              Suchen
            </Button>
            <div className="grid gap-2 lg:col-start-3">
              <Label htmlFor="assignment-account">Konto</Label>
              <select
                className={selectClassName}
                id="assignment-account"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    account_id: event.target.value === '' ? undefined : Number(event.target.value),
                    page: 1
                  }))
                }
                value={filters.account_id ?? ''}
              >
                <option value="">Alle Konten</option>
                {accounts
                  .filter(
                    ({ owner }) => filters.owner_id === undefined || owner.id === filters.owner_id
                  )
                  .map(({ account, owner }) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {owner.username}
                    </option>
                  ))}
              </select>
            </div>
          </form>
        </CardContent>
      </Card>
      {review.data.items.length === 0 ? (
        <EmptyState
          description="Für die gewählten Filter gibt es keine offenen Zuordnungen."
          title="Alles geprüft"
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{selectedIds.size} Buchungen ausgewählt</CardTitle>
              <CardDescription>
                Wende eine Kategorie oder einen Vertrag gemeinsam auf die Auswahl an.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <Button
                onClick={() =>
                  setSelectedIds(
                    selectedIds.size === review.data.items.length
                      ? new Set()
                      : new Set(review.data.items.map((row) => row.transaction.id))
                  )
                }
                variant="outline"
              >
                <CheckCheck aria-hidden />
                {selectedIds.size === review.data.items.length
                  ? 'Auswahl aufheben'
                  : 'Seite auswählen'}
              </Button>
              <div className="grid gap-2">
                <Label htmlFor="bulk-category">Kategorie</Label>
                <select
                  className={selectClassName}
                  id="bulk-category"
                  onChange={(event) => setBulkCategory(event.target.value)}
                  value={bulkCategory}
                >
                  <option value="__unset__">Bitte auswählen</option>
                  <option value="__none__">Bewusst ohne Kategorie</option>
                  {categoryItems.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                disabled={
                  selectedIds.size === 0 || bulkCategory === '__unset__' || mutation.isPending
                }
                onClick={() => applyBulkCategory()}
                variant="secondary"
              >
                <Tags aria-hidden />
                Anwenden
              </Button>
              {canManageCategories ? (
                <Button
                  disabled={selectedIds.size === 0}
                  onClick={() => setCategoryDialogOpen(true)}
                  variant="outline"
                >
                  <Plus aria-hidden />
                  Neue Kategorie
                </Button>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="bulk-contract">Vertrag</Label>
                <select
                  className={selectClassName}
                  disabled={selectedOwner === undefined}
                  id="bulk-contract"
                  onChange={(event) => setBulkContract(event.target.value)}
                  value={bulkContract}
                >
                  <option value="__unset__">
                    {selectedOwnerIds.size > 1 ? 'Mehrere Inhaber ausgewählt' : 'Bitte auswählen'}
                  </option>
                  <option value="__none__">Bewusst ohne Vertrag</option>
                  {contractItems
                    .filter((contract) => contract.owner.id === selectedOwner?.id)
                    .map((contract) => (
                      <option key={contract.id} value={contract.id}>
                        {contract.name}
                        {contract.is_active ? '' : ' (inaktiv)'}
                      </option>
                    ))}
                </select>
              </div>
              <Button
                disabled={
                  selectedIds.size === 0 ||
                  selectedOwner === undefined ||
                  bulkContract === '__unset__' ||
                  mutation.isPending
                }
                onClick={() => applyBulkContract()}
                variant="secondary"
              >
                <Link2 aria-hidden />
                Anwenden
              </Button>
              <Button
                disabled={selectedOwner === undefined || selectedIds.size === 0}
                onClick={() => setContractDialogOpen(true)}
                variant="outline"
              >
                <Plus aria-hidden />
                Neuer Vertrag
              </Button>
            </CardContent>
          </Card>
          <AssignmentReviewTable
            categories={categoryItems}
            contracts={contractItems}
            onAssignmentChange={(key, assignment, value) =>
              apply(
                assignment === 'category'
                  ? {
                      set_category: true,
                      category_id: value === '' ? null : Number(value),
                      set_contract: false
                    }
                  : {
                      set_category: false,
                      set_contract: true,
                      contract_id: value === '' ? null : Number(value)
                    },
                [Number(key)]
              )
            }
            onSelectionChange={(key, selected) =>
              setSelectedIds((current) => {
                const next = new Set(current)
                if (selected) {
                  next.add(Number(key))
                } else {
                  next.delete(Number(key))
                }
                return next
              })
            }
            rows={rows}
          />
          <DataPagination
            itemLabel="offene Zuordnungen"
            onPageChange={(page) => {
              setSelectedIds(new Set())
              setFilters((current) => ({ ...current, page }))
            }}
            page={review.data.page}
            totalItems={review.data.total}
            totalPages={review.data.total_pages}
          />
        </>
      )}
      {categoryDialogOpen ? (
        <QuickCategoryDialog
          onCreated={applyBulkCategory}
          onOpenChange={setCategoryDialogOpen}
          open
        />
      ) : null}
      {contractDialogOpen && selectedOwner !== undefined ? (
        <QuickContractDialog
          onCreated={applyBulkContract}
          onOpenChange={setContractDialogOpen}
          open
          owner={selectedOwner}
        />
      ) : null}
    </>
  )
}

export const AssignmentReviewPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeView = searchParams.get('view') === 'transfers' ? 'transfers' : 'assignments'

  return (
    <>
      <PageHeader
        description="Prüfe Kategorien, Verträge und interne Umbuchungen gesammelt über alle sichtbaren Konten hinweg."
        title="Zuordnungen"
      />
      <Tabs
        onValueChange={(value) => {
          const next = new URLSearchParams(searchParams)
          if (value === 'transfers') {
            next.set('view', 'transfers')
          } else {
            next.delete('view')
          }
          setSearchParams(next)
        }}
        value={activeView}
      >
        <TabsList>
          <TabsTrigger value="assignments">Kategorien & Verträge</TabsTrigger>
          <TabsTrigger value="transfers">Umbuchungen</TabsTrigger>
        </TabsList>
        <TabsContent value="assignments">
          <AssignmentReviewContent />
        </TabsContent>
        <TabsContent value="transfers">
          <TransferReviewPanel />
        </TabsContent>
      </Tabs>
    </>
  )
}
