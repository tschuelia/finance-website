export const HOME = '/'
export const LOGIN = '/anmelden'
export const CATEGORIES = '/kategorien'
export const CONTRACTS = '/vertraege'
export const CONTRACT_NEW = '/vertraege/neu'
export const ANALYTICS = '/auswertungen'
export const ASSIGNMENTS = '/zuordnungen'

const withSearch = (path: string, search?: string): string => {
  if (search === undefined || search === '') {
    return path
  }

  return `${path}${search.startsWith('?') ? search : `?${search}`}`
}

export const accountUrl = (accountId: number, search?: string): string =>
  withSearch(`/konten/${accountId}`, search)

export const accountTransactionImportUrl = (accountId: number): string =>
  `/konten/${accountId}/transaktionen/importieren`

export const depotUrl = (depotId: number): string => `/depots/${depotId}`

export const contractUrl = (contractId: number): string => `/vertraege/${contractId}`

export const contractAssignmentsUrl = (contractId: number): string =>
  `${ASSIGNMENTS}?issue=contract&contract_id=${contractId}`
