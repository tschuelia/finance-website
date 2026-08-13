/* cspell:words Kontotransaktion */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { updateTransaction } from '@/api/transactions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { useTransaction } from '@/hooks/use-transactions'
import { parsePositiveId } from '@/lib/format'
import { transactionUrl } from '@/routes/urls'
import {
  transactionDraftFromTransaction,
  transactionWriteFromDraft
} from '@/features/transactions/transaction-draft'
import { TransactionForm } from '@/features/transactions/transaction-form'
import { invalidateAccountTransactionData } from '@/features/transactions/transaction-query'
import { useTransactionFormOptions } from '@/features/transactions/use-transaction-form-options'
import type { Transaction } from '@/types/transactions'

type TransactionEditFormProps = {
  accountId: number
  transaction: Transaction
}

type TransactionEditContentProps = {
  accountId: number
  transactionId: number
}

const mutationErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Die Transaktion konnte nicht gespeichert werden.'

const TransactionEditForm = ({ accountId, transaction }: TransactionEditFormProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const options = useTransactionFormOptions()
  const [draft, setDraft] = useState(() => transactionDraftFromTransaction(transaction))
  const [formError, setFormError] = useState<string | undefined>()
  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = transactionWriteFromDraft(accountId, draft)

      if (parsed.status === 'invalid') {
        throw new Error(parsed.message)
      }

      return await updateTransaction(accountId, transaction.id, parsed.value)
    },
    onSuccess: async () => {
      await invalidateAccountTransactionData(queryClient, accountId)
      toast.success('Die Transaktion wurde aktualisiert.', {
        id: `transaction-updated-${accountId}-${transaction.id}`
      })
      navigate(transactionUrl(accountId, transaction.id, location.search), { replace: true })
    },
    onError: (error) => setFormError(mutationErrorMessage(error))
  })

  if (options.status === 'loading') {
    return <LoadingState title="Formular wird vorbereitet" />
  }

  if (options.status === 'error') {
    return <ErrorState error={options.error} title="Formular konnte nicht vorbereitet werden" />
  }

  return (
    <>
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link to={transactionUrl(accountId, transaction.id, location.search)}>
              <ArrowLeft aria-hidden />
              Zurück zur Transaktion
            </Link>
          </Button>
        }
        description="Prüfe Deine Änderungen, bevor Du sie speicherst."
        title="Transaktion bearbeiten"
      />
      <Card>
        <CardContent className="pt-6">
          <TransactionForm
            accountId={accountId}
            categories={options.categories}
            contracts={options.contracts}
            draft={draft}
            error={formError}
            idPrefix={`transaction-edit-${transaction.id}`}
            isSubmitting={mutation.isPending}
            onChange={setDraft}
            onSubmit={() => {
              setFormError(undefined)
              mutation.mutate()
            }}
            submitLabel="Änderungen speichern"
          />
        </CardContent>
      </Card>
    </>
  )
}

const TransactionEditContent = ({ accountId, transactionId }: TransactionEditContentProps) => {
  const transaction = useTransaction(accountId, transactionId)

  if (transaction.status === 'loading') {
    return <LoadingState title="Transaktion wird geladen" />
  }

  if (transaction.status === 'error') {
    return <ErrorState error={transaction.error} />
  }

  return <TransactionEditForm accountId={accountId} transaction={transaction.data} />
}

export const TransactionEditPage = () => {
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

  return <TransactionEditContent accountId={accountId} transactionId={transactionId} />
}
