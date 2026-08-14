/* cspell:words Depot Finanzübersicht Kontostand */

import { Building, Calendar, Dot, PiggyBank, User, WalletCards } from 'lucide-react'
import { Link } from 'react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { PageHeader } from '@/components/shared/page-header'
import { usePortfolioOverview } from '@/hooks/use-accounts'
import { formatDate, formatDecimal } from '@/lib/format'
import { accountUrl, depotUrl } from '@/routes/urls'

const PortfolioCard = ({
  type,
  name,
  balance,
  owner,
  date,
  bank
}: {
  name: string
  balance: number
  owner: string
  date: string
  bank?: string
  type: 'account' | 'depot'
}) => {
  const TitleIcon = type === 'account' ? WalletCards : PiggyBank

  return (
    <Card className="h-full transition-colors group-hover:bg-muted/60">
      <CardHeader className="items-center flex gap-2">
        <TitleIcon size={16} />
        <CardTitle>{name}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1">
        <span className="text-xl font-semibold">{formatDecimal(balance)}</span>
      </CardContent>
      <CardFooter className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex gap-1 items-top">
          <User size={14} />
          {owner}
        </span>
        <Dot size={12} />
        <span className="flex gap-1 items-center">
          <Calendar size={14} />
          {formatDate(date)}
        </span>
        {bank && (
          <>
            <Dot size={12} />
            <span className="flex gap-1 items-center">
              <Building size={14} />
              {bank}
            </span>
          </>
        )}
        <Dot size={12} />
        <span className="flex gap-1 items-center">
          <TitleIcon size={12} />
          {type == 'account' ? 'Bankkonto' : 'Depot'}
        </span>
      </CardFooter>
    </Card>
  )
}

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
      <Card className="bg-secondary text-primary ring-primary/50">
        <CardHeader>
          <CardDescription className="text-primary">Gesamtvermögen</CardDescription>
          <CardTitle className="text-3xl">{formatDecimal(portfolio.data.total_balance)}</CardTitle>
        </CardHeader>
      </Card>
      <div className="grid gap-6">
        {portfolio.data.groups.map((group) => {
          return (
            <section className="grid gap-3" key={group.owner.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-heading text-lg font-semibold">{group.owner.username}</h2>
                <span className="text-sm text-muted-foreground">
                  {formatDecimal(group.balance)}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.accounts.map((account) => (
                  <Link className="group" key={account.id} to={accountUrl(account.id)}>
                    <PortfolioCard
                      name={account.name}
                      balance={account.balance}
                      owner={group.owner.username}
                      date={account.newest_transaction_date}
                      bank={account.bank}
                      type="account"
                    />
                  </Link>
                ))}
                {group.depots.map((depot) => (
                  <Link className="group" key={depot.id} to={depotUrl(depot.id)}>
                    <PortfolioCard
                      name={depot.name}
                      balance={depot.balance}
                      owner={group.owner.username}
                      date={depot.last_update}
                      type="depot"
                    />
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
