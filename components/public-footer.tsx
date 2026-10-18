import { Mail, MapPin, Phone } from 'lucide-react'

import type { Showroom } from '@/lib/types'

/**
 * Shared tenant-configurable footer.
 *
 * Renders on every public surface so contact details, address, opening hours,
 * and social links follow the saved showroom configuration without duplicating
 * the same markup across routes.
 */
export function PublicFooter({ showroom }: { showroom: Showroom }) {
  const socials = [
    ['Instagram', showroom.social.instagram],
    ['TikTok', showroom.social.tiktok],
    ['Facebook', showroom.social.facebook],
  ].filter(([, href]) => Boolean(href)) as [string, string][]

  const cityLine = [showroom.address.city, showroom.address.province, showroom.address.postalCode]
    .filter(Boolean)
    .join(', ')

  return (
    <footer
      className="px-5 py-12 text-[color:var(--showroom-on-secondary)] lg:px-8"
      style={{ backgroundColor: 'var(--showroom-secondary)' }}
    >
      <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr]">
        <div>
          <p className="text-lg font-bold">{showroom.name}</p>
          {showroom.tagline && (
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
              {showroom.tagline}
            </p>
          )}
          <p className="mt-3 max-w-md text-sm leading-6 opacity-60">{showroom.description}</p>
          {socials.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
              {socials.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">Kontak</p>
          <div className="mt-4 flex flex-col gap-3">
            {(showroom.address.street || cityLine) && (
              <p className="flex gap-2 opacity-80">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <span>
                  {showroom.address.street}
                  {showroom.address.street && cityLine && <br />}
                  {cityLine}
                </span>
              </p>
            )}
            {showroom.contact.phone && (
              <a
                href={`tel:${showroom.contact.phone.replace(/[^\d+]/g, '')}`}
                className="flex gap-2 opacity-80 hover:opacity-100"
              >
                <Phone className="size-4 shrink-0" />
                {showroom.contact.phone}
              </a>
            )}
            {showroom.contact.email && (
              <a
                href={`mailto:${showroom.contact.email}`}
                className="flex gap-2 opacity-80 hover:opacity-100"
              >
                <Mail className="size-4 shrink-0" />
                {showroom.contact.email}
              </a>
            )}
          </div>
        </div>

        <div className="text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">Jam buka</p>
          <p className="mt-4 whitespace-pre-line opacity-80">{showroom.address.openingHours}</p>
          {showroom.address.mapUrl && (
            <a
              href={showroom.address.mapUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block border-b border-current pb-1 text-sm font-semibold"
            >
              Buka Google Maps
            </a>
          )}
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-4 border-t pt-6 text-xs opacity-70 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: 'color-mix(in srgb, currentColor 18%, transparent)' }}>
        <p>
          © {new Date().getFullYear()} {showroom.name}
        </p>
        <a
          href="/api/public/whatsapp"
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center justify-center bg-[#25D366] px-4 py-2 text-xs font-semibold text-white opacity-100"
        >
          Chat WhatsApp
        </a>
      </div>
    </footer>
  )
}
