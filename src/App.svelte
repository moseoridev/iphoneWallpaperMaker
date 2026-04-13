<svelte:head>
  <title>오프라인 배경화면 메이커</title>
</svelte:head>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte'

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
  const logoUrl = `${import.meta.env.BASE_URL}logo.svg`
  const githubUserUrl = 'https://github.com/moseoridev'
  const githubRepoUrl = 'https://github.com/moseoridev/iphoneWallpaperMaker'

  let sourceFile = $state<File | null>(null)
  let screenshotFile = $state<File | null>(null)
  let sourcePreviewUrl = $state<string | null>(null)
  let screenshotPreviewUrl = $state<string | null>(null)
  let detectedTarget = $state<TargetSize | null>(null)
  let manualWidth = $state<number | undefined>(undefined)
  let manualHeight = $state<number | undefined>(undefined)
  let fillMode = $state<FillMode>('blur')
  let fillColor = $state('#161616')
  let exportFormat = $state<ExportFormat>('png')
  let jpegQuality = $state(92)
  let result = $state<ProcessResult | null>(null)
  let errorMessage = $state('')
  let statusMessage = $state('원본 사진을 넣고 목표 해상도를 정하면 바로 생성할 수 있습니다.')
  let isProcessing = $state(false)

  type Theme = 'system' | 'light' | 'dark'
  let theme = $state<Theme>('system')


  function applyTheme(t: Theme) {
    const root = document.documentElement
    if (t === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', t)
    }
    localStorage.setItem('theme', t)
  }

  function cycleTheme() {
    const order: Theme[] = ['system', 'light', 'dark']
    const next = order[(order.indexOf(theme) + 1) % order.length]
    theme = next
    applyTheme(theme)
  }

  function getThemeIcon(t: Theme): string {
    if (t === 'system') return '🖥️'
    if (t === 'light') return '☀️'
    return '🌙'
  }

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

  onMount(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved && ['system', 'light', 'dark'].includes(saved)) {
      theme = saved
    }
    applyTheme(theme)

    if (typeof window.matchMedia !== 'function') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }
    mq.addEventListener('change', handler)

    return () => mq.removeEventListener('change', handler)
  })

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

<main class="layout-container">
  <header class="topbar">
    <div class="logo-group">
      <img class="logo-icon" src={logoUrl} alt="Logo" />
      <span class="text-micro" style="color: var(--nav-text);">Wallpaper Maker</span>
    </div>
    <div style="display: flex; align-items: center; gap: 11px;">
      <span class="text-micro" style="color: var(--nav-text);">{formatTarget(activeTarget)}</span>
      <button
        type="button"
        class="theme-toggle"
        onclick={cycleTheme}
        aria-label="테마 전환"
        title={theme === 'system' ? '시스템' : theme === 'light' ? '라이트' : '다크'}
      >
        {getThemeIcon(theme)}
      </button>
    </div>
  </header>

  <div class="workspace-grid animate-fade-in">
    <section class="panel" aria-labelledby="input-title">
      <div class="panel-header">
        <span class="text-micro color-tertiary" style="text-transform: uppercase;">Source</span>
        <h2 id="input-title" class="text-h2 color-primary">입력</h2>
      </div>

      <div class="input-group">
        <span class="input-label">원본 사진</span>
        <input
          type="file"
          class="input-field"
          accept="image/*,.heic,.heif"
          aria-label="원본 사진"
          onchange={handleSourceChange}
        />
      </div>

      {#if sourceFile}
        <div style="display: flex; gap: 8px; align-items: baseline;">
          <strong class="text-caption-large color-primary">{sourceFile.name}</strong>
          <span class="text-caption color-tertiary">{formatBytes(sourceFile.size)}</span>
        </div>
      {/if}

      <div class="media-preview-container">
        {#if sourcePreviewUrl}
          <img src={sourcePreviewUrl} alt="선택한 원본 사진 미리보기" />
        {:else}
          <div class="empty-state-box">
            <img src={iconUrl} class="empty-state-icon" alt="" />
            <span class="text-caption color-tertiary">Source image</span>
          </div>
        {/if}
      </div>

      <div class="input-group">
        <span class="input-label">해상도 확인용 스크린샷</span>
        <input
          type="file"
          class="input-field"
          accept="image/*"
          aria-label="해상도 확인용 스크린샷"
          onchange={handleScreenshotChange}
        />
      </div>

      {#if screenshotFile}
        <div style="display: flex; gap: 8px; align-items: baseline;">
          <strong class="text-caption-large color-primary">{screenshotFile.name}</strong>
          <span class="text-caption color-tertiary">{detectedTarget ? formatTarget(detectedTarget) : '해상도 확인 중'}</span>
        </div>
      {/if}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div class="input-group">
          <span class="input-label">가로 해상도</span>
          <input
            type="number"
            class="input-field"
            min="1"
            max={MAX_TARGET_DIMENSION}
            step="1"
            bind:value={manualWidth}
            aria-label="가로 해상도"
            oninput={markDirty}
          />
        </div>
        <div class="input-group">
          <span class="input-label">세로 해상도</span>
          <input
            type="number"
            class="input-field"
            min="1"
            max={MAX_TARGET_DIMENSION}
            step="1"
            bind:value={manualHeight}
            aria-label="세로 해상도"
            oninput={markDirty}
          />
        </div>
      </div>

      <div>
        <span class="text-caption color-primary"><strong>현재 목표:</strong> {formatTarget(activeTarget)}</span>
      </div>

      <div class="input-group">
        <span class="input-label">레터박스 배경</span>
        <div class="segmented-control">
          <label>
            <input type="radio" value="blur" bind:group={fillMode} onchange={markDirty} />
            <span>블러</span>
          </label>
          <label>
            <input type="radio" value="black" bind:group={fillMode} onchange={markDirty} />
            <span>검은색</span>
          </label>
          <label>
            <input type="radio" value="color" bind:group={fillMode} onchange={markDirty} />
            <span>단색</span>
          </label>
        </div>
      </div>

      {#if fillMode === 'color'}
        <div class="input-group">
          <span class="input-label">배경 색상</span>
          <input 
            type="color" 
            class="input-field" 
            style="padding: 2px; height: 44px;" 
            bind:value={fillColor} 
            aria-label="배경 색상" 
            onchange={markDirty} 
          />
        </div>
      {/if}

      <div class="input-group">
        <span class="input-label">출력 포맷</span>
        <div class="segmented-control">
          <label>
            <input type="radio" value="jpeg" bind:group={exportFormat} onchange={markDirty} />
            <span>JPEG</span>
          </label>
          <label>
            <input type="radio" value="png" bind:group={exportFormat} onchange={markDirty} />
            <span>PNG</span>
          </label>
        </div>
      </div>

      {#if exportFormat === 'jpeg'}
        <div class="input-group">
          <span class="input-label" style="display: flex; justify-content: space-between;">
            <span>JPEG 품질</span>
            <span>{jpegQuality}%</span>
          </span>
          <input 
            type="range" 
            min="1" 
            max="100" 
            step="1" 
            bind:value={jpegQuality} 
            aria-label="JPEG 품질" 
            oninput={markDirty} 
          />
        </div>
      {/if}

      <button class="btn btn-primary" style="width: 100%;" type="button" onclick={generateWallpaper} disabled={!canGenerate}>
        {isProcessing ? '생성 중…' : '생성'}
      </button>
    </section>

    <!-- Result Panel -->
    <section class="panel" aria-labelledby="result-title">
      <div class="panel-header">
        <span class="text-micro color-tertiary" style="text-transform: uppercase;">Output</span>
        <h2 id="result-title" class="text-h2 color-primary">결과</h2>
      </div>

      <div class="status-stack" aria-live="polite" style="display: flex; flex-direction: column; gap: 8px;">
        <div class="status-pill status-normal">{statusMessage}</div>
        {#if errorMessage}
          <div class="status-pill status-error">{errorMessage}</div>
        {/if}
      </div>

      <div class="media-preview-container" style="flex: 1; min-height: 480px; display: flex; flex-direction: column;">
        {#if result}
          <img src={result.previewUrl} alt="생성된 배경화면 미리보기" style="margin: auto;" />
        {:else}
          <div class="empty-state-box" style="flex: 1;">
            <img src={iconUrl} class="empty-state-icon" alt="" />
            <p class="text-body color-secondary" style="margin-top: 11px;">아직 생성된 이미지가 없습니다.</p>
            <span class="text-caption color-tertiary">원본 사진과 목표 해상도를 준비한 뒤 생성하세요.</span>
          </div>
        {/if}
      </div>

      {#if result}
        <div style="display: flex; gap: 11px; align-items: baseline; justify-content: center;">
          <strong class="text-label color-primary">{result.width} × {result.height}px</strong>
          <span class="pill-neutral">{result.mimeType === 'image/jpeg' ? 'JPEG' : 'PNG'}</span>
          <span class="pill-neutral">{formatBytes(result.blob.size)}</span>
        </div>
      {/if}

      <button class="btn btn-ghost" style="width: 100%;" type="button" onclick={handleDownload} disabled={!canDownload}>
        다운로드
      </button>
    </section>
  </div>

  <footer class="app-footer">
    <span>made by</span>
    <a href={githubUserUrl} target="_blank" rel="noopener noreferrer">moseoridev</a>
    <span>with ❤️</span>
    <a href={githubRepoUrl} target="_blank" rel="noopener noreferrer">
      github.com/moseoridev/iphoneWallpaperMaker
    </a>
  </footer>
</main>
