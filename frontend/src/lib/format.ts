/* cspell:words Dezimalwert Betrag */

const decimalFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true
})

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Berlin'
})

export const formatDate = (date: string | null | undefined): string => {
  if (date === null || date === undefined || date === '') {
    return '–'
  }

  return dateFormatter.format(new Date(`${date.slice(0, 10)}T12:00:00`))
}

export const formatDecimal = (value: number, options?: { currency?: boolean }): string =>
  ((options?.currency ?? true) ? currencyFormatter : decimalFormatter).format(value)

export const decimalInputValue = (value: number): string => value.toFixed(2).replace('.', ',')

export const parseDecimalInput = (value: string): number | undefined => {
  const compact = value.trim().replace(/\s/g, '')
  const normalized = compact.includes(',') ? compact.replace(/\./g, '').replace(',', '.') : compact

  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return undefined
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const parsePositiveId = (value: string | undefined): number | undefined => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : undefined
}

export const displayName = (user: {
  first_name: string
  last_name: string
  username: string
}): string => {
  const name = `${user.first_name} ${user.last_name}`.trim()
  return name === '' ? user.username : name
}
