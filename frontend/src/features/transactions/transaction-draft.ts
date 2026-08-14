/* cspell:words Buchungsreferenz Empfänger Wertstellungsdatum */

import { decimalInputValue, parseDecimalInput } from '@/lib/format'
import type { Transaction, TransactionWrite } from '@/types/transactions'

export type TransactionDraft = {
  recipient: string
  amount: string
  subject: string
  dateIssue: string
  dateBooking: string
  fullSubjectString: string
  categoryId: string
  contractId: string
}

type TransactionDraftResult =
  | { status: 'valid'; value: TransactionWrite }
  | { status: 'invalid'; message: string }

const optionalId = (value: string): number | null | undefined => {
  if (value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

export const transactionDraftFromTransaction = (transaction: Transaction): TransactionDraft => ({
  recipient: transaction.recipient,
  amount: decimalInputValue(transaction.amount),
  subject: transaction.subject,
  dateIssue: transaction.date_issue,
  dateBooking: transaction.date_booking ?? '',
  fullSubjectString: transaction.full_subject_string,
  categoryId: transaction.category_id === null ? '' : String(transaction.category_id),
  contractId: transaction.contract_id === null ? '' : String(transaction.contract_id)
})

export const transactionDraftFromWrite = (transaction: TransactionWrite): TransactionDraft => ({
  recipient: transaction.recipient ?? '',
  amount: decimalInputValue(transaction.amount),
  subject: transaction.subject,
  dateIssue: transaction.date_issue,
  dateBooking: transaction.date_booking ?? '',
  fullSubjectString: transaction.full_subject_string ?? '',
  categoryId:
    transaction.category_id === null || transaction.category_id === undefined
      ? ''
      : String(transaction.category_id),
  contractId:
    transaction.contract_id === null || transaction.contract_id === undefined
      ? ''
      : String(transaction.contract_id)
})

export const transactionWriteFromDraft = (
  accountId: number,
  draft: TransactionDraft
): TransactionDraftResult => {
  const amount = parseDecimalInput(draft.amount)

  if (amount === undefined) {
    return {
      status: 'invalid',
      message: 'Bitte gib einen gültigen Betrag mit höchstens zwei Nachkommastellen ein.'
    }
  }

  if (draft.subject.trim() === '') {
    return { status: 'invalid', message: 'Bitte gib einen Betreff ein.' }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.dateIssue)) {
    return { status: 'invalid', message: 'Bitte gib ein gültiges Buchungsdatum ein.' }
  }

  if (draft.dateBooking !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(draft.dateBooking)) {
    return { status: 'invalid', message: 'Bitte gib ein gültiges Wertstellungsdatum ein.' }
  }

  const categoryId = optionalId(draft.categoryId)
  const contractId = optionalId(draft.contractId)

  if (categoryId === undefined || contractId === undefined) {
    return {
      status: 'invalid',
      message: 'Die ausgewählte Kategorie oder der Vertrag ist ungültig.'
    }
  }

  return {
    status: 'valid',
    value: {
      bank_account_id: accountId,
      recipient: draft.recipient.trim() || null,
      amount,
      subject: draft.subject.trim(),
      date_issue: draft.dateIssue,
      date_booking: draft.dateBooking || null,
      full_subject_string: draft.fullSubjectString.trim() || null,
      category_id: categoryId,
      contract_id: contractId
    }
  }
}
