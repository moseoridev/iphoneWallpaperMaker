declare module 'pica' {
  interface PicaResizeOptions {
    quality?: number
    filter?: string
    unsharpAmount?: number
    unsharpRadius?: number
    unsharpThreshold?: number
    cancelToken?: Promise<unknown>
  }

  interface PicaInstance {
    resize(
      from: CanvasImageSource | HTMLImageElement,
      to: HTMLCanvasElement,
      options?: PicaResizeOptions,
    ): Promise<HTMLCanvasElement>
  }

  export default function pica(config?: unknown): PicaInstance
}
