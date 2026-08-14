/* cspell:words Vertragslaufzeit Vertragsinhaber */

import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { PageHeader } from '@/components/shared/page-header'
import { formatContractPeriod } from '@/features/contracts/contract-format'
import { useContracts } from '@/hooks/use-contracts'
import { CONTRACT_NEW, contractUrl } from '@/routes/urls'
import type { ContractSummary } from '@/types/contracts'

const ContractCard = ({ contract }: { contract: ContractSummary }) => {
  const owner =
    `${contract.owner.first_name} ${contract.owner.last_name}`.trim() || contract.owner.username

  return (
    <Link className="group" to={contractUrl(contract.id)}>
      <Card className="h-full transition-colors group-hover:bg-muted/60">
        <CardHeader>
          <CardDescription className="flex items-center justify-between gap-2">
            <span>{owner}</span>
            <Badge variant={contract.is_active ? 'default' : 'secondary'}>
              {contract.is_active ? 'Aktiv' : 'Inaktiv'}
            </Badge>
          </CardDescription>
          <CardTitle>{contract.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
            {contract.description === null || contract.description === ''
              ? 'Keine Beschreibung hinterlegt.'
              : contract.description}
          </p>
          <p className="text-xs text-muted-foreground">{formatContractPeriod(contract)}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

const ContractGrid = ({
  contracts,
  emptyText
}: {
  contracts: ContractSummary[]
  emptyText: string
}) => {
  if (contracts.length === 0) {
    return <EmptyState description={emptyText} />
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {contracts.map((contract) => (
        <ContractCard contract={contract} key={contract.id} />
      ))}
    </div>
  )
}

export const ContractsPage = () => {
  const contracts = useContracts()

  if (contracts.status === 'loading') {
    return <LoadingState title="Verträge werden geladen" />
  }

  if (contracts.status === 'error') {
    return <ErrorState error={contracts.error} />
  }

  return (
    <>
      <PageHeader
        actions={
          <Button asChild>
            <Link to={CONTRACT_NEW}>
              <Plus aria-hidden />
              Vertrag anlegen
            </Link>
          </Button>
        }
        description="Behalte Vertragslaufzeiten, Buchungen und Unterlagen zusammen im Blick."
        title="Verträge"
      />
      <Tabs className="gap-5" defaultValue="active">
        <TabsList aria-label="Vertragsstatus">
          <TabsTrigger value="active">Aktiv ({contracts.data.active.length})</TabsTrigger>
          <TabsTrigger value="inactive">Inaktiv ({contracts.data.inactive.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <ContractGrid
            contracts={contracts.data.active}
            emptyText="Es gibt derzeit keine aktiven Verträge."
          />
        </TabsContent>
        <TabsContent value="inactive">
          <ContractGrid
            contracts={contracts.data.inactive}
            emptyText="Es gibt derzeit keine inaktiven Verträge."
          />
        </TabsContent>
      </Tabs>
    </>
  )
}
