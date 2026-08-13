/* cspell:words Kontotransaktion */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { createTransactions } from '@/api/transactions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { parsePositiveId } from '@/lib/format'
import { accountUrl } from '@/routes/urls'
import {
  createTransactionDraft,
  transactionWriteFromDraft
} from '@/features/transactions/transaction-draft'
import { TransactionForm } from '@/features/transactions/transaction-form'
import { invalidateAccountTransactionData } from '@/features/transactions/transaction-query'
import { useTransactionFormOptions } from '@/features/transactions/use-transaction-form-options'

type TransactionCreateContentProps = {
  accountId: number
}

const mutationErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Die Transaktion konnte nicht gespeichert werden.'

const TransactionCreateContent = ({ accountId }: TransactionCreateContentProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const options = useTransactionFormOptions()
  const [draft, setDraft] = useState(createTransactionDraft)
  const [formError, setFormError] = useState<string | undefined>()
  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = transactionWriteFromDraft(accountId, draft)

      if (parsed.status === 'invalid') {
        throw new Error(parsed.message)
      }

      return await createTransactions(accountId, [parsed.value])
    },
    onSuccess: async (result) => {
      await invalidateAccountTransactionData(queryClient, accountId)
      toast.success('Die Transaktion wurde gespeichert.', {
        id: `transaction-created-${accountId}-${result.items[0]?.id ?? Date.now()}`
      })
      navigate(accountUrl(accountId, location.search), { replace: true })
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
            <Link to={accountUrl(accountId, location.search)}>
              <ArrowLeft aria-hidden />
              Zurück zu den Transaktionen
            </Link>
          </Button>
        }
        description="Erfasse eine einzelne Buchung für dieses Konto."
        title="Neue Transaktion"
      />
      <Card>
        <CardContent className="pt-6">
          <TransactionForm
            accountId={accountId}
            categories={options.categories}
            contracts={options.contracts}
            draft={draft}
            error={formError}
            idPrefix="transaction-create"
            isSubmitting={mutation.isPending}
            onChange={setDraft}
            onSubmit={() => {
              setFormError(undefined)
              mutation.mutate()
            }}
            submitLabel="Transaktion speichern"
          />
        </CardContent>
      </Card>
    </>
  )
}

export const TransactionCreatePage = () => {
  const { accountId: accountIdParam } = useParams()
  const accountId = parsePositiveId(accountIdParam)

  if (accountId === undefined) {
    return <EmptyState description="Die Konto-Adresse ist ungültig." title="Konto nicht gefunden" />
  }

  return <TransactionCreateContent accountId={accountId} />
}
