const percentageFormatter = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  maximumFractionDigits: 1
})

export const formatPercentage = (value: number): string => percentageFormatter.format(value)
