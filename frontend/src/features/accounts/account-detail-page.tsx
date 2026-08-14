import { Building, Calendar, Dot, Upload, User } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { useAccount } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { useTransactions } from '@/hooks/use-transactions'
import { formatDate, parsePositiveId } from '@/lib/format'
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

type AccountDetailContentProps = {
  accountId: number
}

const AccountDetailContent = ({ accountId }: AccountDetailContentProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const filters = useMemo(() => transactionFiltersFromSearch(location.search), [location.search])
  const account = useAccount(accountId)
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

  if (account.status === 'loading') {
    return <LoadingState title="Konto wird geladen" />
  }

  if (account.status === 'error') {
    return <ErrorState error={account.error} />
  }

  const metadata = (
    <span className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1">
        <User aria-hidden size={14} />
        {account.data.owner.username}
      </span>
      <Dot aria-hidden size={12} />
      <span className="flex items-center gap-1">
        <Calendar aria-hidden size={14} />
        {formatDate(account.data.newest_transaction_date)}
      </span>
      <Dot aria-hidden size={12} />
      <span className="flex items-center gap-1">
        <Building aria-hidden size={14} />
        {account.data.bank}
      </span>
    </span>
  )

  const pageHeader = (
    <PageHeader actions={pageActions} description={metadata} title={account.data.name} />
  )

  if (transactions.status === 'loading') {
    return (
      <>
        {pageHeader}
        <LoadingState title="Transaktionen werden geladen" />
      </>
    )
  }

  if (transactions.status === 'error') {
    return (
      <>
        {pageHeader}
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
      {pageHeader}
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

export const AccountDetailPage = () => {
  const { accountId: accountIdParam } = useParams()
  const accountId = parsePositiveId(accountIdParam)

  if (accountId === undefined) {
    return <EmptyState description="Die Konto-Adresse ist ungültig." title="Konto nicht gefunden" />
  }

  return <AccountDetailContent accountId={accountId} />
}
