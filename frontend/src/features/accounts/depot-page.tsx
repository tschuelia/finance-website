/* cspell:words Depot Depotbestand Vermögenswert */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Save } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { updateDepotAsset } from '@/api/accounts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { useDepot } from '@/hooks/use-accounts'
import {
  decimalInputValue,
  formatDate,
  formatDecimal,
  parseDecimalInput,
  parsePositiveId
} from '@/lib/format'
import { HOME } from '@/routes/urls'
import type { DepotAsset } from '@/types/accounts'

type AssetEditorProps = {
  asset: DepotAsset
  depotId: number
  onOpenChange: (open: boolean) => void
  open: boolean
}

const AssetEditor = ({ asset, depotId, onOpenChange, open }: AssetEditorProps) => {
  const queryClient = useQueryClient()
  const [balance, setBalance] = useState(decimalInputValue(asset.current_balance))
  const [lastUpdate, setLastUpdate] = useState(asset.last_update)
  const [formError, setFormError] = useState<string | undefined>()
  const mutation = useMutation({
    mutationFn: async () => {
      const currentBalance = parseDecimalInput(balance)

      if (currentBalance === undefined || lastUpdate === '') {
        throw new Error('Bitte gib einen gültigen Betrag und ein Datum ein.')
      }

      return await updateDepotAsset(depotId, asset.id, {
        current_balance: currentBalance,
        last_update: lastUpdate
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['depot', depotId] })
      await queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      toast.success('Der Vermögenswert wurde aktualisiert.', {
        id: `asset-updated-${depotId}-${asset.id}`
      })
      onOpenChange(false)
    },
    onError: (error) =>
      setFormError(error instanceof Error ? error.message : 'Die Änderung ist fehlgeschlagen.')
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(undefined)
    mutation.mutate()
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{asset.name} bearbeiten</DialogTitle>
          <DialogDescription>
            Du aktualisierst hier den heutigen Bestand des Vermögenswerts.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor={`asset-balance-${asset.id}`}>Aktueller Bestand</Label>
            <Input
              id={`asset-balance-${asset.id}`}
              inputMode="decimal"
              onChange={(event) => setBalance(event.target.value)}
              value={balance}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`asset-date-${asset.id}`}>Stand vom</Label>
            <Input
              id={`asset-date-${asset.id}`}
              onChange={(event) => setLastUpdate(event.target.value)}
              type="date"
              value={lastUpdate}
            />
          </div>
          {formError === undefined ? null : <p className="text-sm text-destructive">{formError}</p>}
          <DialogFooter showCloseButton>
            <Button disabled={mutation.isPending} type="submit">
              <Save aria-hidden />
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export const DepotPage = () => {
  const { depotId: depotIdParam } = useParams()
  const depotId = parsePositiveId(depotIdParam)
  const depot = useDepot(depotId ?? Number.NaN)
  const [editedAsset, setEditedAsset] = useState<DepotAsset | undefined>()

  if (depotId === undefined) {
    return <EmptyState description="Die Depot-Adresse ist ungültig." title="Depot nicht gefunden" />
  }

  if (depot.status === 'loading') {
    return <LoadingState title="Depot wird geladen" />
  }

  if (depot.status === 'error') {
    return <ErrorState error={depot.error} />
  }

  return (
    <>
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link to={HOME}>
              <ArrowLeft aria-hidden />
              Zur Übersicht
            </Link>
          </Button>
        }
        description={`Besitz von ${depot.data.owner.first_name} ${depot.data.owner.last_name}`}
        title={depot.data.name}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Depotbestand</CardDescription>
            <CardTitle className="text-2xl">{formatDecimal(depot.data.balance)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Letzte Aktualisierung</CardDescription>
            <CardTitle className="text-2xl">{formatDate(depot.data.last_update)}</CardTitle>
          </CardHeader>
        </Card>
      </div>
      {depot.data.assets.length === 0 ? (
        <EmptyState title="Keine Vermögenswerte" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {depot.data.assets.map((asset) => (
            <Card key={asset.id}>
              <CardHeader>
                <CardDescription>{formatDate(asset.last_update)}</CardDescription>
                <CardTitle>{asset.name}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div>
                  <p className="text-xl font-semibold">{formatDecimal(asset.current_balance)}</p>
                  <p className="text-sm text-muted-foreground">
                    Buchungen: {formatDecimal(asset.transaction_total)}
                  </p>
                </div>
                <div className="grid gap-1 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Letzte Bewegungen</p>
                  {asset.transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Noch keine Bewegungen hinterlegt.
                    </p>
                  ) : (
                    <ul className="grid gap-1 text-sm">
                      {asset.transactions.map((transaction) => (
                        <li
                          className="flex items-center justify-between gap-2"
                          key={transaction.id}
                        >
                          <span>{formatDate(transaction.date_issue)}</span>
                          <span className="font-medium">{formatDecimal(transaction.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Button onClick={() => setEditedAsset(asset)} size="sm" variant="outline">
                  <Pencil aria-hidden />
                  Bestand bearbeiten
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {editedAsset === undefined ? null : (
        <AssetEditor
          asset={editedAsset}
          depotId={depotId}
          onOpenChange={(open) => {
            if (!open) {
              setEditedAsset(undefined)
            }
          }}
          open
        />
      )}
    </>
  )
}
