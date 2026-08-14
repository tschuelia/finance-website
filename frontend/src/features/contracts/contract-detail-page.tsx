/* cspell:words Vertragslaufzeit Vertragsinhaber Buchungsvorgang */

import { Activity, Calendar, Euro, Pencil } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataPagination } from '@/components/shared/data-pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { PageHeader } from '@/components/shared/page-header'
import { ContractFiles } from '@/features/contracts/contract-files'
import { formatContractPeriod } from '@/features/contracts/contract-format'
import { useContract } from '@/hooks/use-contracts'
import { formatDate, formatDecimal, parsePositiveId } from '@/lib/format'
import { CONTRACTS, accountUrl, contractEditUrl } from '@/routes/urls'

export const ContractDetailPage = () => {
  const { contractId: contractIdParam } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const contractId = parsePositiveId(contractIdParam)
  const transactionPage = parsePositiveId(searchParams.get('page') ?? undefined) ?? 1
  const contract = useContract(contractId ?? Number.NaN, transactionPage)

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
  const firstAccountTransaction = contract.data.transactions.items.find(
    (transaction) => transaction.bank_account_id !== null
  )

  return (
    <>
      <PageHeader
        actions={
          <Button asChild>
            <Link to={contractEditUrl(contract.data.id)}>
              <Pencil aria-hidden />
              Bearbeiten
            </Link>
          </Button>
        }
        breadcrumbs={[{ label: 'Verträge', to: CONTRACTS }, { label: contract.data.name }]}
        description={`Vertragsinhaber: ${owner}`}
        title={contract.data.name}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription className="items-center flex gap-2">
              <Activity size={14} />
              Status
            </CardDescription>
            <CardTitle>{contract.data.is_active ? 'Aktiv' : 'Inaktiv'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="items-center flex gap-2">
              <Calendar size={14} />
              Vertragslaufzeit
            </CardDescription>
            <CardTitle className="text-base">{formatContractPeriod(contract.data)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="items-center flex gap-2">
              <Euro size={14} />
              Buchungssaldo
            </CardDescription>
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
          {contract.data.transactions.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Buchungen zugeordnet.</p>
          ) : (
            <ul className="grid divide-y rounded-lg border">
              {contract.data.transactions.items.map((transaction) => (
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
          <DataPagination
            itemLabel="Buchungen"
            onPageChange={(page) => {
              const nextParams = new URLSearchParams(searchParams)
              nextParams.set('page', String(page))
              setSearchParams(nextParams)
            }}
            page={contract.data.transactions.page}
            totalItems={contract.data.transactions.total}
            totalPages={contract.data.transactions.total_pages}
          />
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
