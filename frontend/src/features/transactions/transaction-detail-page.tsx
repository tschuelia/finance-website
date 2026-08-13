/* cspell:words Buchungsreferenz Kontotransaktion Wertstellungsdatum */

import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { useTransaction } from '@/hooks/use-transactions'
import { formatDate, formatDecimal, parsePositiveId } from '@/lib/format'
import { accountUrl, contractUrl, transactionEditUrl } from '@/routes/urls'
import { TransactionDeleteDialog } from '@/features/transactions/transaction-delete-dialog'

type TransactionDetailContentProps = {
  accountId: number
  transactionId: number
}

const TransactionDetailContent = ({ accountId, transactionId }: TransactionDetailContentProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const transaction = useTransaction(accountId, transactionId)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (transaction.status === 'loading') {
    return <LoadingState title="Transaktion wird geladen" />
  }

  if (transaction.status === 'error') {
    return <ErrorState error={transaction.error} />
  }

  const amountClass = transaction.data.amount.startsWith('-')
    ? 'text-destructive'
    : 'text-emerald-700 dark:text-emerald-400'

  return (
    <>
      <PageHeader
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={accountUrl(accountId, location.search)}>
                <ArrowLeft aria-hidden />
                Zur Übersicht
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={transactionEditUrl(accountId, transaction.data.id, location.search)}>
                <Pencil aria-hidden />
                Bearbeiten
              </Link>
            </Button>
            <Button onClick={() => setDeleteOpen(true)} variant="destructive">
              <Trash2 aria-hidden />
              Löschen
            </Button>
          </>
        }
        description={`Buchungsdatum: ${formatDate(transaction.data.date_issue)}`}
        title="Transaktion"
      />
      <Card>
        <CardHeader>
          <CardTitle className={`text-3xl ${amountClass}`}>
            {formatDecimal(transaction.data.amount)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-[minmax(10rem,1fr)_minmax(0,2fr)]">
            <dt className="text-sm font-medium text-muted-foreground">Konto</dt>
            <dd>
              <Link
                className="text-primary hover:underline"
                to={accountUrl(accountId, location.search)}
              >
                Zurück zu den Transaktionen
              </Link>
            </dd>
            <dt className="text-sm font-medium text-muted-foreground">Zahlung an/von</dt>
            <dd>{transaction.data.recipient || 'Unbekannt'}</dd>
            <dt className="text-sm font-medium text-muted-foreground">Betreff</dt>
            <dd className="whitespace-pre-wrap">{transaction.data.subject}</dd>
            <dt className="text-sm font-medium text-muted-foreground">Buchungsdatum</dt>
            <dd>{formatDate(transaction.data.date_issue)}</dd>
            <dt className="text-sm font-medium text-muted-foreground">Wertstellungsdatum</dt>
            <dd>{formatDate(transaction.data.date_booking)}</dd>
            <dt className="text-sm font-medium text-muted-foreground">Kategorie</dt>
            <dd>
              {transaction.data.category_name === null ? (
                <span className="text-muted-foreground">Nicht zugeordnet</span>
              ) : (
                <Badge variant="outline">{transaction.data.category_name}</Badge>
              )}
            </dd>
            <dt className="text-sm font-medium text-muted-foreground">Vertrag</dt>
            <dd>
              {transaction.data.contract_id === null || transaction.data.contract_name === null ? (
                <span className="text-muted-foreground">Kein Vertrag</span>
              ) : (
                <Link
                  className="text-primary hover:underline"
                  to={contractUrl(transaction.data.contract_id)}
                >
                  {transaction.data.contract_name}
                </Link>
              )}
            </dd>
            <dt className="text-sm font-medium text-muted-foreground">Gesamte Buchungsreferenz</dt>
            <dd className="whitespace-pre-wrap break-words">
              {transaction.data.full_subject_string}
            </dd>
          </dl>
        </CardContent>
      </Card>
      <TransactionDeleteDialog
        accountId={accountId}
        onDeleted={() => navigate(accountUrl(accountId, location.search), { replace: true })}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        transaction={transaction.data}
      />
    </>
  )
}

export const TransactionDetailPage = () => {
  const { accountId: accountIdParam, transactionId: transactionIdParam } = useParams()
  const accountId = parsePositiveId(accountIdParam)
  const transactionId = parsePositiveId(transactionIdParam)

  if (accountId === undefined || transactionId === undefined) {
    return (
      <EmptyState
        description="Die Transaktions-Adresse ist ungültig."
        title="Transaktion nicht gefunden"
      />
    )
  }

  return <TransactionDetailContent accountId={accountId} transactionId={transactionId} />
}
