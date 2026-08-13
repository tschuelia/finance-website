/* cspell:words Buchungsreferenz Kontotransaktionen Sammelerfassung */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { createTransactions } from '@/api/transactions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { parsePositiveId } from '@/lib/format'
import { accountUrl } from '@/routes/urls'
import {
  createTransactionDraft,
  transactionWriteFromDraft
} from '@/features/transactions/transaction-draft'
import { TransactionDraftFields } from '@/features/transactions/transaction-form'
import { invalidateAccountTransactionData } from '@/features/transactions/transaction-query'
import { useTransactionFormOptions } from '@/features/transactions/use-transaction-form-options'
import type { TransactionDraft } from '@/features/transactions/transaction-draft'
import type { TransactionWrite } from '@/types/transactions'

type TransactionBulkContentProps = {
  accountId: number
}

const maximumRows = 500

const mutationErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Die Transaktionen konnten nicht gespeichert werden.'

const TransactionBulkContent = ({ accountId }: TransactionBulkContentProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const options = useTransactionFormOptions()
  const [rows, setRows] = useState<TransactionDraft[]>([createTransactionDraft()])
  const [formError, setFormError] = useState<string | undefined>()
  const mutation = useMutation({
    mutationFn: async (items: TransactionWrite[]) => await createTransactions(accountId, items),
    onSuccess: async (result) => {
      await invalidateAccountTransactionData(queryClient, accountId)
      toast.success('Die Transaktionen wurden gespeichert.', {
        description:
          result.created === 1
            ? 'Eine Transaktion wurde atomar übernommen.'
            : `${result.created} Transaktionen wurden atomar übernommen.`,
        id: `transactions-bulk-created-${accountId}-${Date.now()}`
      })
      navigate(accountUrl(accountId, location.search), { replace: true })
    },
    onError: (error) => setFormError(mutationErrorMessage(error))
  })

  const updateRow = (rowIndex: number, draft: TransactionDraft) => {
    setRows((current) => current.map((row, index) => (index === rowIndex ? draft : row)))
  }

  const removeRow = (rowIndex: number) => {
    setRows((current) => current.filter((_, index) => index !== rowIndex))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const items: TransactionWrite[] = []

    for (const [index, row] of rows.entries()) {
      const parsed = transactionWriteFromDraft(accountId, row)

      if (parsed.status === 'invalid') {
        setFormError(`Zeile ${index + 1}: ${parsed.message}`)
        return
      }

      items.push(parsed.value)
    }

    if (items.length === 0) {
      setFormError('Bitte füge mindestens eine Transaktion hinzu.')
      return
    }

    setFormError(undefined)
    mutation.mutate(items)
  }

  if (options.status === 'loading') {
    return <LoadingState title="Sammelerfassung wird vorbereitet" />
  }

  if (options.status === 'error') {
    return (
      <ErrorState error={options.error} title="Sammelerfassung konnte nicht vorbereitet werden" />
    )
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
        description="Alle Zeilen werden zusammen geprüft und entweder vollständig oder gar nicht gespeichert."
        title="Transaktionen sammeln erfassen"
      />
      <form className="grid gap-4" onSubmit={submit}>
        {rows.map((row, index) => (
          <Card key={`bulk-row-${index}`}>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Transaktion {index + 1}</CardTitle>
                <CardDescription>
                  Fülle alle erforderlichen Angaben für diese Buchung aus.
                </CardDescription>
              </div>
              <Button
                aria-label={`Transaktion ${index + 1} entfernen`}
                disabled={rows.length === 1 || mutation.isPending}
                onClick={() => removeRow(index)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Trash2 aria-hidden className="text-destructive" />
              </Button>
            </CardHeader>
            <CardContent>
              <TransactionDraftFields
                accountId={accountId}
                categories={options.categories}
                contracts={options.contracts}
                draft={row}
                idPrefix={`bulk-${index}`}
                onChange={(draft) => updateRow(index, draft)}
              />
            </CardContent>
          </Card>
        ))}
        {formError === undefined ? null : <p className="text-sm text-destructive">{formError}</p>}
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            disabled={rows.length >= maximumRows || mutation.isPending}
            onClick={() => setRows((current) => [...current, createTransactionDraft()])}
            type="button"
            variant="outline"
          >
            <Plus aria-hidden />
            Weitere Zeile
          </Button>
          <Button disabled={mutation.isPending || rows.length === 0} type="submit">
            <Save aria-hidden />
            {mutation.isPending ? 'Wird gespeichert …' : `${rows.length} Transaktionen speichern`}
          </Button>
        </div>
      </form>
    </>
  )
}

export const TransactionBulkPage = () => {
  const { accountId: accountIdParam } = useParams()
  const accountId = parsePositiveId(accountIdParam)

  if (accountId === undefined) {
    return <EmptyState description="Die Konto-Adresse ist ungültig." title="Konto nicht gefunden" />
  }

  return <TransactionBulkContent accountId={accountId} />
}
