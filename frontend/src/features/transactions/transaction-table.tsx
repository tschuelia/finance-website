/* cspell:words Buchungsdatum Kategorien Kontostand Kontotransaktionen Wertstellungsdatum */

import {
  ArrowLeftRight,
  BanknoteArrowDown,
  BanknoteArrowUp,
  CalendarRange,
  Euro
} from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription } from '@/components/ui/card'
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

type AccountBalanceCardProps = {
  balance: number
}

type TransactionSummaryInfoProps = {
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

export const AccountBalanceCard = ({ balance }: AccountBalanceCardProps) => (
  <section aria-label="Kontostand">
    <Card className="bg-secondary/50 ring-primary/20">
      <CardContent className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Euro aria-hidden size={20} />
        </div>
        <div className="grid gap-0.5">
          <CardDescription className="font-medium text-secondary-foreground">
            Kontostand
          </CardDescription>
          <span className="text-3xl font-semibold tracking-tight text-primary tabular-nums">
            {formatDecimal(balance)}
          </span>
        </div>
      </CardContent>
    </Card>
  </section>
)

export const TransactionSummaryInfo = ({ summary, total }: TransactionSummaryInfoProps) => {
  const period =
    summary.minimum_date === null && summary.maximum_date === null
      ? 'Keine Buchungen im gewählten Zeitraum'
      : `${formatDate(summary.minimum_date)} bis ${formatDate(summary.maximum_date)}`

  return (
    <section
      aria-label="Informationen zu den gefilterten Transaktionen"
      className="rounded-lg border bg-muted/30 px-4 py-3"
    >
      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BanknoteArrowUp aria-hidden size={14} />
            Eingang
          </dt>
          <dd className="font-medium text-emerald-700 tabular-nums dark:text-emerald-400">
            {formatDecimal(summary.received)}
          </dd>
        </div>
        <div className="grid gap-1">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BanknoteArrowDown aria-hidden size={14} />
            Ausgang
          </dt>
          <dd className="font-medium text-destructive tabular-nums">
            {formatDecimal(summary.paid)}
          </dd>
        </div>
        <div className="grid gap-1">
          <dt className="text-xs text-muted-foreground">Transaktionen</dt>
          <dd className="font-medium">
            {total === 1 ? '1 passende Transaktion' : `${total} passende Transaktionen`}
          </dd>
        </div>
        <div className="grid gap-1">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarRange aria-hidden size={14} />
            Zeitraum
          </dt>
          <dd className="font-medium">{period}</dd>
        </div>
      </dl>
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
            <TableCell className="max-w-48">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{transaction.recipient}</span>
                {transaction.internal_transfer_id === null ? null : (
                  <Badge className="shrink-0" variant="secondary">
                    <ArrowLeftRight aria-hidden /> Umbuchung
                  </Badge>
                )}
              </span>
            </TableCell>
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
