/* cspell:words Buchungsdatum Buchungsreferenz Empfänger Transaktion */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Trash2, Unlink } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { updateTransaction } from '@/api/transactions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { TransactionDeleteDialog } from '@/features/transactions/transaction-delete-dialog'
import {
  transactionDraftFromTransaction,
  transactionWriteFromDraft
} from '@/features/transactions/transaction-draft'
import { TransactionDraftFields } from '@/features/transactions/transaction-form'
import { invalidateAccountTransactionData } from '@/features/transactions/transaction-query'
import { useTransactionFormOptions } from '@/features/transactions/use-transaction-form-options'
import { useAccount } from '@/hooks/use-accounts'
import { formatDate, formatDecimal } from '@/lib/format'
import type { Transaction } from '@/types/transactions'

type TransactionEditorDialogProps = {
  accountId: number
  contractUnlinkPending?: boolean
  onContractUnlink?: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  transaction: Transaction
}

const mutationErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Die Transaktion konnte nicht gespeichert werden.'

export const TransactionEditorDialog = ({
  accountId,
  contractUnlinkPending,
  onContractUnlink,
  onOpenChange,
  open,
  transaction
}: TransactionEditorDialogProps) => {
  const queryClient = useQueryClient()
  const options = useTransactionFormOptions()
  const account = useAccount(accountId)
  const [deleteOpen, setDeleteOpen] = useState(false)
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
      onOpenChange(false)
    },
    onError: (error) => setFormError(mutationErrorMessage(error))
  })
  const isPending = mutation.isPending || contractUnlinkPending === true

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Transaktion bearbeiten</DialogTitle>
            <DialogDescription>
              {transaction.recipient || 'Unbekannter Empfänger'} ·{' '}
              {formatDate(transaction.date_issue)} · {formatDecimal(transaction.amount)}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              if (isPending) {
                return
              }
              setFormError(undefined)
              mutation.mutate()
            }}
          >
            {options.status === 'loading' || account.status === 'loading' ? (
              <LoadingState title="Formular wird vorbereitet" />
            ) : options.status === 'error' ? (
              <ErrorState error={options.error} title="Formular konnte nicht vorbereitet werden" />
            ) : account.status === 'error' ? (
              <ErrorState error={account.error} title="Konto konnte nicht geladen werden" />
            ) : (
              <TransactionDraftFields
                accountId={accountId}
                categories={options.categories}
                contracts={options.contracts.filter(
                  (contract) => contract.owner.id === account.data.owner.id
                )}
                draft={draft}
                idPrefix={`transaction-dialog-${transaction.id}`}
                onChange={setDraft}
              />
            )}
            {formError === undefined ? null : (
              <p className="text-sm text-destructive">{formError}</p>
            )}
            <DialogFooter className="flex-col gap-2 sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  disabled={isPending}
                  onClick={() => setDeleteOpen(true)}
                  type="button"
                  variant="destructive"
                >
                  <Trash2 aria-hidden />
                  Löschen
                </Button>
                {onContractUnlink === undefined || transaction.contract_id === null ? null : (
                  <Button
                    disabled={isPending}
                    onClick={onContractUnlink}
                    type="button"
                    variant="outline"
                  >
                    <Unlink aria-hidden />
                    {contractUnlinkPending === true
                      ? 'Wird entfernt …'
                      : 'Vertragszuordnung entfernen'}
                  </Button>
                )}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <DialogClose asChild>
                  <Button disabled={isPending} type="button" variant="outline">
                    Schließen
                  </Button>
                </DialogClose>
                <Button
                  disabled={
                    isPending || options.status !== 'success' || account.status !== 'success'
                  }
                  type="submit"
                >
                  <Save aria-hidden />
                  {mutation.isPending ? 'Wird gespeichert …' : 'Änderungen speichern'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <TransactionDeleteDialog
        accountId={accountId}
        onDeleted={() => onOpenChange(false)}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        transaction={transaction}
      />
    </>
  )
}
