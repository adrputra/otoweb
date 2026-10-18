import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import NotFound from '@/app/not-found'
import ErrorPage from '@/app/error'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('not-found page', () => {
  it('shows neutral recovery copy and a 404 status label without a database', () => {
    render(<NotFound />)

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeInTheDocument()
    expect(screen.getByText(/OtoWeb/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kembali ke beranda' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Lihat koleksi mobil' })).toHaveAttribute(
      'href',
      '/cars',
    )
  })
})

describe('route error boundary', () => {
  it('shows recoverable copy and retries through the reset callback', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reset = vi.fn()
    const user = userEvent.setup()

    render(<ErrorPage error={new Error('boom')} reset={reset} />)

    expect(screen.getByRole('heading', { name: 'Halaman ini belum dapat dimuat' })).toBeVisible()
    expect(screen.getByText(/Silakan coba lagi/)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Coba lagi' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })
})
