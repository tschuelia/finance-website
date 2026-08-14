import { formatDate } from '@/lib/format'
import type { ContractSummary } from '@/types/contracts'

export const formatContractPeriod = ({
  start_date,
  end_date
}: Pick<ContractSummary, 'start_date' | 'end_date'>): string =>
  end_date
    ? `${formatDate(start_date)} – ${formatDate(end_date)}`
    : `Seit ${formatDate(start_date)}`
