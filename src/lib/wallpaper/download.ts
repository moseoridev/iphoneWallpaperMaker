import type { ProcessResult } from './types'

export function downloadResult(result: ProcessResult) {
  const link = document.createElement('a')
  link.href = result.previewUrl
  link.download = result.fileName
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
}
