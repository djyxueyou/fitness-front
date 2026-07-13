import { nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PAGE_TRANSITION_SETTLE_MS,
  VIDEO_LOADING_LABEL_DELAY_MS,
  useVideoPlaybackCover
} from '@/utils/video-playback-cover'

describe('video playback cover', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('mounts the native video only after the page and cover are ready', () => {
    vi.useFakeTimers()
    const source = ref('https://cdn.example.com/demo.mp4')
    const cover = ref('https://cdn.example.com/demo.jpg')
    const playback = useVideoPlaybackCover(source, cover)

    expect(PAGE_TRANSITION_SETTLE_MS).toBe(300)
    expect(playback.videoMounted.value).toBe(false)
    playback.handleCoverLoad()
    playback.handlePageReady()

    vi.advanceTimersByTime(PAGE_TRANSITION_SETTLE_MS - 1)
    expect(playback.videoMounted.value).toBe(false)

    vi.advanceTimersByTime(1)
    expect(playback.videoMounted.value).toBe(true)
  })

  it('keeps the video unmounted after the transition until the cover resolves', () => {
    vi.useFakeTimers()
    const source = ref('https://cdn.example.com/demo.mp4')
    const cover = ref('https://cdn.example.com/demo.jpg')
    const playback = useVideoPlaybackCover(source, cover)

    playback.handlePageReady()
    vi.advanceTimersByTime(PAGE_TRANSITION_SETTLE_MS)

    expect(playback.videoMounted.value).toBe(false)
    playback.handleCoverLoad()
    expect(playback.videoMounted.value).toBe(true)
  })

  it('mounts after the transition when no cover is available', () => {
    vi.useFakeTimers()
    const source = ref('https://cdn.example.com/demo.mp4')
    const cover = ref('')
    const playback = useVideoPlaybackCover(source, cover)

    playback.handlePageReady()
    vi.advanceTimersByTime(PAGE_TRANSITION_SETTLE_MS)

    expect(playback.videoMounted.value).toBe(true)
  })

  it('starts the delayed loading label only after mounting the video', () => {
    vi.useFakeTimers()
    const source = ref('https://cdn.example.com/demo.mp4')
    const cover = ref('https://cdn.example.com/demo.jpg')
    const playback = useVideoPlaybackCover(source, cover)

    expect(VIDEO_LOADING_LABEL_DELAY_MS).toBe(800)
    playback.handlePageReady()
    vi.advanceTimersByTime(PAGE_TRANSITION_SETTLE_MS + VIDEO_LOADING_LABEL_DELAY_MS)
    expect(playback.loadingVisible.value).toBe(false)

    playback.handleCoverLoad()
    vi.advanceTimersByTime(VIDEO_LOADING_LABEL_DELAY_MS - 1)
    expect(playback.loadingVisible.value).toBe(false)

    vi.advanceTimersByTime(1)
    expect(playback.loadingVisible.value).toBe(true)
  })

  it('cancels the loading label when video becomes ready quickly', () => {
    vi.useFakeTimers()
    const source = ref('https://cdn.example.com/demo.mp4')
    const cover = ref('')
    const playback = useVideoPlaybackCover(source, cover)

    playback.handlePageReady()
    vi.advanceTimersByTime(PAGE_TRANSITION_SETTLE_MS)
    playback.handleTimeUpdate({ detail: { currentTime: 0.25 } })
    vi.advanceTimersByTime(VIDEO_LOADING_LABEL_DELAY_MS)

    expect(playback.videoReady.value).toBe(true)
    expect(playback.loadingVisible.value).toBe(false)
  })

  it('releases the cover as soon as playback time advances', () => {
    vi.useFakeTimers()
    const source = ref('https://cdn.example.com/demo.mp4')
    const cover = ref('')
    const playback = useVideoPlaybackCover(source, cover)

    playback.handleTimeUpdate({ detail: { currentTime: 0.25 } })

    expect(playback.videoReady.value).toBe(true)
  })

  it('resets readiness when the video source changes', async () => {
    vi.useFakeTimers()
    const source = ref('https://cdn.example.com/first.mp4')
    const cover = ref('')
    const playback = useVideoPlaybackCover(source, cover)

    playback.handlePageReady()
    vi.advanceTimersByTime(PAGE_TRANSITION_SETTLE_MS)
    playback.handleTimeUpdate({ detail: { currentTime: 0.25 } })
    source.value = 'https://cdn.example.com/second.mp4'
    await nextTick()
    vi.runAllTimers()

    expect(playback.videoReady.value).toBe(false)
    expect(playback.videoFailed.value).toBe(false)
  })

  it('keeps the cover visible when playback fails', () => {
    vi.useFakeTimers()
    const source = ref('https://cdn.example.com/demo.mp4')
    const cover = ref('')
    const playback = useVideoPlaybackCover(source, cover)

    playback.handlePageReady()
    vi.advanceTimersByTime(PAGE_TRANSITION_SETTLE_MS)
    playback.handleTimeUpdate({ detail: { currentTime: 0.25 } })
    playback.handleError()
    vi.runAllTimers()

    expect(playback.videoReady.value).toBe(false)
    expect(playback.videoFailed.value).toBe(true)
    expect(playback.loadingVisible.value).toBe(true)
  })
})
