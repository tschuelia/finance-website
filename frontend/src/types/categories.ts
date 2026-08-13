import * as z from 'zod'

export const CategorySchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    patterns: z.string()
  })
  .strict()

export type Category = z.infer<typeof CategorySchema>

export const CategoryWriteSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    patterns: z.string().default('')
  })
  .strict()

export type CategoryWrite = z.infer<typeof CategoryWriteSchema>

export const RecategorizationSchema = z
  .object({
    changed: z.number().int().nonnegative()
  })
  .strict()

export type Recategorization = z.infer<typeof RecategorizationSchema>
