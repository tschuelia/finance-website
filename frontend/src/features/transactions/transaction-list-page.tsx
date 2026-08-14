/* cspell:words Kontotransaktionen */

import { Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { useCategories } from '@/hooks/use-categories'
import { useTransactions } from '@/hooks/use-transactions'
import { parsePositiveId } from '@/lib/format'
import { accountTransactionImportUrl, accountUrl } from '@/routes/urls'
import type { Transaction, TransactionFilters } from '@/types/transactions'
import { TransactionEditorDialog } from '@/features/transactions/transaction-editor-dialog'
import { TransactionFilterForm } from '@/features/transactions/transaction-filters'
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

const TransactionListContent = ({ accountId }: TransactionListContentProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const filters = useMemo(() => transactionFiltersFromSearch(location.search), [location.search])
  const transactions = useTransactions(accountId, filters)
  const categories = useCategories()
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | undefined>()

  const applyFilters = (nextFilters: TransactionFilters) => {
    navigate(accountUrl(accountId, transactionFiltersToSearch(nextFilters)))
  }

  const pageActions = (
    <Button asChild>
      <Link to={{ pathname: accountTransactionImportUrl(accountId), search: location.search }}>
        <Upload aria-hidden />
        CSV importieren
      </Link>
    </Button>
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

  const metadata = <div className="flex items-center gap-2 text-muted-foreground text-sm">{}</div>

  return (
    <>
      <PageHeader actions={pageActions} description={metadata} title="Kontotransaktionen" />
      <TransactionFilterForm
        categories={categories.status === 'success' ? categories.data : []}
        categoriesError={categoryError}
        categoriesLoading={categories.status === 'loading'}
        filters={filters}
        key={location.search}
        onApply={applyFilters}
      />
      <p className="text-sm text-muted-foreground">
        {transactions.data.total === 1
          ? '1 passende Transaktion'
          : `${transactions.data.total} passende Transaktionen`}
      </p>
      <TransactionSummaryCards summary={transactions.data.summary} />
      <TransactionTable items={transactions.data.items} onSelect={setSelectedTransaction} />
      <TransactionPagination
        onPageChange={(page) => applyFilters(transactionFiltersForPage(filters, page))}
        page={transactions.data}
      />
      {selectedTransaction === undefined ? null : (
        <TransactionEditorDialog
          accountId={accountId}
          key={selectedTransaction.id}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTransaction(undefined)
            }
          }}
          open
          transaction={selectedTransaction}
        />
      )}
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
