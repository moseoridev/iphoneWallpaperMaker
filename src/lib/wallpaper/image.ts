import type { DrawRect } from './geometry'
import { assertSupportedTargetSize, getContainRect } from './geometry'
import type {
  ExportFormat,
  LoadedImageSource,
  ProcessOptions,
  ProcessResult,
  TargetSize,
} from './types'

type PicaModule = typeof import('pica')
type StackblurModule = typeof import('@kayahr/stackblur')
type PicaInstance = ReturnType<PicaModule['default']>
type BlurImageData = StackblurModule['blurImageData']

let picaInstancePromise: Promise<PicaInstance> | null = null
let stackblurModulePromise: Promise<StackblurModule> | null = null

interface RgbColor {
  r: number
  g: number
  b: number
}

type LetterboxAxis = 'horizontal' | 'vertical' | 'none'

async function getPica() {
  picaInstancePromise ??= import('pica').then(({ default: picaFactory }) => picaFactory())
  return picaInstancePromise
}

async function getStackblur() {
  stackblurModulePromise ??= import('@kayahr/stackblur')
  return stackblurModulePromise
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

function getEdgeSampleSize(source: TargetSize) {
  return Math.min(120, Math.max(24, Math.round(Math.min(source.width, source.height) * 0.12)))
}

function getEdgeBlurRadius(gap: number) {
  return Math.min(36, Math.max(8, Math.round(gap / 5)))
}

function getOutputMimeType(format: ExportFormat) {
  return format === 'png' ? 'image/png' : 'image/jpeg'
}

function getOutputFileExtension(format: ExportFormat) {
  return format === 'png' ? 'png' : 'jpg'
}

export function getLetterboxAxis(containRect: DrawRect, targetSize: TargetSize): LetterboxAxis {
  const verticalGap = containRect.y + (targetSize.height - containRect.y - containRect.height)
  const horizontalGap = containRect.x + (targetSize.width - containRect.x - containRect.width)

  if (verticalGap <= 0 && horizontalGap <= 0) {
    return 'none'
  }

  return verticalGap >= horizontalGap ? 'vertical' : 'horizontal'
}

export function getAverageColor(data: Uint8ClampedArray): RgbColor {
  let red = 0
  let green = 0
  let blue = 0
  let weight = 0

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255

    if (alpha <= 0) {
      continue
    }

    red += data[index] * alpha
    green += data[index + 1] * alpha
    blue += data[index + 2] * alpha
    weight += alpha
  }

  if (!weight) {
    return { r: 22, g: 22, b: 22 }
  }

  return {
    r: Math.round(red / weight),
    g: Math.round(green / weight),
    b: Math.round(blue / weight),
  }
}

function toRgb(color: RgbColor) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`
}

function mixColors(start: RgbColor, end: RgbColor, amount: number): RgbColor {
  const weight = Math.min(1, Math.max(0, amount))

  return {
    r: Math.round(start.r + (end.r - start.r) * weight),
    g: Math.round(start.g + (end.g - start.g) * weight),
    b: Math.round(start.b + (end.b - start.b) * weight),
  }
}

function getAverageCanvasRegionColor(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  return getAverageColor(context.getImageData(x, y, width, height).data)
}

function blurRegion(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  blurImageData: BlurImageData,
) {
  if (width <= 0 || height <= 0) {
    return
  }

  const imageData = context.getImageData(x, y, width, height)
  blurImageData(imageData, radius, false)
  context.putImageData(imageData, x, y)
}

function renderVerticalEdgeBlend(
  sourceCanvas: HTMLCanvasElement,
  containRect: DrawRect,
  targetSize: TargetSize,
  context: CanvasRenderingContext2D,
  blurImageData: BlurImageData,
) {
  const topGap = containRect.y
  const bottomGap = targetSize.height - containRect.y - containRect.height
  const sourceContext = getContext(sourceCanvas)
  const sampleSize = Math.min(sourceCanvas.height, getEdgeSampleSize(sourceCanvas))
  const innerOffset = Math.max(0, Math.min(sourceCanvas.height - sampleSize, Math.round(sampleSize * 1.25)))
  const topOuterColor = getAverageCanvasRegionColor(sourceContext, 0, 0, sourceCanvas.width, sampleSize)
  const topInnerColor = getAverageCanvasRegionColor(
    sourceContext,
    0,
    innerOffset,
    sourceCanvas.width,
    sampleSize,
  )
  const bottomOuterColor = getAverageCanvasRegionColor(
    sourceContext,
    0,
    sourceCanvas.height - sampleSize,
    sourceCanvas.width,
    sampleSize,
  )
  const bottomInnerColor = getAverageCanvasRegionColor(
    sourceContext,
    0,
    Math.max(0, sourceCanvas.height - sampleSize - innerOffset),
    sourceCanvas.width,
    sampleSize,
  )
  const middleGradient = context.createLinearGradient(0, 0, 0, targetSize.height)

  middleGradient.addColorStop(0, toRgb(mixColors(topOuterColor, topInnerColor, 0.72)))
  middleGradient.addColorStop(1, toRgb(mixColors(bottomOuterColor, bottomInnerColor, 0.72)))
  context.fillStyle = middleGradient
  context.fillRect(0, 0, targetSize.width, targetSize.height)

  if (topGap > 0) {
    const topGradient = context.createLinearGradient(0, 0, 0, topGap)

    topGradient.addColorStop(0, toRgb(topOuterColor))
    topGradient.addColorStop(1, toRgb(mixColors(topOuterColor, topInnerColor, 0.84)))
    context.fillStyle = topGradient
    context.fillRect(0, 0, targetSize.width, topGap)
    blurRegion(context, 0, 0, targetSize.width, topGap, getEdgeBlurRadius(topGap), blurImageData)
  }

  if (bottomGap > 0) {
    const bottomGradient = context.createLinearGradient(
      0,
      targetSize.height - bottomGap,
      0,
      targetSize.height,
    )

    bottomGradient.addColorStop(0, toRgb(mixColors(bottomOuterColor, bottomInnerColor, 0.84)))
    bottomGradient.addColorStop(1, toRgb(bottomOuterColor))
    context.fillStyle = bottomGradient
    context.fillRect(0, targetSize.height - bottomGap, targetSize.width, bottomGap)
    blurRegion(
      context,
      0,
      targetSize.height - bottomGap,
      targetSize.width,
      bottomGap,
      getEdgeBlurRadius(bottomGap),
      blurImageData,
    )
  }
}

function renderHorizontalEdgeBlend(
  sourceCanvas: HTMLCanvasElement,
  containRect: DrawRect,
  targetSize: TargetSize,
  context: CanvasRenderingContext2D,
  blurImageData: BlurImageData,
) {
  const leftGap = containRect.x
  const rightGap = targetSize.width - containRect.x - containRect.width
  const sourceContext = getContext(sourceCanvas)
  const sampleSize = Math.min(sourceCanvas.width, getEdgeSampleSize(sourceCanvas))
  const innerOffset = Math.max(0, Math.min(sourceCanvas.width - sampleSize, Math.round(sampleSize * 1.25)))
  const leftOuterColor = getAverageCanvasRegionColor(sourceContext, 0, 0, sampleSize, sourceCanvas.height)
  const leftInnerColor = getAverageCanvasRegionColor(
    sourceContext,
    innerOffset,
    0,
    sampleSize,
    sourceCanvas.height,
  )
  const rightOuterColor = getAverageCanvasRegionColor(
    sourceContext,
    sourceCanvas.width - sampleSize,
    0,
    sampleSize,
    sourceCanvas.height,
  )
  const rightInnerColor = getAverageCanvasRegionColor(
    sourceContext,
    Math.max(0, sourceCanvas.width - sampleSize - innerOffset),
    0,
    sampleSize,
    sourceCanvas.height,
  )
  const middleGradient = context.createLinearGradient(0, 0, targetSize.width, 0)

  middleGradient.addColorStop(0, toRgb(mixColors(leftOuterColor, leftInnerColor, 0.72)))
  middleGradient.addColorStop(1, toRgb(mixColors(rightOuterColor, rightInnerColor, 0.72)))
  context.fillStyle = middleGradient
  context.fillRect(0, 0, targetSize.width, targetSize.height)

  if (leftGap > 0) {
    const leftGradient = context.createLinearGradient(0, 0, leftGap, 0)

    leftGradient.addColorStop(0, toRgb(leftOuterColor))
    leftGradient.addColorStop(1, toRgb(mixColors(leftOuterColor, leftInnerColor, 0.84)))
    context.fillStyle = leftGradient
    context.fillRect(0, 0, leftGap, targetSize.height)
    blurRegion(context, 0, 0, leftGap, targetSize.height, getEdgeBlurRadius(leftGap), blurImageData)
  }

  if (rightGap > 0) {
    const rightGradient = context.createLinearGradient(
      targetSize.width - rightGap,
      0,
      targetSize.width,
      0,
    )

    rightGradient.addColorStop(0, toRgb(mixColors(rightOuterColor, rightInnerColor, 0.84)))
    rightGradient.addColorStop(1, toRgb(rightOuterColor))
    context.fillStyle = rightGradient
    context.fillRect(targetSize.width - rightGap, 0, rightGap, targetSize.height)
    blurRegion(
      context,
      targetSize.width - rightGap,
      0,
      rightGap,
      targetSize.height,
      getEdgeBlurRadius(rightGap),
      blurImageData,
    )
  }
}

function renderBlurBackground(
  sourceCanvas: HTMLCanvasElement,
  containRect: DrawRect,
  targetSize: TargetSize,
  context: CanvasRenderingContext2D,
  blurImageData: BlurImageData,
) {
  const axis = getLetterboxAxis(containRect, targetSize)

  if (axis === 'vertical') {
    renderVerticalEdgeBlend(sourceCanvas, containRect, targetSize, context, blurImageData)
    return
  }

  if (axis === 'horizontal') {
    renderHorizontalEdgeBlend(sourceCanvas, containRect, targetSize, context, blurImageData)
    return
  }

  context.fillStyle = '#161616'
  context.fillRect(0, 0, targetSize.width, targetSize.height)
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
    assertSupportedTargetSize(manualSize)
    return manualSize
  }

  if (screenshotFile) {
    const targetSize = await readImageSize(screenshotFile)
    assertSupportedTargetSize(targetSize)
    return targetSize
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
  assertSupportedTargetSize(targetSize)

  const canvas = createCanvas(targetSize.width, targetSize.height)
  const context = getContext(canvas)
  const containRect = getContainRect(source, targetSize)
  const foregroundCanvas = createCanvas(containRect.width, containRect.height)
  const pica = await getPica()
  await pica.resize(source.image, foregroundCanvas)

  if (options.fillMode === 'blur') {
    const { blurImageData } = await getStackblur()
    renderBlurBackground(foregroundCanvas, containRect, targetSize, context, blurImageData)
  } else {
    context.fillStyle = options.fillMode === 'color' ? options.fillColor ?? '#161616' : '#000000'
    context.fillRect(0, 0, targetSize.width, targetSize.height)
  }

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
