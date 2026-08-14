/* cspell:words Buchungsdatum Kategorien Kontotransaktionen Wertstellungsdatum */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

type TransactionSummaryCardsProps = {
  summary: TransactionSummary
}

type TransactionTableProps = {
  items: Transaction[]
  onSelect: (transaction: Transaction) => void
}

type TransactionPaginationProps = {
  onPageChange: (page: number) => void
  page: TransactionPage
}

export const TransactionSummaryCards = ({ summary }: TransactionSummaryCardsProps) => {
  const period =
    summary.minimum_date === null && summary.maximum_date === null
      ? 'Keine Buchungen im gewählten Zeitraum'
      : `${formatDate(summary.minimum_date)} bis ${formatDate(summary.maximum_date)}`

  return (
    <section
      aria-label="Zusammenfassung der gefilterten Transaktionen"
      className="grid gap-3 sm:grid-cols-3"
    >
      <Card>
        <CardHeader>
          <CardDescription>Saldo</CardDescription>
          <CardTitle className="text-xl">{formatDecimal(summary.total)}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Ausgaben</CardDescription>
          <CardTitle className="text-xl text-destructive">{formatDecimal(summary.paid)}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Einnahmen</CardDescription>
          <CardTitle className="text-xl text-emerald-700 dark:text-emerald-400">
            {formatDecimal(summary.received)}
          </CardTitle>
        </CardHeader>
      </Card>
      <p className="sm:col-span-3 text-sm text-muted-foreground">Zeitraum: {period}</p>
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
    <Card>
      <CardHeader>
        <CardTitle>Transaktionen</CardTitle>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
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
                <TableCell className="max-w-48 truncate font-medium">
                  {transaction.recipient}
                </TableCell>
                <TableCell
                  className={`text-right font-medium ${
                    transaction.amount < 0
                      ? 'text-destructive'
                      : 'text-emerald-700 dark:text-emerald-400'
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
      </CardContent>
    </Card>
  )
}

export const TransactionPagination = ({ onPageChange, page }: TransactionPaginationProps) => {
  if (page.total_pages <= 1) {
    return null
  }

  return (
    <nav
      aria-label="Seitennavigation für Transaktionen"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <Button
        disabled={page.page <= 1}
        onClick={() => onPageChange(page.page - 1)}
        variant="outline"
      >
        <ChevronLeft aria-hidden />
        Zurück
      </Button>
      <p className="text-sm text-muted-foreground">
        Seite {page.page} von {page.total_pages} · {page.total} Transaktionen
      </p>
      <Button
        disabled={page.page >= page.total_pages}
        onClick={() => onPageChange(page.page + 1)}
        variant="outline"
      >
        Weiter
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  )
}
