/* cspell:words Auswertungen Buchungsübersicht Formularbausteine Hauptkontos Kontenübersicht Kontostand Ladestatus Monatsvergleich */

import { useState } from 'react'
import {
  ChartNoAxesCombined,
  Landmark,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  Tags,
  Trash2,
  WalletCards
} from 'lucide-react'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList
} from '@/components/ui/combobox'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ApplicationLayout } from '@/layouts/application-layout'
import type { NavigationItem } from '@/layouts/application-layout'

const formatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR'
})

const chartData = [
  { month: 'Mai', einnahmen: 4820, ausgaben: 2670 },
  { month: 'Juni', einnahmen: 4510, ausgaben: 2350 },
  { month: 'Juli', einnahmen: 5010, ausgaben: 2890 }
]

const chartConfig = {
  einnahmen: {
    label: 'Einnahmen',
    color: 'var(--chart-2)'
  },
  ausgaben: {
    label: 'Ausgaben',
    color: 'var(--chart-5)'
  }
} satisfies ChartConfig

const bankOptions = ['DKB', 'N26', 'comdirect', 'Holvi']

const navigation = [
  { label: 'Konten', href: '#konten', icon: Landmark },
  { label: 'Auswertungen', href: '#auswertungen', icon: ChartNoAxesCombined },
  { label: 'Kategorien', href: '#kategorien', icon: Tags },
  { label: 'Verträge', href: '#vertraege', icon: WalletCards }
] satisfies NavigationItem[]

const transactions = [
  { date: '13.08.2026', recipient: 'Bäckerei am Markt', category: 'Lebensmittel', amount: -12.8 },
  { date: '12.08.2026', recipient: 'Nordlicht GmbH', category: 'Gehalt', amount: 4120 },
  { date: '11.08.2026', recipient: 'Stadtwerke', category: 'Wohnen', amount: -86.34 }
]

export const DesignSystemShowcase = () => {
  const [bookingDate, setBookingDate] = useState<Date | undefined>(new Date(2026, 7, 13))

  return (
    <ApplicationLayout navigation={navigation} activeHref="#konten">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Willkommen zurück</p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Kontenübersicht
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">
                  <SlidersHorizontal data-icon="inline-start" />
                  Filter
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Transaktionen filtern</SheetTitle>
                  <SheetDescription>Grenze die Buchungsübersicht ein.</SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 px-4">
                  <Field>
                    <FieldLabel htmlFor="showcase-search">Suche</FieldLabel>
                    <Input id="showcase-search" placeholder="Empfänger oder Betreff" />
                  </Field>
                  <Field>
                    <FieldLabel>Zeitraum</FieldLabel>
                    <DatePicker value={bookingDate} onValueChange={setBookingDate} />
                  </Field>
                </div>
                <SheetFooter>
                  <SheetClose asChild>
                    <Button variant="outline">Schließen</Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button>Filter anwenden</Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus data-icon="inline-start" />
                  Neue Transaktion
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Neue Transaktion</DialogTitle>
                  <DialogDescription>
                    Erfasse eine Buchung für Dein ausgewähltes Konto.
                  </DialogDescription>
                </DialogHeader>
                <TransactionForm bookingDate={bookingDate} onBookingDateChange={setBookingDate} />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Abbrechen</Button>
                  </DialogClose>
                  <Button
                    onClick={() => {
                      toast.success('Die Transaktion wurde als Entwurf gespeichert.', {
                        id: 'design-system-transaction-draft'
                      })
                    }}
                  >
                    Entwurf speichern
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        <section id="konten" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Gesamtvermögen"
            value={formatter.format(18432.76)}
            trend="8,4 % gegenüber Juli"
          />
          <SummaryCard
            label="Einnahmen im August"
            value={formatter.format(5010)}
            trend="11,1 % gegenüber Juli"
          />
          <SummaryCard
            label="Ausgaben im August"
            value={formatter.format(-2890)}
            trend="23,0 % gegenüber Juli"
          />
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm font-medium">Ladestatus</p>
            <div className="mt-4 grid gap-3">
              <Skeleton className="h-4 w-2/3" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Kontostand wird aktualisiert
              </div>
            </div>
          </div>
        </section>

        <Tabs defaultValue="buchungen">
          <TabsList variant="line" aria-label="Inhaltsbereich">
            <TabsTrigger value="buchungen">Buchungen</TabsTrigger>
            <TabsTrigger value="auswertung">Auswertung</TabsTrigger>
          </TabsList>
          <TabsContent value="buchungen" className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
            <section className="rounded-xl border bg-card">
              <div className="flex items-center justify-between gap-4 border-b p-4">
                <div>
                  <h2 className="font-heading text-base font-medium">Letzte Buchungen</h2>
                  <p className="text-sm text-muted-foreground">
                    Aktuellste Transaktionen des Hauptkontos
                  </p>
                </div>
                <Badge variant="secondary">3 Buchungen</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Empfänger</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                    <TableHead>
                      <span className="sr-only">Aktionen</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={`${transaction.date}-${transaction.recipient}`}>
                      <TableCell>{transaction.date}</TableCell>
                      <TableCell className="font-medium">{transaction.recipient}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{transaction.category}</Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          transaction.amount < 0
                            ? 'text-destructive'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {formatter.format(transaction.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Weitere Aktionen">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Details anzeigen</DropdownMenuItem>
                            <DropdownMenuItem>Bearbeiten</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t p-3">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious href="#konten" />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext href="#konten" />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </section>
            <section id="auswertungen" className="rounded-xl border bg-card p-4">
              <div className="mb-4">
                <h2 className="font-heading text-base font-medium">Monatsvergleich</h2>
                <p className="text-sm text-muted-foreground">
                  Einnahmen und Ausgaben der letzten drei Monate
                </p>
              </div>
              <ChartContainer config={chartConfig} className="min-h-64 w-full">
                <BarChart accessibilityLayer data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="einnahmen" fill="var(--color-einnahmen)" radius={4} />
                  <Bar dataKey="ausgaben" fill="var(--color-ausgaben)" radius={4} />
                </BarChart>
              </ChartContainer>
            </section>
          </TabsContent>
          <TabsContent value="auswertung" className="mt-4">
            <section className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Weitere Kennzahlen erscheinen hier, sobald die API-Auswertungen verfügbar sind.
            </section>
          </TabsContent>
        </Tabs>

        <section id="kategorien" className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-4 sm:p-6">
            <h2 className="font-heading text-lg font-medium">Formularbausteine</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Einheitliche Felder für Buchungen und Filter.
            </p>
            <TransactionForm bookingDate={bookingDate} onBookingDateChange={setBookingDate} />
          </div>
          <div className="rounded-xl border bg-card p-4 sm:p-6">
            <h2 className="font-heading text-lg font-medium">Bestätigung</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Destruktive Aktionen verlangen eine klare Entscheidung.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="mt-5">
                  <Trash2 data-icon="inline-start" />
                  Entwurf verwerfen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Entwurf wirklich verwerfen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Die eingegebenen Werte gehen verloren und können nicht wiederhergestellt werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => {
                      toast.success('Der Entwurf wurde verworfen.', {
                        id: 'design-system-draft-discarded'
                      })
                    }}
                  >
                    Entwurf verwerfen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>
      </div>
    </ApplicationLayout>
  )
}

type SummaryCardProps = {
  label: string
  value: string
  trend: string
}

const SummaryCard = ({ label, value, trend }: SummaryCardProps) => {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{trend}</p>
    </div>
  )
}

type TransactionFormProps = {
  bookingDate?: Date
  onBookingDateChange: (value: Date | undefined) => void
}

const TransactionForm = ({ bookingDate, onBookingDateChange }: TransactionFormProps) => {
  return (
    <form className="mt-5">
      <FieldSet>
        <FieldLegend>Transaktion erfassen</FieldLegend>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="showcase-recipient">Empfänger oder Versender</FieldLabel>
              <Input id="showcase-recipient" placeholder="Zum Beispiel Bäckerei am Markt" />
            </Field>
            <Field>
              <FieldLabel htmlFor="showcase-amount">Betrag</FieldLabel>
              <Input id="showcase-amount" inputMode="decimal" placeholder="0,00" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Bank</FieldLabel>
              <Combobox items={bankOptions}>
                <ComboboxInput placeholder="Bank auswählen" />
                <ComboboxContent>
                  <ComboboxEmpty>Keine passende Bank gefunden.</ComboboxEmpty>
                  <ComboboxList>
                    {(bank) => (
                      <ComboboxItem key={bank} value={bank}>
                        {bank}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Field>
            <Field>
              <FieldLabel>Buchungstag</FieldLabel>
              <DatePicker value={bookingDate} onValueChange={onBookingDateChange} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Kategorie</FieldLabel>
              <Select defaultValue="lebensmittel">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Kategorie auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lebensmittel">Lebensmittel</SelectItem>
                  <SelectItem value="wohnen">Wohnen</SelectItem>
                  <SelectItem value="freizeit">Freizeit</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="showcase-notification">Benachrichtigung</FieldLabel>
              <FieldContent className="flex-row items-center justify-between rounded-lg border px-3 py-2">
                <FieldDescription>Bei der nächsten Buchung erinnern</FieldDescription>
                <Switch
                  id="showcase-notification"
                  defaultChecked
                  aria-label="Benachrichtigung aktivieren"
                />
              </FieldContent>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="showcase-subject">Betreff</FieldLabel>
            <Textarea id="showcase-subject" placeholder="Weitere Angaben zur Buchung" />
          </Field>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}
