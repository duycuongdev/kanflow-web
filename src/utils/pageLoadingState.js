import { useLayoutEffect, useEffect } from 'react'

let loadingCount = 0
let debounceTimer = null
const listeners = new Set()

const notify = () => {
  const isLoading = loadingCount > 0
  listeners.forEach((listener) => listener(isLoading))
}

export const incrementPageLoading = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  loadingCount++
  notify()
}

export const decrementPageLoading = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  // Giữ trạng thái loading thêm 150ms để chuyển cảnh mượt mà giữa các route, tránh chớp nháy
  debounceTimer = setTimeout(() => {
    loadingCount = Math.max(0, loadingCount - 1)
    debounceTimer = null
    notify()
  }, 150)
}

export const getPageLoading = () => loadingCount > 0

export const subscribePageLoading = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Hook đánh dấu component đang trong trạng thái loading toàn trang (full-page loading).
 * Dùng useLayoutEffect để cập nhật trạng thái đồng bộ trước khi trình duyệt vẽ (paint),
 * ngăn chặn hoàn toàn hiện tượng FAB hoặc widget bị chớp nháy trong 1 khung hình.
 */
export const usePageLoadingSignal = () => {
  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

  useIsomorphicLayoutEffect(() => {
    incrementPageLoading()
    return () => {
      decrementPageLoading()
    }
  }, [])
}
