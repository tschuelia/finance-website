/* cspell:words Buchungsdatum Kategorien Kontotransaktionen Wertstellungsdatum */

import { BanknoteArrowDown, BanknoteArrowUp, Dot, Euro } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter } from '@/components/ui/card'
import { DataPagination } from '@/components/shared/data-pagination'
import { EmptyState } from '@/components/shared/query-feedback'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatDate, formatDecimal } from '@/lib/format'
import { contractUrl } from '@/routes/urls'
import type { Transaction, TransactionPage, TransactionSummary } from '@/types/transactions'

type TransactionSummaryCardProps = {
  summary: TransactionSummary
  total: number
}

type TransactionTableProps = {
  items: Transaction[]
  onSelect: (transaction: Transaction) => void
}

type TransactionPaginationProps = {
  onPageChange: (page: number) => void
  page: TransactionPage
}

export const TransactionSummaryCard = ({ summary, total }: TransactionSummaryCardProps) => {
  const period =
    summary.minimum_date === null && summary.maximum_date === null
      ? 'Keine Buchungen im gewählten Zeitraum'
      : `${formatDate(summary.minimum_date)} bis ${formatDate(summary.maximum_date)}`

  return (
    <section aria-label="Zusammenfassung der gefilterten Transaktionen">
      <Card className="bg-secondary/50 ring-primary/20">
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Euro aria-hidden size={20} />
            </div>
            <div className="grid gap-0.5">
              <CardDescription className="font-medium text-secondary-foreground">
                Gesamt
              </CardDescription>
              <span className="text-3xl font-semibold tracking-tight text-primary tabular-nums">
                {formatDecimal(summary.total)}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 border-t pt-4 sm:min-w-72 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
            <div className="grid gap-1">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BanknoteArrowUp aria-hidden size={14} />
                Einnahmen
              </span>
              <span className="text-sm font-medium text-emerald-700 tabular-nums dark:text-emerald-400">
                {formatDecimal(summary.received)}
              </span>
            </div>
            <div className="grid gap-1">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BanknoteArrowDown aria-hidden size={14} />
                Ausgaben
              </span>
              <span className="text-sm font-medium text-destructive tabular-nums">
                {formatDecimal(summary.paid)}
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <span>Zeitraum: {period}</span>
          <Dot aria-hidden className="shrink-0" size={16} />
          <span>{total === 1 ? '1 passende Transaktion' : `${total} passende Transaktionen`}</span>
        </CardFooter>
      </Card>
    </section>
  )
}

export const TransactionTable = ({ items, onSelect }: TransactionTableProps) => {
  if (items.length === 0) {
    return (
      <EmptyState
        description="Passe Deine Filter an oder importiere Transaktionen aus einer CSV-Datei."
        title="Keine Transaktionen gefunden"
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Buchungsdatum</TableHead>
          <TableHead>Wertstellung</TableHead>
          <TableHead>Zahlung an/von</TableHead>
          <TableHead className="text-right">Betrag</TableHead>
          <TableHead>Betreff</TableHead>
          <TableHead>Kategorie</TableHead>
          <TableHead>Vertrag</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((transaction) => (
          <TableRow
            aria-haspopup="dialog"
            aria-label={`Transaktion für ${transaction.recipient || transaction.subject} öffnen`}
            className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            key={transaction.id}
            onClick={() => onSelect(transaction)}
            onKeyDown={(event) => {
              if (
                event.target === event.currentTarget &&
                (event.key === 'Enter' || event.key === ' ')
              ) {
                event.preventDefault()
                onSelect(transaction)
              }
            }}
            tabIndex={0}
          >
            <TableCell>{formatDate(transaction.date_issue)}</TableCell>
            <TableCell>{formatDate(transaction.date_booking)}</TableCell>
            <TableCell className="max-w-48 truncate font-medium">{transaction.recipient}</TableCell>
            <TableCell
              className={`text-right font-medium ${
                transaction.amount < 0 ? 'text-destructive' : 'text-emerald-700'
              }`}
            >
              {formatDecimal(transaction.amount)}
            </TableCell>
            <TableCell className="max-w-64 truncate">{transaction.subject}</TableCell>
            <TableCell>
              {transaction.category_name === null ? (
                <span className="text-muted-foreground">Nicht zugeordnet</span>
              ) : (
                <Badge variant="outline">{transaction.category_name}</Badge>
              )}
            </TableCell>
            <TableCell>
              {transaction.contract_id === null || transaction.contract_name === null ? (
                <span className="text-muted-foreground">Kein Vertrag</span>
              ) : (
                <Link
                  className="text-primary hover:underline"
                  onClick={(event) => event.stopPropagation()}
                  to={contractUrl(transaction.contract_id)}
                >
                  {transaction.contract_name}
                </Link>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export const TransactionPagination = ({ onPageChange, page }: TransactionPaginationProps) => {
  if (page.total_pages <= 1) {
    return null
  }

  return (
    <DataPagination
      itemLabel="Transaktionen"
      onPageChange={onPageChange}
      page={page.page}
      totalItems={page.total}
      totalPages={page.total_pages}
    />
  )
}
