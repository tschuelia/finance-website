Lockfiles must be consistent with package metadata. After any change to `pixi.toml`, run `pixi lock`.

Everything runs in a Pixi environment. Prefix all commands (like `pytest`) with `pixi run` (e.g. `pixi run pytest`).

Code formatting must align with our standards. Run `pixi run lint` before `git commit`s to ensure this.

## Dependency policy

When adding or updating a backend, frontend, or shared tooling dependency, use the latest stable, non-prerelease
release available at that time and regenerate every affected lockfile in the same change. Use the current stable Python
and Bun versions supported by the selected packages.

If the latest releases are incompatible with one another or with the deployment environment, use the newest mutually
compatible versions and document the constraint and reason next to the dependency declaration or in current project
documentation. Do not retain an older version without an explicit compatibility reason.

# React Frontend guidelines

## Build and development commands

The frontend uses Bun for package management and commits `bun.lock`. Run installation, dependency, and project commands
through Pixi.


### Formatting Style

- **No semicolons** at the end of statements
- **Single quotes** for strings
- **Types over interfaces** - Use `type` instead of `interface` for all type definitions
- **Biome** for formatting, **ESLint** for linting

### API Layer

The backend request and response schemas are the canonical API contract. The frontend uses manually maintained Zod
schemas rather than OpenAPI-based generation or Hey API. Mirror every backend contract consumed by the frontend under
`src/types`, and update the mirror in the same task whenever the backend contract changes.

Keep handwritten API clients and resource wrappers under `src/api`. Use the configured `apiClient` from
`src/api/index.ts`, and parse structured responses with the corresponding frontend Zod schema before returning them.

<!-- prettier-ignore -->
```typescript
import { apiClient } from '@/api/index'
import { ExampleSchema } from '@/types/example'
import type { Example } from '@/types/example'

export const getExample = async (exampleId: string): Promise<Example> => {
  const response = await apiClient.get(`/api/v1/examples/${exampleId}`)
  return ExampleSchema.parse(response.data)
}
```

Keep transport-specific behavior such as blob responses, multipart uploads, or best-effort reporting inside these
wrappers. Parse every structured response with its manually maintained Zod schema before returning it.

### Custom Hooks

Use TanStack Query with discriminated union return types from `hooks/resolveQuery.ts`. Prefer delegating the final loading/error/data state conversion to `resolveQuery`.

<!-- prettier-ignore -->
```typescript
import { useQuery } from '@tanstack/react-query'
import { getExample } from '@/api/examples'
import type { HookReturnValue } from '@/hooks/resolveQuery'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { Example } from '@/types/example'

export const useExample = (exampleId: string): HookReturnValue<Example> => {
  const query = useQuery({
    queryKey: ['example', exampleId],
    queryFn: async () => await getExample(exampleId)
  })

  return resolveQuery(query)
}
```

### Type System

Backend-mirrored schemas are handwritten under `src/types`. Keep the backend field and model names, define runtime
validation with Zod, and infer TypeScript types from those schemas. Do not maintain a separate TypeScript-only
definition for the same contract. Frontend-only schemas also remain under `src/types`.

<!-- prettier-ignore -->
```typescript
import * as z from 'zod'

export const ExampleSchema = z.object({
  example_id: z.uuid(),
  created_at: z.iso.datetime({ local: true }).pipe(z.coerce.date()),
  status: z.enum(['pending', 'processing', 'completed', 'failed'])
})

export type Example = z.infer<typeof ExampleSchema>
```

### Components

Use functional components with TypeScript props. Prefer locally generated shadcn components over custom-created and styled components, and use `lucide-react` icons where appropriate.

<!-- prettier-ignore -->
```tsx
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ExampleCardProps = {
  onUpload: () => void
}

export const ExampleCard = ({ onUpload }: ExampleCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dokumente</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="secondary" onClick={onUpload}>
          <Upload size={16} />
          Hochladen
        </Button>
      </CardContent>
    </Card>
  )
}
```

Place the app-wide `Toaster` from `@/components/ui/sonner` in the application providers, as in
`src/components/providers/application-providers.tsx`.

#### Styling with Tailwind

Use Tailwind CSS classes. The frontend uses Tailwind 4 with the `@tailwindcss/vite` plugin and keeps the shadcn theme
variables and base styles in `src/index.css`.

```tsx
<div className="flex items-center gap-4 rounded-lg bg-gray-100 p-4">
  <span className="text-sm font-medium text-gray-700">Status</span>
</div>
```

### Path Aliases

Use `@/` for imports from `src/`. Omit file extensions from import paths.

<!-- prettier-ignore -->
```typescript
import { useExample } from '@/hooks/useExample'
import type { Example } from '@/types/example'
```

### URL Helpers

Use URL helper functions and constants from `routes/urls.ts`.

<!-- prettier-ignore -->
```typescript
import { HOME, accountTransactionImportUrl, accountUrl } from '@/routes/urls'

navigate(HOME)

const accountId = 1
navigate(accountUrl(accountId))
navigate(accountTransactionImportUrl(accountId))
```

### UI Language

The UI language is strictly German. All user-facing strings must be in German only with an informal _Du_, German typographic quotes, a `/* cspell:words … */` pragma at the top of the file for domain words.

### Error Handling

Use `toast` from `sonner` for toast notifications with unique IDs:

<!-- prettier-ignore -->
```typescript
import { toast } from 'sonner'

// spellchecker:off
toast.error(`Es ist ein Fehler aufgetreten. (Fehlercode: ${errorStatus})`, {
  description: errorMessage,
  id: `error-${errorStatus}-${errorMessage.slice(0, 100)}`
})
// spellchecker:on
```

### Frontend Best Practices

1. **Type Safety**: No `any` or `never` types. Use proper typing for all props and state.
2. **Component Size**: Keep components focused. Each component should handle a single concern only but may manage multiple sub-components.
3. **Hook Composition**: Compose hooks for complex logic. Keep hooks pure.
4. **Consistent Imports**: Use `@/` path alias. Import types with `type` keyword. Omit file extensions from import paths.
5. **Loading States**: Always handle loading and error states in data-fetching components.
6. **Zod Validation**: Parse structured API responses with the manually mirrored Zod schema and keep it synchronized with the canonical backend contract.
7. **No manual .d.ts files**: Never create `*.d.ts` declaration files. If you accidentally create one, delete it immediately. TypeScript declaration files are auto-generated by the build process.
