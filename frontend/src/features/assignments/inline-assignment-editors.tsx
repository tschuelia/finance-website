/* cspell:words Zuordnungsmuster */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import { createCategory } from '@/api/categories'
import { createContract } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { categoriesQueryKey } from '@/hooks/use-categories'
import { contractsQueryKey } from '@/hooks/use-contracts'
import type { Category } from '@/types/categories'
import type { UserSummary } from '@/types/common'
import type { ContractSummary } from '@/types/contracts'

type EditorProps = {
  onOpenChange: (open: boolean) => void
  open: boolean
}

type QuickCategoryDialogProps = EditorProps & {
  onCreated: (category: Category) => void
}

export const QuickCategoryDialog = ({
  onCreated,
  onOpenChange,
  open
}: QuickCategoryDialogProps) => {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [patterns, setPatterns] = useState('')
  const [error, setError] = useState<string | undefined>()
  const mutation = useMutation({
    mutationFn: async () => await createCategory({ name, patterns }),
    onSuccess: async (category) => {
      await queryClient.invalidateQueries({ queryKey: categoriesQueryKey })
      toast.success('Die Kategorie wurde angelegt.', { id: `category-created-${category.id}` })
      onCreated(category)
      onOpenChange(false)
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Die Kategorie konnte nicht angelegt werden.'
      )
  })

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kategorie anlegen</DialogTitle>
          <DialogDescription>
            Die neue Kategorie steht anschließend direkt für die ausgewählten Buchungen bereit.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            setError(undefined)
            mutation.mutate()
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="quick-category-name">Name</Label>
            <Input
              id="quick-category-name"
              maxLength={255}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quick-category-patterns">Zuordnungsmuster</Label>
            <Textarea
              className="field-sizing-fixed min-h-32 max-h-48 resize-y overflow-y-auto"
              id="quick-category-patterns"
              onChange={(event) => setPatterns(event.target.value)}
              placeholder={'z. B. Supermarkt\nBäckerei'}
              rows={6}
              value={patterns}
            />
            <p className="text-xs text-muted-foreground">Ein Begriff pro Zeile.</p>
          </div>
          {error === undefined ? null : <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter showCloseButton>
            <Button disabled={mutation.isPending} type="submit">
              Kategorie anlegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type QuickContractDialogProps = EditorProps & {
  onCreated: (contract: ContractSummary) => void
  owner: UserSummary
}

export const QuickContractDialog = ({
  onCreated,
  onOpenChange,
  open,
  owner
}: QuickContractDialogProps) => {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [patterns, setPatterns] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | undefined>()
  const mutation = useMutation({
    mutationFn: async () =>
      await createContract({
        owner_id: owner.id,
        name,
        description: description.trim() || null,
        patterns,
        is_active: true,
        start_date: null,
        end_date: null
      }),
    onSuccess: async (contract) => {
      await queryClient.invalidateQueries({ queryKey: contractsQueryKey })
      toast.success('Der Vertrag wurde angelegt.', { id: `contract-created-${contract.id}` })
      onCreated(contract)
      onOpenChange(false)
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Der Vertrag konnte nicht angelegt werden.'
      )
  })

  const ownerName = `${owner.first_name} ${owner.last_name}`.trim() || owner.username

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vertrag anlegen</DialogTitle>
          <DialogDescription>
            Der Vertrag wird für {ownerName} angelegt und kann sofort zugeordnet werden.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            setError(undefined)
            mutation.mutate()
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="quick-contract-name">Name</Label>
            <Input
              id="quick-contract-name"
              maxLength={255}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quick-contract-patterns">Zuordnungsmuster</Label>
            <Textarea
              className="field-sizing-fixed min-h-32 max-h-48 resize-y overflow-y-auto"
              id="quick-contract-patterns"
              onChange={(event) => setPatterns(event.target.value)}
              placeholder={'z. B. Stadtwerke\nKundennummer 1234'}
              rows={6}
              value={patterns}
            />
            <p className="text-xs text-muted-foreground">Ein Begriff pro Zeile.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quick-contract-description">Beschreibung</Label>
            <Textarea
              id="quick-contract-description"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </div>
          {error === undefined ? null : <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter showCloseButton>
            <Button disabled={mutation.isPending} type="submit">
              Vertrag anlegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
