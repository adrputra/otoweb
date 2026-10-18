import Link from 'next/link'

/**
 * Global 404.
 *
 * This page must render in the initial HTML even when the database is down,
 * the hostname is unknown, or the client never hydrates. It therefore uses the
 * neutral platform identity. Tenant-specific vehicle 404s are handled by
 * `app/cars/[slug]/not-found.tsx` with showroom copy.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#faf9f7] px-5 text-center text-neutral-950">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-700">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-neutral-600">
        Alamat ini tidak tersedia. Periksa kembali tautannya atau kembali ke beranda OtoWeb.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center bg-neutral-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
        >
          Kembali ke beranda
        </Link>
        <Link
          href="/cars"
          className="inline-flex min-h-11 items-center justify-center border border-neutral-300 px-5 text-sm font-semibold text-neutral-800 transition-colors hover:border-neutral-500"
        >
          Lihat koleksi mobil
        </Link>
      </div>
    </main>
  )
}
