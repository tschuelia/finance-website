/* cspell:words Kategorisierung Buchungstext Kategorievorschau */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Save, Tags } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import { createCategory, updateCategory } from '@/api/categories'
import { Button } from '@/components/ui/button'
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
import { categoriesQueryKey, useCategories } from '@/hooks/use-categories'
import type { Category } from '@/types/categories'

type CategoryEditorProps = {
  category?: Category
  onOpenChange: (open: boolean) => void
  open: boolean
}

const CategoryEditor = ({ category, onOpenChange, open }: CategoryEditorProps) => {
  const queryClient = useQueryClient()
  const [name, setName] = useState(category?.name ?? '')
  const [patterns, setPatterns] = useState(category?.patterns ?? '')
  const [formError, setFormError] = useState<string | undefined>()
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {category === undefined ? 'Kategorie anlegen' : 'Kategorie bearbeiten'}
          </DialogTitle>
          <DialogDescription>
            Lege Begriffe zeilenweise fest, nach denen Buchungen automatisch kategorisiert werden.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              maxLength={255}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category-patterns">Muster</Label>
            <Textarea
              id="category-patterns"
              onChange={(event) => setPatterns(event.target.value)}
              placeholder={'z. B. Supermarkt\nBäckerei'}
              value={patterns}
            />
            <p className="text-xs text-muted-foreground">Ein Begriff pro Zeile genügt.</p>
          </div>
          {formError === undefined ? null : <p className="text-sm text-destructive">{formError}</p>}
          <DialogFooter showCloseButton>
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
  const categories = useCategories()
  const [editorCategory, setEditorCategory] = useState<Category | null | undefined>(undefined)

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
          <Button onClick={() => setEditorCategory(null)}>
            <Plus aria-hidden />
            Kategorie anlegen
          </Button>
        }
        description="Definiere Muster, damit Deine Buchungen schneller die richtige Kategorie erhalten."
        title="Kategorien"
      />
      {categories.data.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={() => setEditorCategory(null)}>
              <Plus aria-hidden />
              Erste Kategorie anlegen
            </Button>
          }
          description="Lege eine Kategorie und passende Begriffe für die automatische Zuordnung an."
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
              </CardHeader>
              <CardContent className="grid gap-3">
                <p className="line-clamp-3 min-h-12 whitespace-pre-line text-sm text-muted-foreground">
                  {category.patterns === '' ? 'Noch keine Muster hinterlegt.' : category.patterns}
                </p>
                <Button onClick={() => setEditorCategory(category)} size="sm" variant="outline">
                  <Pencil aria-hidden />
                  Bearbeiten
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {editorCategory === undefined ? null : (
        <CategoryEditor
          category={editorCategory ?? undefined}
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
