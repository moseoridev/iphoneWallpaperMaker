import { blurImageData } from '@kayahr/stackblur'
import picaFactory from 'pica'

import { getContainRect, getCoverRect } from './geometry'
import type {
  ExportFormat,
  LoadedImageSource,
  ProcessOptions,
  ProcessResult,
  TargetSize,
} from './types'

let picaInstance: ReturnType<typeof picaFactory> | null = null

function getPica() {
  picaInstance ??= picaFactory()
  return picaInstance
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function getContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('캔버스를 초기화하지 못했습니다. 브라우저를 다시 열고 시도하세요.')
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  return context
}

function looksLikeHeic(file: File) {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.(heic|heif)$/i.test(file.name)
  )
}

function clampJpegQuality(quality: number) {
  return Math.min(100, Math.max(1, Math.round(quality))) / 100
}

async function loadImageFromBlob(blob: Blob): Promise<LoadedImageSource> {
  const objectUrl = URL.createObjectURL(blob)
  const image = new Image()
  image.decoding = 'async'

  return await new Promise((resolve, reject) => {
    image.onload = () => {
      resolve({
        image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        release: () => URL.revokeObjectURL(objectUrl),
      })
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('이미지를 읽지 못했습니다. 다른 사진으로 다시 시도하세요.'))
    }

    image.src = objectUrl
  })
}

async function maybeConvertHeic(file: File) {
  if (!looksLikeHeic(file)) {
    return file
  }

  const { heicTo, isHeic } = await import('heic-to')
  const confirmed = await isHeic(file).catch(() => true)

  if (!confirmed) {
    return file
  }

  try {
    return await heicTo({
      blob: file,
      type: 'image/png',
    })
  } catch {
    throw new Error('HEIC 변환에 실패했습니다. 기기에서 JPEG/PNG로 내보낸 뒤 다시 시도하세요.')
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number) {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('결과 이미지를 저장하지 못했습니다. 다시 시도하세요.'))
        return
      }

      resolve(blob)
    }, mimeType, quality)
  })
}

function getBlurRadius(targetSize: TargetSize) {
  return Math.min(140, Math.max(24, Math.round(Math.min(targetSize.width, targetSize.height) / 22)))
}

function getOutputMimeType(format: ExportFormat) {
  return format === 'png' ? 'image/png' : 'image/jpeg'
}

function getOutputFileExtension(format: ExportFormat) {
  return format === 'png' ? 'png' : 'jpg'
}

async function renderBlurBackground(
  source: LoadedImageSource,
  targetSize: TargetSize,
  context: CanvasRenderingContext2D,
) {
  const coverRect = getCoverRect(source, targetSize)
  context.drawImage(source.image, coverRect.x, coverRect.y, coverRect.width, coverRect.height)

  const imageData = context.getImageData(0, 0, targetSize.width, targetSize.height)
  blurImageData(imageData, getBlurRadius(targetSize), false)
  context.putImageData(imageData, 0, 0)
}

export async function readImageSize(file: File) {
  const decoded = await loadImageFromBlob(file)

  try {
    return {
      width: decoded.width,
      height: decoded.height,
    }
  } finally {
    decoded.release()
  }
}

export async function resolveTargetSize(manualSize: TargetSize | null, screenshotFile?: File) {
  if (manualSize) {
    return manualSize
  }

  if (screenshotFile) {
    return await readImageSize(screenshotFile)
  }

  throw new Error('목표 해상도를 입력하거나 스크린샷을 선택하세요.')
}

export async function decodeSourceImage(file: File) {
  const normalizedBlob = await maybeConvertHeic(file)
  return await loadImageFromBlob(normalizedBlob)
}

export function getExportFileName(format: ExportFormat, targetSize: TargetSize) {
  return `wallpaper-${targetSize.width}x${targetSize.height}.${getOutputFileExtension(format)}`
}

export function getExportMimeType(format: ExportFormat) {
  return getOutputMimeType(format)
}

export async function renderWallpaper(
  source: LoadedImageSource,
  options: ProcessOptions,
): Promise<ProcessResult> {
  const { targetSize } = options
  const canvas = createCanvas(targetSize.width, targetSize.height)
  const context = getContext(canvas)

  if (options.fillMode === 'blur') {
    await renderBlurBackground(source, targetSize, context)
  } else {
    context.fillStyle = options.fillMode === 'color' ? options.fillColor ?? '#161616' : '#000000'
    context.fillRect(0, 0, targetSize.width, targetSize.height)
  }

  const containRect = getContainRect(source, targetSize)
  const foregroundCanvas = createCanvas(containRect.width, containRect.height)
  await getPica().resize(source.image, foregroundCanvas)
  context.drawImage(foregroundCanvas, containRect.x, containRect.y, containRect.width, containRect.height)

  const mimeType = getOutputMimeType(options.exportFormat)
  const blob = await canvasToBlob(
    canvas,
    mimeType,
    options.exportFormat === 'jpeg' ? clampJpegQuality(options.jpegQuality) : undefined,
  )

  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    width: targetSize.width,
    height: targetSize.height,
    mimeType,
    fileName: getExportFileName(options.exportFormat, targetSize),
  }
}
