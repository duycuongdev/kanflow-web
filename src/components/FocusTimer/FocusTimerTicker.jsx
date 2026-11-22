import { useState, useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { selectCurrentUser } from '~/redux/user/userSlice'
import { selectFocusTimerState, hydrateTimerState, completeFocusSession } from '~/redux/focusTimer/focusTimerSlice'

/**
 * Bộ não toàn cục của Focus Timer (mount 1 lần ở App, không render gì ra DOM):
 * - Hydrate trạng thái từ localStorage khi mount / đổi user + persist trở lại mỗi khi đổi
 * - Tick 500ms, phát hiện timer hết giờ và dispatch completeFocusSession
 *   (log phiên + orchestration chuỗi lặp trong slice)
 */
export default function FocusTimerTicker() {
  const dispatch = useDispatch()
  const currentUser = useSelector(selectCurrentUser)
  const timerState = useSelector(selectFocusTimerState)

  // Khóa localStorage cho trạng thái timer theo từng người dùng
  const timerStorageKey = currentUser?._id
    ? `kanflow_focus_state_${currentUser._id}`
    : 'kanflow_focus_state_guest'

  // Persist vào localStorage mỗi khi state đổi (chỉ sau khi đã hydrate cho đúng user)
  const hydratedKeyRef = useRef(null)
  useEffect(() => {
    if (hydratedKeyRef.current !== timerStorageKey) return
    try {
      const persistable = { ...timerState }
      delete persistable.hydrated // cờ phiên, không persist
      localStorage.setItem(timerStorageKey, JSON.stringify(persistable))
    } catch {
      // ignore
    }
  }, [timerStorageKey, timerState])

  // Hydrate từ localStorage khi mount / người dùng đổi tài khoản
  useEffect(() => {
    try {
      const saved = localStorage.getItem(timerStorageKey)
      dispatch(hydrateTimerState(saved ? JSON.parse(saved) : null))
    } catch {
      dispatch(hydrateTimerState(null))
    }
    hydratedKeyRef.current = timerStorageKey
  }, [timerStorageKey, dispatch])

  // Tick 500ms chỉ khi timer đang chạy (tránh tốn CPU và render thừa khi idle)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!timerState.isRunning) return
    const interval = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(interval)
  }, [timerState.isRunning])

  // Phát hiện hết giờ -> hoàn thành phiên (dispatch là idempotent: applyCompleted set isRunning=false)
  useEffect(() => {
    if (timerState.isRunning && timerState.endAt && now >= timerState.endAt) {
      dispatch(completeFocusSession())
    }
  }, [now, timerState.isRunning, timerState.endAt, dispatch])

  return null
}
