/* cspell:words Gegenbuchungen Umbuchungsvorschläge */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCheck, Link2, RotateCcw, Search, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import { updateTransferReviews } from '@/api/review'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DataPagination } from '@/components/shared/data-pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { transferReviewQueryKey, useTransferReview } from '@/hooks/use-assignment-review'
import { displayName, formatDate, formatDecimal } from '@/lib/format'
import type {
  TransferPair,
  TransferReviewFilters,
  TransferReviewStatus,
  TransferReviewUpdateRequest
} from '@/types/review'

const defaultFilters = (): TransferReviewFilters => ({
  status: 'suggested',
  page: 1,
  page_size: 50
})

const pairKey = (pair: TransferPair): string => `${pair.outgoing.id}:${pair.incoming.id}`

export const TransferReviewPanel = () => {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<TransferReviewFilters>(defaultFilters)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const review = useTransferReview(filters)
  const mutation = useMutation({
    mutationFn: updateTransferReviews,
    onSuccess: async (updated) => {
      setSelected(new Set())
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: transferReviewQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] })
      ])
      toast.success(
        updated === 1
          ? 'Eine Umbuchung wurde aktualisiert.'
          : `${updated} Umbuchungen wurden aktualisiert.`,
        { id: `transfer-review-${Date.now()}` }
      )
    },
    onError: (error) =>
      toast.error('Die Umbuchung konnte nicht aktualisiert werden.', {
        description: error instanceof Error ? error.message : 'Bitte versuche es erneut.',
        id: `transfer-review-error-${Date.now()}`
      })
  })

  const apply = (pairs: TransferPair[], action: 'confirm' | 'reject' | 'reset') => {
    if (pairs.length === 0) {
      return
    }
    const payload: TransferReviewUpdateRequest = {
      items: pairs.map((pair) => ({
        outgoing_transaction_id: pair.outgoing.id,
        incoming_transaction_id: pair.incoming.id,
        action
      }))
    }
    mutation.mutate(payload)
  }

  const setStatus = (status: TransferReviewStatus) => {
    setSelected(new Set())
    setFilters((current) => ({ ...current, status, page: 1 }))
  }

  if (review.status === 'loading') {
    return <LoadingState title="Umbuchungen werden gesucht" />
  }
  if (review.status === 'error') {
    return <ErrorState error={review.error} title="Umbuchungen konnten nicht geladen werden" />
  }

  const selectedPairs = review.data.items.filter((pair) => selected.has(pairKey(pair)))
  const selectablePairs = review.data.items.filter((pair) => pair.match_status === 'unique')

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Umbuchungen prüfen</CardTitle>
          <CardDescription>
            Gegenbuchungen mit identischem Betrag auf unterschiedlichen Konten und höchstens drei
            Tagen Abstand werden vorgeschlagen. Nur bestätigte Umbuchungen werden in der Auswertung
            berücksichtigt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-end"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              setFilters((current) => ({ ...current, q: search.trim() || undefined, page: 1 }))
            }}
          >
            <div className="flex flex-wrap gap-2">
              {(['suggested', 'confirmed', 'rejected'] as const).map((status) => (
                <Button
                  key={status}
                  onClick={() => setStatus(status)}
                  type="button"
                  variant={filters.status === status ? 'default' : 'outline'}
                >
                  {status === 'suggested'
                    ? 'Vorschläge'
                    : status === 'confirmed'
                      ? 'Bestätigt'
                      : 'Abgelehnt'}
                </Button>
              ))}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transfer-search">Suche</Label>
              <Input
                id="transfer-search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Empfänger oder Betreff"
                value={search}
              />
            </div>
            <Button type="submit">
              <Search aria-hidden /> Suchen
            </Button>
          </form>
        </CardContent>
      </Card>
      {review.data.items.length === 0 ? (
        <EmptyState
          description={
            filters.status === 'suggested'
              ? 'Für diese Auswahl gibt es keine ungeprüften Gegenbuchungen.'
              : 'In diesem Status sind keine Umbuchungen vorhanden.'
          }
          title={filters.status === 'suggested' ? 'Alles geprüft' : 'Keine Umbuchungen'}
        />
      ) : (
        <>
          {filters.status === 'suggested' ? (
            <Card size="sm">
              <CardContent className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() =>
                    setSelected(
                      selected.size === selectablePairs.length
                        ? new Set()
                        : new Set(selectablePairs.map(pairKey))
                    )
                  }
                  variant="outline"
                >
                  <CheckCheck aria-hidden />
                  {selected.size === selectablePairs.length
                    ? 'Auswahl aufheben'
                    : 'Eindeutige auswählen'}
                </Button>
                <Button
                  disabled={selectedPairs.length === 0 || mutation.isPending}
                  onClick={() => apply(selectedPairs, 'confirm')}
                >
                  <Link2 aria-hidden /> {selectedPairs.length} bestätigen
                </Button>
              </CardContent>
            </Card>
          ) : null}
          <div className="grid gap-3">
            {review.data.items.map((pair) => {
              const key = pairKey(pair)
              const isSuggested = filters.status === 'suggested'
              return (
                <Card key={key} size="sm">
                  <CardContent className="grid gap-4 lg:grid-cols-[auto_1fr_auto_1fr_auto] lg:items-center">
                    {isSuggested ? (
                      <input
                        aria-label="Umbuchung auswählen"
                        checked={selected.has(key)}
                        className="size-4 accent-primary"
                        disabled={pair.match_status === 'ambiguous'}
                        onChange={(event) =>
                          setSelected((current) => {
                            const next = new Set(current)
                            if (event.target.checked) {
                              next.add(key)
                            } else {
                              next.delete(key)
                            }
                            return next
                          })
                        }
                        type="checkbox"
                      />
                    ) : null}
                    <TransactionSide
                      amount={pair.outgoing.amount}
                      date={pair.outgoing.date_issue}
                      label={pair.outgoing.recipient || pair.outgoing.subject}
                      meta={`${pair.outgoing.bank_account_name ?? 'Konto'} · ${displayName(pair.outgoing_owner)}`}
                    />
                    <div className="grid justify-items-center gap-1 text-muted-foreground">
                      <Link2 className="size-5" aria-hidden />
                      <span className="text-xs">
                        {pair.day_gap === 0 ? 'gleicher Tag' : `${pair.day_gap} Tage`}
                      </span>
                      <Badge
                        variant={pair.match_status === 'ambiguous' ? 'destructive' : 'secondary'}
                      >
                        {pair.match_status === 'ambiguous' ? 'Mehrdeutig' : 'Eindeutig'}
                      </Badge>
                    </div>
                    <TransactionSide
                      amount={pair.incoming.amount}
                      date={pair.incoming.date_issue}
                      label={pair.incoming.recipient || pair.incoming.subject}
                      meta={`${pair.incoming.bank_account_name ?? 'Konto'} · ${displayName(pair.incoming_owner)}`}
                    />
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {isSuggested ? (
                        <>
                          <Button
                            disabled={mutation.isPending}
                            onClick={() => apply([pair], 'confirm')}
                            size="sm"
                          >
                            <CheckCheck aria-hidden /> Bestätigen
                          </Button>
                          <Button
                            disabled={mutation.isPending}
                            onClick={() => apply([pair], 'reject')}
                            size="sm"
                            variant="outline"
                          >
                            <X aria-hidden /> Ablehnen
                          </Button>
                        </>
                      ) : (
                        <Button
                          disabled={mutation.isPending}
                          onClick={() => apply([pair], 'reset')}
                          size="sm"
                          variant="outline"
                        >
                          <RotateCcw aria-hidden /> Zurücksetzen
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <DataPagination
            itemLabel="Umbuchungen"
            onPageChange={(page) => {
              setSelected(new Set())
              setFilters((current) => ({ ...current, page }))
            }}
            page={review.data.page}
            totalItems={review.data.total}
            totalPages={review.data.total_pages}
          />
        </>
      )}
    </div>
  )
}

const TransactionSide = ({
  amount,
  date,
  label,
  meta
}: {
  amount: number
  date: string
  label: string
  meta: string
}) => (
  <div className="min-w-0">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <p className="truncate font-medium">{label}</p>
      <span
        className={
          amount < 0
            ? 'font-mono font-medium text-destructive tabular-nums'
            : 'font-mono font-medium text-emerald-700 tabular-nums dark:text-emerald-400'
        }
      >
        {formatDecimal(amount)}
      </span>
    </div>
    <p className="truncate text-xs text-muted-foreground">
      {formatDate(date)} · {meta}
    </p>
  </div>
)
