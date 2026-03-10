import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:mock') as typeof URL.createObjectURL
}

if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL
}
