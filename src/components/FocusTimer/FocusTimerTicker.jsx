import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { selectFocusTimerState, completeFocusSession } from '~/redux/focusTimer/focusTimerSlice'

/**
 * Ticker toàn cục cho Focus Timer (mount 1 lần ở App):
 * - Tick 500ms, phát hiện timer hết giờ và dispatch completeFocusSession
 *   (log phiên + orchestration chuỗi lặp trong slice)
 * - Tách riêng khỏi widget nổi để trang Focus (/focus) ẩn widget vẫn chạy đúng
 * - Không render gì ra DOM
 */
export default function FocusTimerTicker() {
  const dispatch = useDispatch()
  const timerState = useSelector(selectFocusTimerState)

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(interval)
  }, [])

  // Phát hiện hết giờ -> hoàn thành phiên (dispatch là idempotent: applyCompleted set isRunning=false)
  useEffect(() => {
    if (timerState.isRunning && timerState.endAt && now >= timerState.endAt) {
      dispatch(completeFocusSession())
    }
  }, [now, timerState.isRunning, timerState.endAt, dispatch])

  return null
}
