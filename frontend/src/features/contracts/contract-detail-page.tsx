/* cspell:words Vertragslaufzeit Vertragsinhaber Buchungsvorgang Zuordnungsmuster */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Activity, Calendar, Euro, Link2, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { updateTransaction } from '@/api/transactions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataPagination } from '@/components/shared/data-pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { PageHeader } from '@/components/shared/page-header'
import { ContractDeleteDialog } from '@/features/contracts/contract-delete-dialog'
import { ContractEditorDialog } from '@/features/contracts/contract-editor-dialog'
import { ContractFiles } from '@/features/contracts/contract-files'
import { formatContractPeriod } from '@/features/contracts/contract-format'
import { TransactionEditorDialog } from '@/features/transactions/transaction-editor-dialog'
import { useContract } from '@/hooks/use-contracts'
import { formatDate, formatDecimal, parsePositiveId } from '@/lib/format'
import { CONTRACTS, accountUrl, contractAssignmentsUrl } from '@/routes/urls'
import type { Transaction } from '@/types/transactions'

export const ContractDetailPage = () => {
  const { contractId: contractIdParam } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const contractId = parsePositiveId(contractIdParam)
  const transactionPage = parsePositiveId(searchParams.get('page') ?? undefined) ?? 1
  const contract = useContract(contractId ?? Number.NaN, transactionPage)
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | undefined>()
  const unlinkMutation = useMutation({
    mutationFn: async (transaction: Transaction) => {
      if (transaction.bank_account_id === null) {
        throw new Error('Die Buchung ist keinem Konto zugeordnet.')
      }
      return await updateTransaction(transaction.bank_account_id, transaction.id, {
        bank_account_id: transaction.bank_account_id,
        recipient: transaction.recipient,
        amount: transaction.amount,
        subject: transaction.subject,
        date_issue: transaction.date_issue,
        date_booking: transaction.date_booking,
        full_subject_string: transaction.full_subject_string,
        category_id: transaction.category_id,
        contract_id: null,
        category_reviewed: transaction.category_reviewed,
        contract_reviewed: true
      })
    },
    onSuccess: async (transaction) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contract'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['assignment-review'] })
      ])
      toast.success('Die Vertragszuordnung wurde entfernt.', {
        id: `contract-unlinked-${transaction.id}`
      })
      setSelectedTransaction(undefined)
    },
    onError: (error) =>
      toast.error('Die Vertragszuordnung konnte nicht entfernt werden.', {
        description: error instanceof Error ? error.message : 'Bitte versuche es erneut.',
        id: `contract-unlink-error-${Date.now()}`
      })
  })

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
  return (
    <>
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to={contractAssignmentsUrl(contract.data.id)}>
                <Link2 aria-hidden />
                Buchungen zuordnen
              </Link>
            </Button>
            <Button onClick={() => setEditorOpen(true)}>
              <Pencil aria-hidden />
              Bearbeiten
            </Button>
            <Button onClick={() => setDeleteOpen(true)} variant="destructive">
              <Trash2 aria-hidden />
              Löschen
            </Button>
          </div>
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
      <Card>
        <CardHeader>
          <CardTitle>Zuordnungsmuster</CardTitle>
          <CardDescription>
            Diese Begriffe erzeugen Vorschläge für passende Buchungen innerhalb der Laufzeit.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {contract.data.patterns.trim() === '' ? (
            <p className="text-sm text-muted-foreground">Noch keine Muster hinterlegt.</p>
          ) : (
            contract.data.patterns
              .split(/\r?\n/)
              .filter(Boolean)
              .map((pattern) => (
                <span className="rounded-md bg-muted px-2 py-1 text-sm" key={pattern}>
                  {pattern}
                </span>
              ))
          )}
          {contract.data.suggestion_count === 0 ? null : (
            <Badge className="basis-full w-fit" variant="secondary">
              {contract.data.suggestion_count === 1
                ? '1 offener Zuordnungsvorschlag'
                : `${contract.data.suggestion_count} offene Zuordnungsvorschläge`}
            </Badge>
          )}
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
                  aria-haspopup={transaction.bank_account_id === null ? undefined : 'dialog'}
                  aria-label={
                    transaction.bank_account_id === null
                      ? undefined
                      : `Transaktion für ${transaction.recipient || transaction.subject} öffnen`
                  }
                  className={`grid items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] ${
                    transaction.bank_account_id === null
                      ? ''
                      : 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
                  }`}
                  key={transaction.id}
                  onClick={
                    transaction.bank_account_id === null
                      ? undefined
                      : () => setSelectedTransaction(transaction)
                  }
                  onKeyDown={
                    transaction.bank_account_id === null
                      ? undefined
                      : (event) => {
                          if (
                            event.target === event.currentTarget &&
                            (event.key === 'Enter' || event.key === ' ')
                          ) {
                            event.preventDefault()
                            setSelectedTransaction(transaction)
                          }
                        }
                  }
                  tabIndex={transaction.bank_account_id === null ? undefined : 0}
                >
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate font-medium">
                      {transaction.recipient || transaction.subject}
                    </span>
                    {transaction.bank_account_id === null ? null : (
                      <Link
                        className="w-fit text-xs text-primary hover:underline"
                        onClick={(event) => event.stopPropagation()}
                        to={accountUrl(transaction.bank_account_id)}
                      >
                        {transaction.bank_account_name ?? 'Zum Konto'}
                      </Link>
                    )}
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
        </CardContent>
      </Card>
      {editorOpen ? (
        <ContractEditorDialog contract={contract.data} onOpenChange={setEditorOpen} open />
      ) : null}
      {deleteOpen ? (
        <ContractDeleteDialog contract={contract.data} onOpenChange={setDeleteOpen} open />
      ) : null}
      {selectedTransaction === undefined || selectedTransaction.bank_account_id === null ? null : (
        <TransactionEditorDialog
          accountId={selectedTransaction.bank_account_id}
          contractUnlinkPending={unlinkMutation.isPending}
          key={selectedTransaction.id}
          onContractUnlink={() => unlinkMutation.mutate(selectedTransaction)}
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
