/* cspell:words Vertragszuordnung Vertragszuordnungen */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { deleteContract } from '@/api/contracts'
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
import { contractsQueryKey } from '@/hooks/use-contracts'
import { CONTRACTS } from '@/routes/urls'
import type { ContractDetail } from '@/types/contracts'

type ContractDeleteDialogProps = {
  contract: ContractDetail
  onOpenChange: (open: boolean) => void
  open: boolean
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Der Vertrag konnte nicht gelöscht werden.'

const bookingNotice = (total: number): string => {
  if (total === 0) {
    return 'Es sind keine Buchungen zugeordnet.'
  }
  if (total === 1) {
    return 'Eine zugeordnete Buchung bleibt erhalten und ihre Vertragszuordnung wird entfernt.'
  }
  return `${total} zugeordnete Buchungen bleiben erhalten und ihre Vertragszuordnungen werden entfernt.`
}

const fileNotice = (total: number): string => {
  if (total === 0) {
    return ''
  }
  if (total === 1) {
    return ' Eine hinterlegte Datei wird dauerhaft gelöscht.'
  }
  return ` ${total} hinterlegte Dateien werden dauerhaft gelöscht.`
}

export const ContractDeleteDialog = ({
  contract,
  onOpenChange,
  open
}: ContractDeleteDialogProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => await deleteContract(contract.id),
    onSuccess: async () => {
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] === 'contract' && query.queryKey[2] === contract.id
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: contractsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['assignment-review'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] })
      ])
      toast.success('Der Vertrag wurde gelöscht.', {
        id: `contract-deleted-${contract.id}`
      })
      onOpenChange(false)
      navigate(CONTRACTS, { replace: true })
    },
    onError: (error) => {
      const message = errorMessage(error)
      toast.error('Der Vertrag konnte nicht gelöscht werden.', {
        description: message,
        id: `contract-delete-error-${contract.id}-${message.slice(0, 100)}`
      })
    }
  })

  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        if (!mutation.isPending) {
          onOpenChange(nextOpen)
        }
      }}
      open={open}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Vertrag löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Du löschst „{contract.name}“ endgültig. {bookingNotice(contract.transactions.total)}
            {fileNotice(contract.files.length)} Diese Aktion kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.isError ? (
          <p className="text-sm text-destructive">{errorMessage(mutation.error)}</p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Abbrechen</AlertDialogCancel>
          <Button
            disabled={mutation.isPending}
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
