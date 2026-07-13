import { getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue'

export const VIDEO_LOADING_LABEL_DELAY_MS = 800
export const PAGE_TRANSITION_SETTLE_MS = 300

interface VideoTimeUpdateEvent {
  detail?: {
    currentTime?: number
  }
}

export function useVideoPlaybackCover(
  source: Readonly<Ref<string>>,
  coverSource: Readonly<Ref<string>>
) {
  const videoMounted = ref(false)
  const videoReady = ref(false)
  const videoFailed = ref(false)
  const loadingVisible = ref(false)
  let pageSettled = false
  let coverResolved = !coverSource.value
  let transitionTimer: ReturnType<typeof setTimeout> | null = null
  let loadingTimer: ReturnType<typeof setTimeout> | null = null

  function clearTransitionTimer() {
    if (transitionTimer === null) return
    clearTimeout(transitionTimer)
    transitionTimer = null
  }

  function clearLoadingTimer() {
    if (loadingTimer === null) return
    clearTimeout(loadingTimer)
    loadingTimer = null
  }

  function startLoadingTimer() {
    clearLoadingTimer()
    loadingTimer = setTimeout(() => {
      loadingTimer = null
      if (!videoReady.value && !videoFailed.value) loadingVisible.value = true
    }, VIDEO_LOADING_LABEL_DELAY_MS)
  }

  function tryMountVideo() {
    if (videoMounted.value || !source.value || !pageSettled || !coverResolved) return
    videoMounted.value = true
    startLoadingTimer()
  }

  function reset(preserveResolvedCover = false) {
    clearLoadingTimer()
    videoMounted.value = false
    videoReady.value = false
    videoFailed.value = false
    loadingVisible.value = false
    coverResolved = !coverSource.value || (preserveResolvedCover && coverResolved)
    tryMountVideo()
  }

  function handlePageReady() {
    clearTransitionTimer()
    transitionTimer = setTimeout(() => {
      transitionTimer = null
      pageSettled = true
      tryMountVideo()
    }, PAGE_TRANSITION_SETTLE_MS)
  }

  function handleCoverLoad() {
    coverResolved = true
    tryMountVideo()
  }

  function handleCoverError() {
    coverResolved = true
    tryMountVideo()
  }

  function handleTimeUpdate(event: Event | VideoTimeUpdateEvent) {
    if (videoReady.value || videoFailed.value) return
    const detail = (event as VideoTimeUpdateEvent).detail
    const currentTime = Number(detail?.currentTime || 0)
    if (currentTime <= 0) return
    videoReady.value = true
    loadingVisible.value = false
    clearLoadingTimer()
  }

  function handleError() {
    clearLoadingTimer()
    videoReady.value = false
    videoFailed.value = true
    loadingVisible.value = true
  }

  watch([source, coverSource], ([, nextCover], [, previousCover]) => {
    reset(nextCover === previousCover)
  })
  reset()
  if (getCurrentScope()) {
    onScopeDispose(() => {
      clearTransitionTimer()
      clearLoadingTimer()
    })
  }

  return {
    videoMounted,
    videoReady,
    videoFailed,
    loadingVisible,
    handlePageReady,
    handleCoverLoad,
    handleCoverError,
    handleTimeUpdate,
    handleError
  }
}
