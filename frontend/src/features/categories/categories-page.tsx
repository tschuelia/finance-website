/* cspell:words Kategorisierung Buchungstext Kategorievorschau Zuordnungsmuster */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ListChecks, Pencil, Plus, Save, Tags } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Link } from 'react-router'
import { createCategory, updateCategory } from '@/api/categories'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { useAuth } from '@/features/auth/use-auth'
import { categoriesQueryKey, useCategories } from '@/hooks/use-categories'
import { usePatternPreview } from '@/hooks/use-pattern-preview'
import type { Category } from '@/types/categories'
import { ASSIGNMENTS } from '@/routes/urls'

type CategoryEditorProps = {
  categories: Category[]
  category?: Category
  onOpenChange: (open: boolean) => void
  open: boolean
}

const normalizedTerms = (patterns: string): string[] => [
  ...new Map(
    patterns
      .split(/\r?\n/)
      .map((term) => term.trim())
      .filter(Boolean)
      .map((term) => [term.toLocaleLowerCase('de-DE'), term])
  ).values()
]

const conflictingTerms = (category: Category, categories: Category[]): string[] => {
  const otherTerms = categories
    .filter((candidate) => candidate.id !== category.id)
    .flatMap((candidate) => normalizedTerms(candidate.patterns))
    .map((term) => term.toLocaleLowerCase('de-DE'))
  return normalizedTerms(category.patterns).filter((term) => {
    const normalized = term.toLocaleLowerCase('de-DE')
    return otherTerms.some(
      (otherTerm) => normalized.includes(otherTerm) || otherTerm.includes(normalized)
    )
  })
}

const CategoryEditor = ({ categories, category, onOpenChange, open }: CategoryEditorProps) => {
  const queryClient = useQueryClient()
  const [name, setName] = useState(category?.name ?? '')
  const [patterns, setPatterns] = useState(category?.patterns ?? '')
  const [formError, setFormError] = useState<string | undefined>()
  const previewCategory: Category = {
    id: category?.id ?? -1,
    name,
    patterns,
    assigned_count: category?.assigned_count ?? 0
  }
  const terms = normalizedTerms(patterns)
  const visibleTerms = terms.slice(0, 12)
  const remainingTermCount = terms.length - visibleTerms.length
  const conflicts = conflictingTerms(previewCategory, categories)
  const matchPreview = usePatternPreview({ patterns })
  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { name, patterns }
      return category === undefined
        ? await createCategory(payload)
        : await updateCategory(category.id, payload)
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: categoriesQueryKey })
      const message =
        category === undefined
          ? 'Die Kategorie wurde angelegt.'
          : 'Die Kategorie wurde gespeichert.'
      toast.success(message, { id: `category-saved-${saved.id}` })
      onOpenChange(false)
    },
    onError: (error) =>
      setFormError(
        error instanceof Error ? error.message : 'Die Kategorie konnte nicht gespeichert werden.'
      )
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(undefined)
    mutation.mutate()
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-lg">
        <DialogHeader className="min-w-0 pr-8">
          <DialogTitle>
            {category === undefined ? 'Kategorie anlegen' : 'Kategorie bearbeiten'}
          </DialogTitle>
          <DialogDescription>
            Buchungen werden basierend auf diesen Begriffen automatisch kategorisiert.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-0"
          onSubmit={submit}
        >
          <div className="grid min-h-0 min-w-0 gap-4 overflow-y-auto overscroll-contain pr-1">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                maxLength={255}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="category-patterns">Zuordnungsmuster</Label>
              <Textarea
                className="field-sizing-fixed min-h-32 max-h-48 resize-y overflow-y-auto"
                id="category-patterns"
                onChange={(event) => setPatterns(event.target.value)}
                placeholder={'z. B. Supermarkt\nBäckerei'}
                rows={6}
                value={patterns}
              />
              <p className="text-xs text-muted-foreground">
                Begriffe durch eine neue Zeile trennen.
              </p>
              <div className="flex min-w-0 flex-wrap gap-1">
                {visibleTerms.map((term) => (
                  <Badge className="max-w-full" key={term} variant="outline">
                    <span className="truncate">{term}</span>
                  </Badge>
                ))}
                {remainingTermCount === 0 ? null : (
                  <Badge variant="secondary">+ {remainingTermCount} weitere</Badge>
                )}
              </div>
              {conflicts.length === 0 ? null : (
                <p className="flex min-w-0 items-start gap-2 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 break-words">
                    Bereits in anderen Kategorien verwendet: {conflicts.join(', ')}
                  </span>
                </p>
              )}
              {matchPreview.status === 'idle' ? null : matchPreview.status === 'loading' ? (
                <p className="text-xs text-muted-foreground">Passende Buchungen werden gesucht …</p>
              ) : matchPreview.status === 'error' ? (
                <p className="text-xs text-destructive">Die Treffervorschau ist fehlgeschlagen.</p>
              ) : (
                <div className="min-w-0 overflow-hidden rounded-lg bg-muted p-3 text-sm">
                  <p className="font-medium">
                    {matchPreview.data.total === 1
                      ? '1 historische Buchung passt'
                      : `${matchPreview.data.total} historische Buchungen passen`}
                  </p>
                  {matchPreview.data.examples.map((example) => (
                    <p
                      className="mt-1 min-w-0 truncate text-xs text-muted-foreground"
                      key={example.id}
                    >
                      {example.recipient || example.subject} · {example.account_name}
                    </p>
                  ))}
                </div>
              )}
            </div>
            {formError === undefined ? null : (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>
          <DialogFooter className="mt-4" showCloseButton>
            <Button disabled={mutation.isPending} type="submit">
              <Save aria-hidden />
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export const CategoriesPage = () => {
  const { state } = useAuth()
  const categories = useCategories()
  const [editorCategory, setEditorCategory] = useState<Category | null | undefined>(undefined)
  const canManage = state.status === 'authenticated' && state.user.is_superuser

  if (categories.status === 'loading') {
    return <LoadingState title="Kategorien werden geladen" />
  }

  if (categories.status === 'error') {
    return <ErrorState error={categories.error} />
  }

  return (
    <>
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to={ASSIGNMENTS}>
                <ListChecks aria-hidden />
                Offene Zuordnungen
              </Link>
            </Button>
            {canManage ? (
              <Button onClick={() => setEditorCategory(null)}>
                <Plus aria-hidden />
                Kategorie anlegen
              </Button>
            ) : null}
          </div>
        }
        description={
          canManage
            ? 'Definiere Muster, damit Buchungen schneller die richtige Kategorie erhalten.'
            : 'Kategorien und Zuordnungsmuster werden zentral verwaltet.'
        }
        title="Kategorien"
      />
      {categories.data.length === 0 ? (
        <EmptyState
          action={
            canManage ? (
              <Button onClick={() => setEditorCategory(null)}>
                <Plus aria-hidden />
                Erste Kategorie anlegen
              </Button>
            ) : undefined
          }
          description={
            canManage
              ? 'Lege eine Kategorie und passende Begriffe für die automatische Zuordnung an.'
              : 'Es sind noch keine globalen Kategorien hinterlegt.'
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {categories.data.map((category) => (
            <Card key={category.id}>
              <CardHeader>
                <CardDescription className="flex items-center gap-2">
                  <Tags className="size-4" aria-hidden />
                  Kategorie
                </CardDescription>
                <CardTitle>{category.name}</CardTitle>
                <Badge className="w-fit" variant="secondary">
                  {category.assigned_count === 1
                    ? '1 Buchung'
                    : `${category.assigned_count} Buchungen`}
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="flex min-h-12 flex-wrap content-start gap-1">
                  {normalizedTerms(category.patterns).length === 0 ? (
                    <span className="text-sm text-muted-foreground">
                      Noch keine Muster hinterlegt.
                    </span>
                  ) : (
                    normalizedTerms(category.patterns).map((term) => (
                      <Badge key={term} variant="outline">
                        {term}
                      </Badge>
                    ))
                  )}
                </div>
                {conflictingTerms(category, categories.data).length === 0 ? null : (
                  <p className="flex items-center gap-2 text-xs text-destructive">
                    <AlertTriangle className="size-3.5" aria-hidden />
                    Überschneidung mit einer anderen Kategorie
                  </p>
                )}
                {canManage ? (
                  <Button onClick={() => setEditorCategory(category)} size="sm" variant="outline">
                    <Pencil aria-hidden />
                    Bearbeiten
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {!canManage || editorCategory === undefined ? null : (
        <CategoryEditor
          category={editorCategory ?? undefined}
          categories={categories.data}
          onOpenChange={(open) => {
            if (!open) {
              setEditorCategory(undefined)
            }
          }}
          open
        />
      )}
    </>
  )
}
