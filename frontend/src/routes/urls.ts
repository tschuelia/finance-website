export const HOME = '/'
export const LOGIN = '/anmelden'
export const CATEGORIES = '/kategorien'
export const CONTRACTS = '/vertraege'
export const CONTRACT_NEW = '/vertraege/neu'
export const ANALYTICS = '/auswertungen'

const withSearch = (path: string, search?: string): string => {
  if (search === undefined || search === '') {
    return path
  }

  return `${path}${search.startsWith('?') ? search : `?${search}`}`
}

export const accountUrl = (accountId: number, search?: string): string =>
  withSearch(`/konten/${accountId}`, search)

export const accountTransactionNewUrl = (accountId: number): string =>
  `/konten/${accountId}/transaktionen/neu`

export const accountTransactionBulkUrl = (accountId: number): string =>
  `/konten/${accountId}/transaktionen/sammelerfassung`

export const accountTransactionImportUrl = (accountId: number): string =>
  `/konten/${accountId}/transaktionen/importieren`

export const transactionUrl = (accountId: number, transactionId: number, search?: string): string =>
  withSearch(`/konten/${accountId}/transaktionen/${transactionId}`, search)

export const transactionEditUrl = (
  accountId: number,
  transactionId: number,
  search?: string
): string => withSearch(`/konten/${accountId}/transaktionen/${transactionId}/bearbeiten`, search)

export const depotUrl = (depotId: number): string => `/depots/${depotId}`

export const contractUrl = (contractId: number): string => `/vertraege/${contractId}`

export const contractEditUrl = (contractId: number): string => `/vertraege/${contractId}/bearbeiten`
