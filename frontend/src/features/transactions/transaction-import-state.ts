import type { TransactionDraft } from '@/features/transactions/transaction-draft'
import type { CsvPreviewRow } from '@/types/imports'

export type ImportStage = 'upload' | 'preview'
export type ImportFilter = 'all' | 'attention' | 'category' | 'contract'

export type ImportRow = {
  draft: TransactionDraft
  preview: CsvPreviewRow
}

type SkippedRow = {
  source_row: number
  reason: string
}

export type TransactionImportState = {
  bulkCategory?: string
  bulkContract?: string
  categoryDialogOpen: boolean
  contractDialogOpen: boolean
  editingKey?: string
  fileInputKey: number
  fileName?: string
  filter: ImportFilter
  formError?: string
  rows: ImportRow[]
  selectedKeys: Set<string>
  skippedRows: SkippedRow[]
  stage: ImportStage
}

export type TransactionImportAction =
  | { patch: Partial<TransactionImportState>; type: 'patch' }
  | { type: 'update-rows'; update: (rows: ImportRow[]) => ImportRow[] }
  | { type: 'update-selection'; update: (keys: Set<string>) => Set<string> }

export const initialTransactionImportState = (): TransactionImportState => ({
  categoryDialogOpen: false,
  contractDialogOpen: false,
  fileInputKey: 0,
  filter: 'all',
  rows: [],
  selectedKeys: new Set(),
  skippedRows: [],
  stage: 'upload'
})

export const transactionImportReducer = (
  state: TransactionImportState,
  action: TransactionImportAction
): TransactionImportState => {
  if (action.type === 'patch') {
    return { ...state, ...action.patch }
  }
  if (action.type === 'update-rows') {
    return { ...state, rows: action.update(state.rows) }
  }
  return { ...state, selectedKeys: action.update(state.selectedKeys) }
}
