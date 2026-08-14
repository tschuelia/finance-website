import * as z from 'zod'
import { DateTimeSchema } from '@/types/common'

export const LoginRequestSchema = z
  .object({
    username: z.string().min(1).max(150),
    password: z.string().max(4096)
  })
  .strict()

export type LoginRequest = z.infer<typeof LoginRequestSchema>

export const AuthenticatedUserSchema = z
  .object({
    id: z.number().int().positive(),
    username: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    is_superuser: z.boolean(),
    csrf_token: z.string().min(1),
    expires_at: DateTimeSchema
  })
  .strict()

export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>
