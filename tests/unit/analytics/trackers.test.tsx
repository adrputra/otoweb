import { StrictMode } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  InventoryTracker,
  VehicleViewTracker,
} from '@/components/analytics/page-trackers'
import { VehicleShareButton } from '@/components/analytics/vehicle-share-button'

const mocks = vi.hoisted(() => ({
  trackAnalytics: vi.fn(),
}))

vi.mock('@/lib/analytics/client', () => ({
  trackAnalytics: mocks.trackAnalytics,
}))

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/cars/toyota-fortuner-2021-1')
  Object.defineProperty(navigator, 'clipboard', {
    value: undefined,
    configurable: true,
  })
  Object.defineProperty(navigator, 'share', {
    value: undefined,
    configurable: true,
  })
})

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: undefined,
    configurable: true,
  })
  Object.defineProperty(navigator, 'share', {
    value: undefined,
    configurable: true,
  })
})

function setShare(value: unknown) {
  Object.defineProperty(navigator, 'share', {
    value,
    configurable: true,
    writable: true,
  })
}

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', {
    value,
    configurable: true,
    writable: true,
  })
}

describe('VehicleViewTracker', () => {
  it('records one view per vehicle and ignores an unchanged re-render', () => {
    const { rerender } = render(<VehicleViewTracker vehicleSlug="toyota-fortuner-2021-1" />)

    expect(mocks.trackAnalytics).toHaveBeenCalledTimes(1)
    expect(mocks.trackAnalytics).toHaveBeenCalledWith({
      event: 'vehicle_view',
      vehicleSlug: 'toyota-fortuner-2021-1',
      path: '/cars/toyota-fortuner-2021-1',
    })

    rerender(<VehicleViewTracker vehicleSlug="toyota-fortuner-2021-1" />)
    expect(mocks.trackAnalytics).toHaveBeenCalledTimes(1)

    rerender(<VehicleViewTracker vehicleSlug="other-vehicle" />)
    expect(mocks.trackAnalytics).toHaveBeenCalledTimes(2)
    expect(mocks.trackAnalytics).toHaveBeenLastCalledWith({
      event: 'vehicle_view',
      vehicleSlug: 'other-vehicle',
      path: '/cars/other-vehicle',
    })
  })

  it('does not double-send under Strict Mode', () => {
    render(
      <StrictMode>
        <VehicleViewTracker vehicleSlug="toyota-fortuner-2021-1" />
      </StrictMode>,
    )

    expect(mocks.trackAnalytics).toHaveBeenCalledTimes(1)
  })
})

describe('InventoryTracker', () => {
  it('records nothing for an unfiltered inventory page', () => {
    render(<InventoryTracker searchParams={{}} />)
    expect(mocks.trackAnalytics).not.toHaveBeenCalled()
  })

  it('records search and filter use for a filtered search', () => {
    render(<InventoryTracker searchParams={{ brand: 'Toyota', maxPrice: '500000000' }} />)

    expect(mocks.trackAnalytics).toHaveBeenCalledTimes(2)
    expect(mocks.trackAnalytics).toHaveBeenNthCalledWith(1, {
      event: 'inventory_search',
      path: '/cars',
      filters: { brand: 'Toyota', maxPrice: '500000000' },
    })
    expect(mocks.trackAnalytics).toHaveBeenNthCalledWith(2, {
      event: 'filter_use',
      path: '/cars',
      filters: { brand: 'Toyota', maxPrice: '500000000' },
    })
  })

  it('treats a sort-only change as a search but not filter use', () => {
    render(<InventoryTracker searchParams={{ sort: 'harga-terendah' }} />)

    expect(mocks.trackAnalytics).toHaveBeenCalledTimes(1)
    expect(mocks.trackAnalytics).toHaveBeenCalledWith({
      event: 'inventory_search',
      path: '/cars',
      filters: { sort: 'harga-terendah' },
    })
  })

  it('records once per distinct query state', () => {
    const { rerender } = render(<InventoryTracker searchParams={{ brand: 'Toyota' }} />)
    expect(mocks.trackAnalytics).toHaveBeenCalledTimes(2)

    rerender(<InventoryTracker searchParams={{ brand: 'Toyota' }} />)
    expect(mocks.trackAnalytics).toHaveBeenCalledTimes(2)

    rerender(<InventoryTracker searchParams={{ brand: 'Honda' }} />)
    expect(mocks.trackAnalytics).toHaveBeenCalledTimes(4)
  })
})

describe('VehicleShareButton', () => {
  it('uses the native share sheet and records the method', async () => {
    const user = userEvent.setup()
    const share = vi.fn().mockResolvedValue(undefined)
    setShare(share)

    render(<VehicleShareButton vehicleSlug="toyota-fortuner-2021-1" title="Toyota Fortuner" />)
    await user.click(screen.getByRole('button', { name: /bagikan unit/i }))

    expect(share).toHaveBeenCalledWith({
      title: 'Toyota Fortuner',
      url: window.location.href,
    })
    expect(mocks.trackAnalytics).toHaveBeenCalledWith({
      event: 'vehicle_share',
      vehicleSlug: 'toyota-fortuner-2021-1',
      path: '/cars/toyota-fortuner-2021-1',
      method: 'native',
    })
  })

  it('copies the link when the native share sheet is unavailable', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })

    render(<VehicleShareButton vehicleSlug="toyota-fortuner-2021-1" />)
    await user.click(screen.getByRole('button', { name: /bagikan unit/i }))

    expect(writeText).toHaveBeenCalledWith(window.location.href)
    expect(mocks.trackAnalytics).toHaveBeenCalledWith({
      event: 'vehicle_share',
      vehicleSlug: 'toyota-fortuner-2021-1',
      path: '/cars/toyota-fortuner-2021-1',
      method: 'clipboard',
    })
    expect(await screen.findByRole('button', { name: /tautan disalin/i })).toBeInTheDocument()
  })

  it('records nothing when the visitor cancels the native share sheet', async () => {
    const user = userEvent.setup()
    setShare(vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')))

    render(<VehicleShareButton vehicleSlug="toyota-fortuner-2021-1" />)
    await user.click(screen.getByRole('button', { name: /bagikan unit/i }))

    expect(mocks.trackAnalytics).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /bagikan unit/i })).toBeInTheDocument()
  })
})
