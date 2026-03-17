import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDebouncedValueCommitter } from './useTransactionFilters'

describe('createDebouncedValueCommitter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('commits only the latest search value after the debounce delay', () => {
    const committedValues: string[] = []
    const committer = createDebouncedValueCommitter<string>((value) => {
      committedValues.push(value)
    }, 250)

    committer.schedule('c')
    vi.advanceTimersByTime(150)
    committer.schedule('cl')
    vi.advanceTimersByTime(150)
    committer.schedule('claude')

    vi.advanceTimersByTime(249)
    expect(committedValues).toEqual([])

    vi.advanceTimersByTime(1)
    expect(committedValues).toEqual(['claude'])
  })

  it('cancels a pending commit when disposed', () => {
    const committedValues: string[] = []
    const committer = createDebouncedValueCommitter<string>((value) => {
      committedValues.push(value)
    }, 250)

    committer.schedule('claude')
    committer.cancel()
    vi.runAllTimers()

    expect(committedValues).toEqual([])
  })
})
