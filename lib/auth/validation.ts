import { z } from 'zod'

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email wajib diisi.')
  .max(254, 'Email terlalu panjang.')
  .email('Masukkan alamat email yang valid.')

export const passwordSchema = z
  .string()
  .min(8, 'Kata sandi minimal 8 karakter.')
  .max(72, 'Kata sandi maksimal 72 karakter.')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Kata sandi wajib diisi.').max(1024, 'Kata sandi terlalu panjang.'),
})

export const resetRequestSchema = z.object({
  email: emailSchema,
})

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Konfirmasi kata sandi wajib diisi.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Konfirmasi kata sandi tidak cocok.',
  })

export type LoginInput = z.infer<typeof loginSchema>
export type ResetRequestInput = z.infer<typeof resetRequestSchema>
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>
