import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn utility function', () => {
  it('should merge class names correctly', () => {
    const result = cn('px-4', 'py-2', 'bg-blue-500')
    expect(result).toBe('px-4 py-2 bg-blue-500')
  })

  it('should handle conditional classes', () => {
    const isActive = true
    const result = cn('px-4', isActive && 'bg-blue-500', !isActive && 'bg-gray-500')
    expect(result).toBe('px-4 bg-blue-500')
  })

  it('should handle object syntax', () => {
    const result = cn({
      'px-4': true,
      'py-2': false,
      'bg-blue-500': true,
    })
    expect(result).toBe('px-4 bg-blue-500')
  })

  it('should handle mixed inputs', () => {
    const result = cn('px-4', ['py-2', 'text-white'], { 'bg-blue-500': true })
    expect(result).toBe('px-4 py-2 text-white bg-blue-500')
  })

  it('should deduplicate tailwind classes', () => {
    const result = cn('px-4 py-2', 'py-4 bg-blue-500')
    expect(result).toBe('px-4 py-4 bg-blue-500')
  })
})
