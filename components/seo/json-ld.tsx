import { serializeJsonLd, type JsonLdObject } from '@/lib/seo/structured-data'

/**
 * Server-rendered JSON-LD block.
 *
 * The payload is serialized and escaped before being placed in the script
 * element, so tenant-controlled text cannot break out of it.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}
