export interface TargetSize {
  width: number
  height: number
}

export type FillMode = 'blur' | 'black' | 'color'

export type ExportFormat = 'jpeg' | 'png'

export interface ProcessOptions {
  targetSize: TargetSize
  fillMode: FillMode
  fillColor?: string
  exportFormat: ExportFormat
  jpegQuality: number
}

export interface ProcessResult {
  blob: Blob
  previewUrl: string
  width: number
  height: number
  mimeType: string
  fileName: string
}

export interface LoadedImageSource {
  image: HTMLImageElement
  width: number
  height: number
  release: () => void
}
