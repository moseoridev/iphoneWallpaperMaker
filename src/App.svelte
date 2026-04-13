<svelte:head>
  <title>오프라인 배경화면 메이커</title>
</svelte:head>

<script lang="ts">
  import { onDestroy } from 'svelte'

  import { downloadResult } from '$lib/wallpaper/download'
  import {
    decodeSourceImage,
    readImageSize,
    renderWallpaper,
    resolveTargetSize,
  } from '$lib/wallpaper/image'
  import {
    MAX_TARGET_DIMENSION,
    getTargetSizeError,
    hasPartialManualTarget,
    parseManualTargetSize,
  } from '$lib/wallpaper/geometry'
  import type { FillMode, ExportFormat, ProcessResult, TargetSize } from '$lib/wallpaper/types'

  const iconUrl = `${import.meta.env.BASE_URL}icon.svg`

  let sourceFile = $state<File | null>(null)
  let screenshotFile = $state<File | null>(null)
  let sourcePreviewUrl = $state<string | null>(null)
  let screenshotPreviewUrl = $state<string | null>(null)
  let detectedTarget = $state<TargetSize | null>(null)
  let manualWidth = $state<number | undefined>(undefined)
  let manualHeight = $state<number | undefined>(undefined)
  let fillMode = $state<FillMode>('blur')
  let fillColor = $state('#161616')
  let exportFormat = $state<ExportFormat>('jpeg')
  let jpegQuality = $state(92)
  let result = $state<ProcessResult | null>(null)
  let errorMessage = $state('')
  let statusMessage = $state('원본 사진을 넣고 목표 해상도를 정하면 바로 생성할 수 있습니다.')
  let isProcessing = $state(false)

  let hasManualTargetInput = $derived(hasPartialManualTarget(manualWidth, manualHeight))
  let manualTarget = $derived(parseManualTargetSize(manualWidth, manualHeight))
  let activeTarget = $derived(manualTarget ?? (hasManualTargetInput ? null : detectedTarget))
  let activeTargetError = $derived(activeTarget ? getTargetSizeError(activeTarget) : '')
  let canGenerate = $derived(Boolean(sourceFile && activeTarget && !activeTargetError && !isProcessing))
  let canDownload = $derived(Boolean(result && !isProcessing))

  function replacePreviewUrl(currentUrl: string | null, file: File | null) {
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl)
    }

    return file ? URL.createObjectURL(file) : null
  }

  function clearResult() {
    if (result) {
      URL.revokeObjectURL(result.previewUrl)
      result = null
    }
  }

  function markDirty() {
    clearResult()
    errorMessage = ''
  }

  function updateStatus(message: string) {
    statusMessage = message
  }

  function getSelectedFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    return input.files?.[0] ?? null
  }

  function formatTarget(target: TargetSize | null) {
    return target ? `${target.width} × ${target.height}px` : '아직 목표 해상도가 없습니다.'
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 102.4) / 10}KB`
    }

    return `${Math.round(bytes / 104857.6) / 10}MB`
  }

  function isInvalidManualTarget() {
    return hasManualTargetInput && !manualTarget
  }

  async function handleSourceChange(event: Event) {
    sourceFile = getSelectedFile(event)
    sourcePreviewUrl = replacePreviewUrl(sourcePreviewUrl, sourceFile)
    markDirty()
    updateStatus(sourceFile ? `${sourceFile.name}을(를) 불러왔습니다.` : '원본 사진을 선택하세요.')
  }

  async function handleScreenshotChange(event: Event) {
    screenshotFile = getSelectedFile(event)
    screenshotPreviewUrl = replacePreviewUrl(screenshotPreviewUrl, screenshotFile)
    detectedTarget = null
    markDirty()

    if (!screenshotFile) {
      updateStatus('스크린샷 없이도 수동 해상도만으로 생성할 수 있습니다.')
      return
    }

    try {
      const screenshotTarget = await readImageSize(screenshotFile)
      const targetError = getTargetSizeError(screenshotTarget)

      if (targetError) {
        throw new Error(targetError)
      }

      detectedTarget = screenshotTarget
      manualWidth = detectedTarget.width
      manualHeight = detectedTarget.height

      updateStatus(`스크린샷에서 ${formatTarget(detectedTarget)}를 읽었습니다.`)
    } catch (error) {
      screenshotFile = null
      screenshotPreviewUrl = replacePreviewUrl(screenshotPreviewUrl, null)
      errorMessage = error instanceof Error ? error.message : '스크린샷 해상도를 읽지 못했습니다.'
      updateStatus('스크린샷 없이 수동 해상도를 입력해도 됩니다.')
    }
  }

  async function generateWallpaper() {
    clearResult()
    errorMessage = ''

    if (!sourceFile) {
      errorMessage = '배경화면으로 만들 원본 사진을 먼저 선택하세요.'
      return
    }

    if (isInvalidManualTarget()) {
      errorMessage = '수동 해상도는 가로와 세로를 모두 양의 정수로 입력해야 합니다.'
      return
    }

    if (activeTargetError) {
      errorMessage = activeTargetError
      return
    }

    if (!manualTarget && !screenshotFile) {
      errorMessage = '목표 해상도를 입력하거나 스크린샷을 선택하세요.'
      return
    }

    isProcessing = true
    updateStatus('이미지를 생성하는 중입니다. 큰 사진은 잠시 걸릴 수 있습니다.')

    let decodedSource:
      | Awaited<ReturnType<typeof decodeSourceImage>>
      | null = null

    try {
      const targetSize = await resolveTargetSize(manualTarget, screenshotFile ?? undefined)
      decodedSource = await decodeSourceImage(sourceFile)

      result = await renderWallpaper(decodedSource, {
        targetSize,
        fillMode,
        fillColor: fillMode === 'color' ? fillColor : undefined,
        exportFormat,
        jpegQuality,
      })

      updateStatus(`완료: ${result.width} × ${result.height}px 결과가 준비됐습니다.`)
    } catch (error) {
      errorMessage =
        error instanceof Error
          ? error.message
          : '이미지를 생성하지 못했습니다. 다시 시도하세요.'
      updateStatus('생성에 실패했습니다.')
    } finally {
      decodedSource?.release()
      isProcessing = false
    }
  }

  function handleDownload() {
    if (!result) {
      return
    }

    downloadResult(result)
    updateStatus(`${result.fileName} 다운로드를 시작했습니다.`)
  }

  onDestroy(() => {
    if (sourcePreviewUrl) {
      URL.revokeObjectURL(sourcePreviewUrl)
    }

    if (screenshotPreviewUrl) {
      URL.revokeObjectURL(screenshotPreviewUrl)
    }

    clearResult()
  })
</script>

<main class="workspace">
  <header class="topbar">
    <div class="brand">
      <img class="brand-mark" src={iconUrl} alt="" />
      <div>
        <p>Wallpaper Maker</p>
        <span>Offline image tool</span>
      </div>
    </div>

    <div class="target-readout">
      <span>Target</span>
      <strong>{formatTarget(activeTarget)}</strong>
    </div>
  </header>

  <section class="intro" aria-labelledby="workspace-title">
    <div>
      <p class="eyebrow">Private canvas</p>
      <h1 id="workspace-title">사진 비율은 그대로, 화면 크기만 맞춥니다.</h1>
    </div>
    <p>
      원본과 스크린샷을 넣으면 이 기기 안에서 배경화면을 생성합니다.
    </p>
  </section>

  <div class="layout">
    <section class="tool-panel" aria-labelledby="input-title">
      <div class="panel-header">
        <p class="eyebrow">Source</p>
        <h2 id="input-title">입력</h2>
        <p>사진과 목표 해상도를 정하세요.</p>
      </div>

      <label class="field">
        <span>원본 사진</span>
        <input
          type="file"
          accept="image/*,.heic,.heif"
          aria-label="원본 사진"
          onchange={handleSourceChange}
        />
      </label>

      {#if sourceFile}
        <div class="file-meta">
          <strong>{sourceFile.name}</strong>
          <span>{formatBytes(sourceFile.size)}</span>
        </div>
      {/if}

      {#if sourcePreviewUrl}
        <div class="media-frame source-frame">
          <img src={sourcePreviewUrl} alt="선택한 원본 사진 미리보기" />
        </div>
      {:else}
        <div class="drop-visual" aria-hidden="true">
          <img src={iconUrl} alt="" />
          <span>Source image</span>
        </div>
      {/if}

      <label class="field">
        <span>해상도 확인용 스크린샷</span>
        <input
          type="file"
          accept="image/*"
          aria-label="해상도 확인용 스크린샷"
          onchange={handleScreenshotChange}
        />
      </label>

      {#if screenshotFile}
        <div class="file-meta">
          <strong>{screenshotFile.name}</strong>
          <span>{detectedTarget ? formatTarget(detectedTarget) : '해상도 확인 중'}</span>
        </div>
      {/if}

      <div class="dual-field">
        <label class="field">
          <span>가로 해상도</span>
          <input
            type="number"
            min="1"
            max={MAX_TARGET_DIMENSION}
            step="1"
            bind:value={manualWidth}
            aria-label="가로 해상도"
            oninput={markDirty}
          />
        </label>

        <label class="field">
          <span>세로 해상도</span>
          <input
            type="number"
            min="1"
            max={MAX_TARGET_DIMENSION}
            step="1"
            bind:value={manualHeight}
            aria-label="세로 해상도"
            oninput={markDirty}
          />
        </label>
      </div>

      <div class="status-note">
        <strong>현재 목표:</strong> {formatTarget(activeTarget)}
      </div>

      <div class="field-group">
        <span class="field-title">레터박스 배경</span>
        <div class="segmented">
          <label>
            <input
              type="radio"
              name="fill-mode"
              value="blur"
              bind:group={fillMode}
              onchange={markDirty}
            />
            <span>블러</span>
          </label>
          <label>
            <input
              type="radio"
              name="fill-mode"
              value="black"
              bind:group={fillMode}
              onchange={markDirty}
            />
            <span>검은색</span>
          </label>
          <label>
            <input
              type="radio"
              name="fill-mode"
              value="color"
              bind:group={fillMode}
              onchange={markDirty}
            />
            <span>단색</span>
          </label>
        </div>
      </div>

      {#if fillMode === 'color'}
        <label class="field color-field">
          <span>배경 색상</span>
          <input type="color" bind:value={fillColor} aria-label="배경 색상" onchange={markDirty} />
        </label>
      {/if}

      <div class="field-group">
        <span class="field-title">출력 포맷</span>
        <div class="segmented">
          <label>
            <input
              type="radio"
              name="export-format"
              value="jpeg"
              bind:group={exportFormat}
              onchange={markDirty}
            />
            <span>JPEG</span>
          </label>
          <label>
            <input
              type="radio"
              name="export-format"
              value="png"
              bind:group={exportFormat}
              onchange={markDirty}
            />
            <span>PNG</span>
          </label>
        </div>
      </div>

      {#if exportFormat === 'jpeg'}
        <label class="field">
          <span>JPEG 품질 {jpegQuality}%</span>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            bind:value={jpegQuality}
            aria-label="JPEG 품질"
            oninput={markDirty}
          />
        </label>
      {/if}

      <button class="primary" type="button" onclick={generateWallpaper} disabled={!canGenerate}>
        {isProcessing ? '생성 중…' : '생성'}
      </button>
    </section>

    <section class="result-panel" aria-labelledby="result-title">
      <div class="panel-header">
        <p class="eyebrow">Output</p>
        <h2 id="result-title">결과</h2>
        <p>남는 공간만 레터박스로 채워집니다.</p>
      </div>

      <div class="status-stack" aria-live="polite">
        <p class="status">{statusMessage}</p>
        {#if errorMessage}
          <p class="error">{errorMessage}</p>
        {/if}
      </div>

      {#if result}
        <div class="media-frame result-card">
          <img src={result.previewUrl} alt="생성된 배경화면 미리보기" />
        </div>

        <div class="result-meta">
          <strong>{result.width} × {result.height}px</strong>
          <span>{result.mimeType === 'image/jpeg' ? 'JPEG' : 'PNG'}</span>
          <span>{formatBytes(result.blob.size)}</span>
        </div>
      {:else}
        <div class="empty-state">
          <img src={iconUrl} alt="" />
          <p>아직 생성된 이미지가 없습니다.</p>
          <span>원본 사진과 목표 해상도를 준비한 뒤 생성하세요.</span>
        </div>
      {/if}

      <button class="download-action" type="button" onclick={handleDownload} disabled={!canDownload}>
        다운로드
      </button>
    </section>
  </div>

  <div class="hint-list">
    <p>iOS Safari에서는 다운로드 후 사진 앱에 저장해 배경화면으로 지정하세요.</p>
    <p>HEIC 변환이 실패하면 사진 앱이나 파일 앱에서 JPEG/PNG로 내보낸 뒤 다시 시도하세요.</p>
    <p>설치 후에는 네트워크 없이도 앱을 다시 열 수 있습니다.</p>
  </div>
</main>
