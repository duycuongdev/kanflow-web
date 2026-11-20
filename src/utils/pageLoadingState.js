import { useLayoutEffect, useEffect, useId } from 'react'

// Quản lý danh sách ID các loader đang hoạt động bằng Set để ngăn ngừa tuyệt đối rò rỉ trạng thái (state leak)
const activeLoaders = new Set()
const listeners = new Set()
let falseNotifyTimer = null

const notify = () => {
  const hasActiveLoaders = activeLoaders.size > 0

  if (hasActiveLoaders) {
    // Có ít nhất 1 loader đang chạy: hủy bỏ timer kết thúc (nếu có) và báo ngay là đang loading
    if (falseNotifyTimer) {
      clearTimeout(falseNotifyTimer)
      falseNotifyTimer = null
    }
    listeners.forEach((listener) => listener(true))
  } else {
    // Không còn loader nào active: trì hoãn thông báo false 80ms để chuyển cảnh mượt mà giữa các trang,
    // tránh hiện tượng chớp nháy khi component Suspense unmount và component trang con mount
    if (falseNotifyTimer) {
      clearTimeout(falseNotifyTimer)
    }
    falseNotifyTimer = setTimeout(() => {
      falseNotifyTimer = null
      if (activeLoaders.size === 0) {
        listeners.forEach((listener) => listener(false))
      }
    }, 80)
  }
}

export const registerLoader = (id) => {
  activeLoaders.add(id)
  notify()
}

export const unregisterLoader = (id) => {
  activeLoaders.delete(id)
  notify()
}

export const getPageLoading = () => activeLoaders.size > 0

export const subscribePageLoading = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Hook đánh dấu component đang trong trạng thái loading toàn trang (full-page loading).
 * Dùng Set với id duy nhất để đảm bảo mỗi instance chỉ được đăng ký một lần và hủy đúng một lần.
 */
export const usePageLoadingSignal = () => {
  const id = useId()
  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

  useIsomorphicLayoutEffect(() => {
    registerLoader(id)
    return () => {
      unregisterLoader(id)
    }
  }, [id])
}
