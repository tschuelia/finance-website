/* cspell:words Depot Depotbestand Depotwert Vermögenswert */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Dot, Pencil, Save, User } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { updateDepotAsset } from '@/api/accounts'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
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
  formatDate,
  formatDecimal,
  formatToday,
  parseDecimalInput,
  parsePositiveId
} from '@/lib/format'
import { HOME } from '@/routes/urls'
import type { DepotAsset, DepotBalancePoint } from '@/types/accounts'

type AssetEditorProps = {
  asset: DepotAsset
  depotId: number
  onOpenChange: (open: boolean) => void
  open: boolean
}

type BalanceHistoryChartProps = {
  className: string
  data: DepotBalancePoint[]
  label: string
}

const BalanceHistoryChart = ({ className, data, label }: BalanceHistoryChartProps) => {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Snapshots vorhanden.</p>
  }

  const config = {
    balance: {
      label,
      color: 'var(--chart-2)'
    }
  } satisfies ChartConfig

  return (
    <ChartContainer className={className} config={config}>
      <AreaChart accessibilityLayer data={data} margin={{ left: 4, right: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          minTickGap={24}
          tickFormatter={(value: string) => formatDate(value)}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          tickFormatter={(value: number) => formatDecimal(value, { currency: false })}
          tickLine={false}
          width={64}
        />
        <ChartTooltip
          isAnimationActive={false}
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <>
                  <span className="text-muted-foreground">{label}</span>
                  <span className="ml-auto font-mono font-medium text-foreground tabular-nums">
                    {formatDecimal(Number(value))}
                  </span>
                </>
              )}
              labelFormatter={(value) => formatDate(String(value))}
            />
          }
        />
        <Area
          dataKey="balance"
          dot={data.length === 1}
          fill="var(--color-balance)"
          fillOpacity={0.2}
          isAnimationActive={false}
          stroke="var(--color-balance)"
          type="monotone"
        />
      </AreaChart>
    </ChartContainer>
  )
}

const AssetEditor = ({ asset, depotId, onOpenChange, open }: AssetEditorProps) => {
  const queryClient = useQueryClient()
  const [balance, setBalance] = useState('')
  const [formError, setFormError] = useState<string | undefined>()
  const mutation = useMutation({
    mutationFn: async () => {
      const currentBalance = parseDecimalInput(balance)

      if (currentBalance === undefined) {
        throw new Error('Bitte gib einen gültigen Betrag ein.')
      }

      return await updateDepotAsset(depotId, asset.id, {
        current_balance: currentBalance
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
          <DialogTitle>{asset.name} aktualisieren</DialogTitle>
          <DialogDescription>
            Du aktualisierst hier den heutigen Bestand des Vermögenswerts.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor={`asset-balance-${asset.id}`}>Neuer Bestand</Label>
            <Input
              id={`asset-balance-${asset.id}`}
              inputMode="decimal"
              onChange={(event) => setBalance(event.target.value)}
              value={balance}
            />
          </div>
          <p className="text-sm text-muted-foreground">Stand: heute, {formatToday()}</p>
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

  const metadata = (
    <span className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1">
        <User aria-hidden size={14} />
        {depot.data.owner.username}
      </span>
      <Dot aria-hidden size={12} />
      <span className="flex items-center gap-1">
        <Calendar aria-hidden size={14} />
        {formatDate(depot.data.last_update)}
      </span>
    </span>
  )

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Übersicht', to: HOME }, { label: depot.data.name }]}
        description={metadata}
        title={depot.data.name}
      />
      <Card>
        <CardHeader>
          <CardDescription>Depotbestand</CardDescription>
          <CardTitle className="text-2xl">{formatDecimal(depot.data.balance)}</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceHistoryChart
            className="h-56 w-full"
            data={depot.data.balance_history}
            label="Depotwert"
          />
        </CardContent>
      </Card>
      {depot.data.assets.length === 0 ? (
        <EmptyState title="Keine Vermögenswerte" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {depot.data.assets.map((asset) => (
            <Card key={asset.id}>
              <CardHeader>
                <CardDescription>{formatDate(asset.last_update)}</CardDescription>
                <CardTitle>{asset.name}</CardTitle>
                <CardAction>
                  <Button onClick={() => setEditedAsset(asset)} size="sm" variant="outline">
                    <Pencil aria-hidden />
                    Bestand aktualisieren
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-3">
                <p className="text-xl font-semibold">{formatDecimal(asset.current_balance)}</p>
                <div className="grid gap-2 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Wertentwicklung</p>
                  <BalanceHistoryChart
                    className="h-40 w-full"
                    data={asset.balance_history}
                    label="Wert"
                  />
                </div>
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
