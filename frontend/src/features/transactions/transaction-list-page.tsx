/* cspell:words Kontotransaktionen Neukategorisierung Sammelerfassung */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FilePlus2, ListPlus, RefreshCw, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { recategorizeAccount } from '@/api/categories'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { useCategories } from '@/hooks/use-categories'
import { useTransactions } from '@/hooks/use-transactions'
import { parsePositiveId } from '@/lib/format'
import {
  accountTransactionBulkUrl,
  accountTransactionImportUrl,
  accountTransactionNewUrl,
  accountUrl
} from '@/routes/urls'
import type { Transaction, TransactionFilters } from '@/types/transactions'
import { TransactionDeleteDialog } from '@/features/transactions/transaction-delete-dialog'
import { TransactionFilterForm } from '@/features/transactions/transaction-filters'
import { invalidateAccountTransactionData } from '@/features/transactions/transaction-query'
import {
  transactionFiltersForPage,
  transactionFiltersFromSearch,
  transactionFiltersToSearch
} from '@/features/transactions/transaction-search'
import {
  TransactionPagination,
  TransactionSummaryCards,
  TransactionTable
} from '@/features/transactions/transaction-table'

type TransactionListContentProps = {
  accountId: number
}

const mutationErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Die Änderung konnte nicht durchgeführt werden.'

const TransactionListContent = ({ accountId }: TransactionListContentProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const filters = useMemo(() => transactionFiltersFromSearch(location.search), [location.search])
  const transactions = useTransactions(accountId, filters)
  const categories = useCategories()
  const [deletedTransaction, setDeletedTransaction] = useState<Transaction | undefined>()
  const [recategorizationOpen, setRecategorizationOpen] = useState(false)
  const recategorization = useMutation({
    mutationFn: async () => await recategorizeAccount(accountId),
    onSuccess: async (result) => {
      await invalidateAccountTransactionData(queryClient, accountId)
      toast.success('Die Kategorien wurden neu zugeordnet.', {
        description:
          result.changed === 1
            ? 'Eine Transaktion wurde neu kategorisiert.'
            : `${result.changed} Transaktionen wurden neu kategorisiert.`,
        id: `transactions-recategorized-${accountId}-${Date.now()}`
      })
      setRecategorizationOpen(false)
    },
    onError: (error) => {
      const message = mutationErrorMessage(error)
      toast.error('Die Neukategorisierung ist fehlgeschlagen.', {
        description: message,
        id: `transactions-recategorization-error-${accountId}-${message.slice(0, 100)}`
      })
    }
  })

  const applyFilters = (nextFilters: TransactionFilters) => {
    navigate(accountUrl(accountId, transactionFiltersToSearch(nextFilters)))
  }

  const pageActions = (
    <>
      <Button asChild variant="outline">
        <Link to={{ pathname: accountTransactionImportUrl(accountId), search: location.search }}>
          <Upload aria-hidden />
          CSV importieren
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link to={{ pathname: accountTransactionBulkUrl(accountId), search: location.search }}>
          <ListPlus aria-hidden />
          Sammelerfassung
        </Link>
      </Button>
      <Button asChild>
        <Link to={{ pathname: accountTransactionNewUrl(accountId), search: location.search }}>
          <FilePlus2 aria-hidden />
          Neue Transaktion
        </Link>
      </Button>
    </>
  )

  if (transactions.status === 'loading') {
    return (
      <>
        <PageHeader
          actions={pageActions}
          description="Deine Buchungen werden serverseitig gefiltert und paginiert."
          title="Kontotransaktionen"
        />
        <LoadingState title="Transaktionen werden geladen" />
      </>
    )
  }

  if (transactions.status === 'error') {
    return (
      <>
        <PageHeader title="Kontotransaktionen" />
        <ErrorState error={transactions.error} />
      </>
    )
  }

  const categoryError =
    categories.status === 'error'
      ? (categories.error.problem?.detail ?? 'Die Kategorien konnten nicht geladen werden.')
      : undefined

  return (
    <>
      <PageHeader
        actions={pageActions}
        description="Filter, Seite und Auswahl bleiben in der Adresse erhalten."
        title="Kontotransaktionen"
      />
      <TransactionFilterForm
        categories={categories.status === 'success' ? categories.data : []}
        categoriesError={categoryError}
        categoriesLoading={categories.status === 'loading'}
        filters={filters}
        key={location.search}
        onApply={applyFilters}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {transactions.data.total === 1
            ? '1 passende Transaktion'
            : `${transactions.data.total} passende Transaktionen`}
        </p>
        <Button onClick={() => setRecategorizationOpen(true)} size="sm" variant="outline">
          <RefreshCw aria-hidden />
          Kategorien neu zuordnen
        </Button>
      </div>
      <TransactionSummaryCards summary={transactions.data.summary} />
      <TransactionTable
        accountId={accountId}
        items={transactions.data.items}
        onDelete={setDeletedTransaction}
        search={location.search}
      />
      <TransactionPagination
        onPageChange={(page) => applyFilters(transactionFiltersForPage(filters, page))}
        page={transactions.data}
      />
      <TransactionDeleteDialog
        accountId={accountId}
        onDeleted={() => setDeletedTransaction(undefined)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletedTransaction(undefined)
          }
        }}
        open={deletedTransaction !== undefined}
        transaction={deletedTransaction}
      />
      <AlertDialog onOpenChange={setRecategorizationOpen} open={recategorizationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategorien neu zuordnen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Regeln aller Kategorien werden auf sämtliche Transaktionen dieses Kontos
              angewendet. Bestehende Kategorien können dabei ersetzt werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {recategorization.isError ? (
            <p className="text-sm text-destructive">
              {mutationErrorMessage(recategorization.error)}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={recategorization.isPending}>Abbrechen</AlertDialogCancel>
            <Button disabled={recategorization.isPending} onClick={() => recategorization.mutate()}>
              <RefreshCw aria-hidden />
              {recategorization.isPending ? 'Wird zugeordnet …' : 'Jetzt neu zuordnen'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export const TransactionListPage = () => {
  const { accountId: accountIdParam } = useParams()
  const accountId = parsePositiveId(accountIdParam)

  if (accountId === undefined) {
    return <EmptyState description="Die Konto-Adresse ist ungültig." title="Konto nicht gefunden" />
  }

  return <TransactionListContent accountId={accountId} />
}
