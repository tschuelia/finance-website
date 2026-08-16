import { AlertTriangle, FileUp, Upload } from 'lucide-react'
import type { RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ImportFilter, ImportStage } from '@/features/transactions/transaction-import-state'

type ImportProgressProps = {
  committing: boolean
  stage: ImportStage
}

export const ImportProgress = ({ committing, stage }: ImportProgressProps) => (
  <ol className="grid gap-3 sm:grid-cols-3" aria-label="Importschritte">
    {[
      ['1', 'Datei auswählen', stage === 'upload'],
      ['2', 'Zuordnungen prüfen', stage === 'preview' && !committing],
      ['3', 'Importieren', committing]
    ].map(([number, label, active]) => (
      <li
        className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${
          active ? 'border-primary bg-primary/5 font-medium' : 'text-muted-foreground'
        }`}
        key={number as string}
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-muted font-medium">
          {number}
        </span>
        {label}
      </li>
    ))}
  </ol>
)

type ImportUploadProps = {
  accountBank: string
  accountName: string
  fileInputKey: number
  fileInputRef: RefObject<HTMLInputElement | null>
  formError?: string
  onFile: (file: File | undefined) => void
  pending: boolean
}

export const ImportUpload = ({
  accountBank,
  accountName,
  fileInputKey,
  fileInputRef,
  formError,
  onFile,
  pending
}: ImportUploadProps) => (
  <Card className="max-w-3xl">
    <CardHeader>
      <CardTitle>Kontoexport hochladen</CardTitle>
      <CardDescription>
        Konto: {accountName} · Bank: {accountBank}. Unterstützt werden CSV-Exporte von Comdirect,
        DKB, Holvi und N26.
      </CardDescription>
    </CardHeader>
    <CardContent className="grid gap-4">
      <button
        className="grid min-h-48 cursor-pointer place-items-center gap-3 rounded-xl border-2 border-dashed border-input p-8 text-center transition-colors hover:border-primary hover:bg-primary/5"
        disabled={pending}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          onFile(event.dataTransfer.files[0])
        }}
        type="button"
      >
        {pending ? (
          <FileUp className="size-10 animate-pulse text-primary" aria-hidden />
        ) : (
          <Upload className="size-10 text-primary" aria-hidden />
        )}
        <span className="grid gap-1">
          <span className="font-medium">
            {pending ? 'CSV-Datei wird geprüft …' : 'CSV-Datei hier ablegen'}
          </span>
          <span className="text-sm text-muted-foreground">
            oder klicken, um eine Datei auszuwählen
          </span>
        </span>
      </button>
      <input
        accept=".csv,text/csv"
        className="sr-only"
        key={fileInputKey}
        onChange={(event) => onFile(event.currentTarget.files?.[0])}
        ref={fileInputRef}
        type="file"
      />
      {formError === undefined ? null : <p className="text-sm text-destructive">{formError}</p>}
    </CardContent>
  </Card>
)

type ImportSummaryProps = {
  categoryAttention: number
  contractAttention: number
  rowCount: number
}

export const ImportSummary = ({
  categoryAttention,
  contractAttention,
  rowCount
}: ImportSummaryProps) => (
  <div className="grid gap-3 sm:grid-cols-3">
    {[
      ['Importbereit', rowCount],
      ['Kategorien prüfen', categoryAttention],
      ['Verträge prüfen', contractAttention]
    ].map(([label, value]) => (
      <Card key={label}>
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardTitle>{value}</CardTitle>
        </CardHeader>
      </Card>
    ))}
  </div>
)

type ImportFilterBarProps = {
  fileName?: string
  filter: ImportFilter
  onChangeFile: () => void
  onFilter: (filter: ImportFilter) => void
  rowCount: number
}

export const ImportFilterBar = ({
  fileName,
  filter,
  onChangeFile,
  onFilter,
  rowCount
}: ImportFilterBarProps) => (
  <Card>
    <CardContent className="flex flex-wrap items-center gap-2 pt-4">
      <span className="mr-auto text-sm text-muted-foreground">
        {fileName} · {rowCount} importierbare Zeilen
      </span>
      {(['all', 'attention', 'category', 'contract'] as const).map((value) => (
        <Button
          key={value}
          onClick={() => onFilter(value)}
          size="sm"
          variant={filter === value ? 'default' : 'outline'}
        >
          {value === 'all'
            ? 'Alle'
            : value === 'attention'
              ? 'Nur offene'
              : value === 'category'
                ? 'Kategorien'
                : 'Verträge'}
        </Button>
      ))}
      <Button onClick={onChangeFile} size="sm" variant="outline">
        Andere Datei
      </Button>
    </CardContent>
  </Card>
)

type ImportSkippedRowsProps = {
  rows: { reason: string; source_row: number }[]
}

export const ImportSkippedRows = ({ rows }: ImportSkippedRowsProps) => {
  if (rows.length === 0) return null
  return (
    <Card className="border-amber-300 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4" aria-hidden />
          {rows.length} Zeilen werden nicht importiert
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1 text-sm">
        {rows.map((row) => (
          <p key={`${row.source_row}-${row.reason}`}>
            CSV-Zeile {row.source_row}: {row.reason}
          </p>
        ))}
      </CardContent>
    </Card>
  )
}
