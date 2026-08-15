/* cspell:words Vertragsinhaber */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { ContractEditorForm } from '@/features/contracts/contract-form'
import { useUsers } from '@/hooks/use-users'
import type { ContractSummary } from '@/types/contracts'

type ContractEditorDialogProps = {
  contract: ContractSummary
  onOpenChange: (open: boolean) => void
  open: boolean
}

export const ContractEditorDialog = ({
  contract,
  onOpenChange,
  open
}: ContractEditorDialogProps) => {
  const users = useUsers()

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vertrag bearbeiten</DialogTitle>
          <DialogDescription>Passe die Angaben zu „{contract.name}“ an.</DialogDescription>
        </DialogHeader>
        {users.status === 'loading' ? (
          <LoadingState title="Vertragsinhaber werden geladen" />
        ) : users.status === 'error' ? (
          <ErrorState error={users.error} title="Formular konnte nicht vorbereitet werden" />
        ) : (
          <ContractEditorForm
            contract={contract}
            idPrefix={`contract-edit-${contract.id}`}
            onSaved={() => onOpenChange(false)}
            presentation="dialog"
            users={users.data}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
