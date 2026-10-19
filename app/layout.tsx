import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Plus_Jakarta_Sans, Inter } from 'next/font/google'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

/**
 * Generic platform fallback metadata.
 *
 * Public showroom routes override this with tenant-specific metadata through
 * `generateMetadata`. Keeping the fallback tenant-neutral prevents one
 * showroom's identity from leaking into another tenant's response.
 */
export const metadata: Metadata = {
  title: 'OtoWeb',
  description: 'Platform website showroom mobil multi-tenant.',
  applicationName: 'OtoWeb',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: 'white' }],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body className={`${jakarta.variable} ${inter.variable} antialiased`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
