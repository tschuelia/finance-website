/* cspell:words Zuordnungsvorschlag */

import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  CategoryAssignmentCombobox,
  ContractAssignmentCombobox
} from '@/features/assignments/assignment-comboboxes'
import { formatDate, formatDecimal } from '@/lib/format'
import type { Category } from '@/types/categories'
import type { ContractSummary } from '@/types/contracts'
import type { RuleMatch } from '@/types/matching'

export type AssignmentTableRow = {
  accountName?: string
  amount: number
  categoryId: string
  categoryMatch: RuleMatch
  contractId: string
  contractMatch: RuleMatch
  dateIssue: string
  key: string
  ownerId: number
  ownerName?: string
  recipient: string
  selected: boolean
  sourceLabel?: string
  subject: string
}

type AssignmentReviewTableProps = {
  categories: Category[]
  contracts: ContractSummary[]
  onAssignmentChange: (key: string, assignment: 'category' | 'contract', value: string) => void
  onEdit?: (key: string) => void
  onRemove?: (key: string) => void
  onSelectionChange: (key: string, selected: boolean) => void
  onSubjectChange?: (key: string, value: string) => void
  rows: AssignmentTableRow[]
}

const MatchBadge = ({ match }: { match: RuleMatch }) => {
  if (match.status === 'ambiguous') {
    return (
      <span className="grid gap-1 text-xs text-destructive">
        <Badge className="w-fit" variant="destructive">
          Mehrdeutig
        </Badge>
        {match.candidates.map((candidate) => candidate.name).join(', ')}
      </span>
    )
  }
  if (match.status === 'unique') {
    const candidate = match.candidates[0]
    return (
      <span className="grid gap-1 text-xs text-muted-foreground">
        <Badge className="w-fit" variant="secondary">
          Vorschlag: {candidate?.name}
        </Badge>
        {candidate?.matched_patterns.join(', ')}
      </span>
    )
  }
  return null
}

export const AssignmentReviewTable = ({
  categories,
  contracts,
  onAssignmentChange,
  onEdit,
  onRemove,
  onSelectionChange,
  onSubjectChange,
  rows
}: AssignmentReviewTableProps) => {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <span className="sr-only">Auswahl</span>
            </TableHead>
            <TableHead>Buchung</TableHead>
            <TableHead>Kategorie</TableHead>
            <TableHead>Vertrag</TableHead>
            {onEdit === undefined && onRemove === undefined ? null : (
              <TableHead className="w-20">
                <span className="sr-only">Aktionen</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const ownerContracts = contracts.filter((contract) => contract.owner.id === row.ownerId)
            return (
              <TableRow key={row.key}>
                <TableCell className="align-top">
                  <input
                    aria-label={`Buchung „${row.recipient || row.subject}“ auswählen`}
                    checked={row.selected}
                    className="mt-2 size-4 accent-primary"
                    onChange={(event) => onSelectionChange(row.key, event.target.checked)}
                    type="checkbox"
                  />
                </TableCell>
                <TableCell className="min-w-64 align-top">
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {row.recipient || 'Unbekannter Empfänger'}
                      </span>
                      <span
                        className={
                          row.amount < 0
                            ? 'font-medium text-destructive'
                            : 'font-medium text-emerald-700'
                        }
                      >
                        {formatDecimal(row.amount)}
                      </span>
                    </div>
                    {onSubjectChange === undefined ? (
                      <span className="line-clamp-2 text-sm text-muted-foreground">
                        {row.subject}
                      </span>
                    ) : (
                      <Input
                        aria-label={`Betreff für „${row.recipient || row.sourceLabel || 'Buchung'}“`}
                        onChange={(event) => onSubjectChange(row.key, event.target.value)}
                        required
                        value={row.subject}
                      />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(row.dateIssue)}
                      {row.sourceLabel === undefined ? '' : ` · ${row.sourceLabel}`}
                      {row.accountName === undefined ? '' : ` · ${row.accountName}`}
                      {row.ownerName === undefined ? '' : ` · ${row.ownerName}`}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="min-w-48 align-top">
                  <div className="grid gap-1.5">
                    <CategoryAssignmentCombobox
                      ariaLabel={`Kategorie für „${row.recipient || row.subject}“`}
                      categories={categories}
                      className="w-full min-w-36"
                      noneLabel="Keine Kategorie"
                      onValueChange={(value) =>
                        onAssignmentChange(row.key, 'category', value ?? '')
                      }
                      placeholder="Keine Kategorie"
                      value={row.categoryId}
                    />
                    <MatchBadge match={row.categoryMatch} />
                    {row.categoryId === '' && row.categoryMatch.status === 'unique' ? (
                      <Button
                        className="w-fit"
                        onClick={() =>
                          onAssignmentChange(
                            row.key,
                            'category',
                            String(row.categoryMatch.candidates[0]?.id ?? '')
                          )
                        }
                        size="sm"
                        variant="ghost"
                      >
                        Vorschlag übernehmen
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="min-w-48 align-top">
                  <div className="grid gap-1.5">
                    <ContractAssignmentCombobox
                      ariaLabel={`Vertrag für „${row.recipient || row.subject}“`}
                      className="w-full min-w-36"
                      contracts={ownerContracts}
                      noneLabel="Kein Vertrag"
                      onValueChange={(value) =>
                        onAssignmentChange(row.key, 'contract', value ?? '')
                      }
                      placeholder="Kein Vertrag"
                      value={row.contractId}
                    />
                    <MatchBadge match={row.contractMatch} />
                    {row.contractId === '' && row.contractMatch.status === 'unique' ? (
                      <Button
                        className="w-fit"
                        onClick={() =>
                          onAssignmentChange(
                            row.key,
                            'contract',
                            String(row.contractMatch.candidates[0]?.id ?? '')
                          )
                        }
                        size="sm"
                        variant="ghost"
                      >
                        Vorschlag übernehmen
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
                {onEdit === undefined && onRemove === undefined ? null : (
                  <TableCell className="align-top">
                    <div className="flex gap-1">
                      {onEdit === undefined ? null : (
                        <Button
                          aria-label="Buchungsdetails bearbeiten"
                          onClick={() => onEdit(row.key)}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <Pencil aria-hidden />
                        </Button>
                      )}
                      {onRemove === undefined ? null : (
                        <Button
                          aria-label="Buchung aus dem Import entfernen"
                          onClick={() => onRemove(row.key)}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <Trash2 aria-hidden className="text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
