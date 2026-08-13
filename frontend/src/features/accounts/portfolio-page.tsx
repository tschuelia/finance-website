/* cspell:words Depot Finanzübersicht Kontostand */

import { Landmark, PiggyBank, WalletCards } from 'lucide-react'
import { Link } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { PageHeader } from '@/components/shared/page-header'
import { usePortfolioOverview } from '@/hooks/use-accounts'
import { formatDate, formatDecimal } from '@/lib/format'
import { accountUrl, depotUrl } from '@/routes/urls'

export const PortfolioPage = () => {
  const portfolio = usePortfolioOverview()

  if (portfolio.status === 'loading') {
    return <LoadingState />
  }

  if (portfolio.status === 'error') {
    return <ErrorState error={portfolio.error} />
  }

  if (portfolio.data.groups.length === 0) {
    return (
      <>
        <PageHeader
          title="Finanzübersicht"
          description="Deine Konten und Depots auf einen Blick."
        />
        <EmptyState
          description="Dir sind noch keine Konten oder Depots zugeordnet."
          title="Noch keine Finanzdaten"
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Finanzübersicht" description="Deine Konten und Depots auf einen Blick." />
      <Card className="bg-primary text-primary-foreground ring-0">
        <CardHeader>
          <CardDescription className="text-primary-foreground/70">Gesamtvermögen</CardDescription>
          <CardTitle className="text-3xl">{formatDecimal(portfolio.data.total_balance)}</CardTitle>
        </CardHeader>
      </Card>
      <div className="grid gap-6">
        {portfolio.data.groups.map((group) => (
          <section className="grid gap-3" key={group.owner.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-heading text-lg font-semibold">
                {group.owner.first_name} {group.owner.last_name}
              </h2>
              <span className="text-sm text-muted-foreground">{formatDecimal(group.balance)}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.accounts.map((account) => (
                <Link className="group" key={account.id} to={accountUrl(account.id)}>
                  <Card className="h-full transition-colors group-hover:bg-muted/60">
                    <CardHeader>
                      <CardDescription className="flex items-center gap-2">
                        <WalletCards className="size-4" aria-hidden />
                        {account.bank}
                      </CardDescription>
                      <CardTitle>{account.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-1">
                      <span className="text-xl font-semibold">
                        {formatDecimal(account.balance)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Aktualisiert: {formatDate(account.newest_transaction_date)}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {group.depots.map((depot) => (
                <Link className="group" key={depot.id} to={depotUrl(depot.id)}>
                  <Card className="h-full transition-colors group-hover:bg-muted/60">
                    <CardHeader>
                      <CardDescription className="flex items-center gap-2">
                        <PiggyBank className="size-4" aria-hidden />
                        Depot
                      </CardDescription>
                      <CardTitle>{depot.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-1">
                      <span className="text-xl font-semibold">{formatDecimal(depot.balance)}</span>
                      <span className="text-xs text-muted-foreground">
                        Letzte Aktualisierung: {formatDate(depot.last_update)}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Landmark className="size-4" aria-hidden />
        Alle Beträge werden in Euro angezeigt.
      </p>
    </>
  )
}
