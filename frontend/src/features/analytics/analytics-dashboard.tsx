import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { CashFlowDashboardView } from '@/features/analytics/cash-flow-dashboard'
import { WealthDashboardView } from '@/features/analytics/wealth-dashboard'
import { useCashFlowDashboard, useWealthDashboard } from '@/hooks/use-analytics'
import type { CashFlowQuery, WealthQuery } from '@/types/analytics'

type AnalyticsTab = 'cashflow' | 'wealth'

type AnalyticsDashboardProps = {
  activeTab: AnalyticsTab
  cashFlowQuery: CashFlowQuery
  onTabChange: (tab: AnalyticsTab) => void
  wealthQuery: WealthQuery
}

export const AnalyticsDashboard = ({
  activeTab,
  cashFlowQuery,
  onTabChange,
  wealthQuery
}: AnalyticsDashboardProps) => {
  const cashFlow = useCashFlowDashboard(cashFlowQuery)
  const wealth = useWealthDashboard(wealthQuery, activeTab === 'wealth')

  return (
    <Tabs onValueChange={(value) => onTabChange(value as AnalyticsTab)} value={activeTab}>
      <TabsList className="grid w-full grid-cols-2 sm:w-80">
        <TabsTrigger value="cashflow">Cashflow</TabsTrigger>
        <TabsTrigger value="wealth">Vermögen</TabsTrigger>
      </TabsList>
      <TabsContent value="cashflow">
        {cashFlow.status === 'loading' ? <LoadingState title="Cashflow wird ausgewertet" /> : null}
        {cashFlow.status === 'error' ? <ErrorState error={cashFlow.error} /> : null}
        {cashFlow.status === 'success' ? <CashFlowDashboardView data={cashFlow.data} /> : null}
      </TabsContent>
      <TabsContent value="wealth">
        {wealth.status === 'loading' ? <LoadingState title="Vermögen wird ausgewertet" /> : null}
        {wealth.status === 'error' ? <ErrorState error={wealth.error} /> : null}
        {wealth.status === 'success' ? <WealthDashboardView data={wealth.data} /> : null}
      </TabsContent>
    </Tabs>
  )
}
