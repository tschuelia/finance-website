/* cspell:words Transaktion */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteTransaction } from '@/api/transactions'
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
import { formatDecimal } from '@/lib/format'
import type { Transaction } from '@/types/transactions'
import { invalidateAccountTransactionData } from '@/features/transactions/transaction-query'

type TransactionDeleteDialogProps = {
  accountId: number
  onDeleted: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  transaction: Transaction | undefined
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Die Transaktion konnte nicht gelöscht werden.'

export const TransactionDeleteDialog = ({
  accountId,
  onDeleted,
  onOpenChange,
  open,
  transaction
}: TransactionDeleteDialogProps) => {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => {
      if (transaction === undefined) {
        throw new Error('Die zu löschende Transaktion fehlt.')
      }

      await deleteTransaction(accountId, transaction.id)
    },
    onSuccess: async () => {
      await invalidateAccountTransactionData(queryClient, accountId)
      toast.success('Die Transaktion wurde gelöscht.', {
        id: `transaction-deleted-${accountId}-${transaction?.id ?? 'unknown'}`
      })
      onOpenChange(false)
      onDeleted()
    },
    onError: (error) => {
      const message = errorMessage(error)
      toast.error('Die Transaktion konnte nicht gelöscht werden.', {
        description: message,
        id: `transaction-delete-error-${accountId}-${transaction?.id ?? 'unknown'}-${message.slice(0, 100)}`
      })
    }
  })

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Transaktion löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            {transaction === undefined
              ? 'Diese Aktion kann nicht rückgängig gemacht werden.'
              : `Du löschst ${formatDecimal(transaction.amount)} für „${transaction.recipient || transaction.subject}“. Diese Aktion kann nicht rückgängig gemacht werden.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.isError ? (
          <p className="text-sm text-destructive">{errorMessage(mutation.error)}</p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Abbrechen</AlertDialogCancel>
          <Button
            disabled={mutation.isPending || transaction === undefined}
            onClick={() => mutation.mutate()}
            variant="destructive"
          >
            <Trash2 aria-hidden />
            {mutation.isPending ? 'Wird gelöscht …' : 'Endgültig löschen'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
