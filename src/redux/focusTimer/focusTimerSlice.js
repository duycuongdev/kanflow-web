import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { toast } from 'react-toastify'
import i18n from '~/i18n'
import { createFocusSessionAPI } from '~/apis'

/**
 * Trạng thái Focus Timer dùng chung cho mọi nơi hiển thị (widget nổi + card sidebar).
 * - Widget nổi (FocusTimerWidget) mount toàn cục ở App: chịu trách nhiệm hydrate từ
 *   localStorage, tick đếm ngược, phát hiện hết giờ và persist trở lại localStorage.
 * - Card sidebar (FocusTimerSidebarCard) chỉ đọc state + dispatch action - tự động đồng bộ.
 * - isPanelOpen: điều khiển đóng/mở panel đầy đủ từ bất kỳ đâu (sidebar, FAB).
 */

/** Các chế độ timer: tập trung / nghỉ ngắn / nghỉ dài */
export const TIMER_MODES = {
  focus: { label: 'focus', defaultMs: 25 * 60 * 1000, color: '#0052cc' },
  shortBreak: { label: 'shortBreak', defaultMs: 5 * 60 * 1000, color: '#00875a' },
  longBreak: { label: 'longBreak', defaultMs: 15 * 60 * 1000, color: '#6554c0' }
}

/** Định dạng ms thành "1h 23m" (dùng cho thống kê) */
export const formatDurationShort = (ms) => {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/** Định dạng ms thành "25:00" / "1:05:30" (dùng cho đếm ngược) */
export const formatCountdown = (ms) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  if (hours > 0) return `${hours}:${mm}:${ss}`
  return `${mm}:${ss}`
}

const initialState = {
  mode: 'focus',
  durationMs: TIMER_MODES.focus.defaultMs,
  remainingMs: TIMER_MODES.focus.defaultMs,
  isRunning: false,
  endAt: null,
  segStartAt: null,
  focusedMs: 0,
  pomodoroCount: 0,
  customMinutes: 25,
  isPanelOpen: false
}

const timerSlice = createSlice({
  name: 'focusTimer',
  initialState,
  reducers: {
    // Nạp trạng thái đã lưu trong localStorage (widget gọi khi mount / đổi user)
    hydrateTimerState: (state, action) => {
      const saved = action.payload
      if (!saved || typeof saved !== 'object') return
      Object.keys(initialState).forEach((key) => {
        if (key === 'isPanelOpen') return // không nạp trạng thái mở panel
        if (saved[key] !== undefined && saved[key] !== null) state[key] = saved[key]
      })
      // Đang chạy nhưng endAt đã qua (tab đóng lâu): coi như dừng ở thời điểm còn lại
      if (state.isRunning && state.endAt && state.endAt <= Date.now()) {
        if (state.mode === 'focus' && state.durationMs >= 60 * 1000) {
          state.pomodoroCount += 1
        }
        state.isRunning = false
        state.endAt = null
        state.segStartAt = null
        state.remainingMs = state.durationMs
        state.focusedMs = 0
      }
    },

    startFocusTimer: (state, action) => {
      const now = action.payload?.now ?? Date.now()
      state.isRunning = true
      state.endAt = now + state.remainingMs
      state.segStartAt = now
    },

    pauseFocusTimer: (state, action) => {
      const now = action.payload?.now ?? Date.now()
      if (!state.isRunning) return
      // focusedMs chỉ cộng cho mode focus (thống kê năng suất)
      if (state.mode === 'focus' && state.segStartAt) {
        state.focusedMs += Math.max(0, now - state.segStartAt)
      }
      state.remainingMs = Math.max(0, (state.endAt || now) - now)
      state.isRunning = false
      state.endAt = null
      state.segStartAt = null
    },

    // Reset về đúng thời lượng hiện tại (nút Reset)
    resetFocusTimer: (state) => {
      state.isRunning = false
      state.endAt = null
      state.segStartAt = null
      state.focusedMs = 0
      state.remainingMs = state.durationMs
    },

    // Chuyển mode (focus / nghỉ ngắn / nghỉ dài)
    switchTimerMode: (state, action) => {
      const modeKey = action.payload
      if (!TIMER_MODES[modeKey]) return
      state.mode = modeKey
      state.durationMs = modeKey === 'focus'
        ? Math.max(1, state.customMinutes) * 60 * 1000
        : TIMER_MODES[modeKey].defaultMs
      state.remainingMs = state.durationMs
      state.isRunning = false
      state.endAt = null
      state.segStartAt = null
      state.focusedMs = 0
    },

    setCustomMinutes: (state, action) => {
      const clamped = Math.min(180, Math.max(1, Number(action.payload) || 1))
      state.customMinutes = clamped
      if (state.mode === 'focus' && !state.isRunning) {
        state.durationMs = clamped * 60 * 1000
        state.remainingMs = clamped * 60 * 1000
      }
    },

    // Reset sau khi phiên hoàn thành tự nhiên (thunk completeFocusSession gọi)
    applyCompleted: (state) => {
      if (state.mode === 'focus') {
        state.pomodoroCount += 1
      }
      state.isRunning = false
      state.endAt = null
      state.segStartAt = null
      state.focusedMs = 0
      state.remainingMs = state.durationMs
    },

    incrementPomodoro: (state) => {
      state.pomodoroCount += 1
    },

    setPanelOpen: (state, action) => {
      state.isPanelOpen = Boolean(action.payload)
    }
  }
})

/**
 * Phiên hết giờ tự nhiên (widget phát hiện khi tick).
 * - Chỉ log phiên FOCUS (nghỉ ngắn không tính vào thống kê năng suất)
 * - Log "end-anchored": nếu có pause giữa chừng thì window bị nén lại,
 *   nhưng durationMs (thứ stats cộng dồn) vẫn đúng bằng thời gian tập trung thực tế
 * - Trả về mode gợi ý tiếp theo ('shortBreak' | 'focus') để widget hiển thị nút gợi ý
 */
export const completeFocusSession = createAsyncThunk(
  'focusTimer/complete',
  async ({ cardId = null, boardId = null } = {}, { getState, dispatch }) => {
    const timer = getState().focusTimer
    const finishedAt = timer.endAt || Date.now()
    const isFocusDone = timer.mode === 'focus'

    if (isFocusDone && timer.durationMs >= 60 * 1000) {
      try {
        await createFocusSessionAPI({
          startedAt: finishedAt - timer.durationMs,
          endedAt: finishedAt,
          cardId,
          boardId
        })
        toast.success(i18n.t('focusTimer.sessionLogged', { duration: formatDurationShort(timer.durationMs) }))
      } catch {
        toast.error(i18n.t('focusTimer.sessionLogFailed'))
      }
    }

    dispatch(applyCompleted())

    toast.success(isFocusDone
      ? i18n.t('focusTimer.focusCompleted', { duration: formatDurationShort(timer.durationMs) })
      : i18n.t('focusTimer.breakCompleted', { mode: i18n.t(`focusTimer.mode.${TIMER_MODES[timer.mode].label}`) })
    )

    return isFocusDone ? 'shortBreak' : 'focus'
  }
)

/**
 * Dừng sớm (nút Stop): vẫn log nếu đã tập trung được ít nhất 1 phút
 */
export const stopFocusSession = createAsyncThunk(
  'focusTimer/stop',
  async ({ cardId = null, boardId = null } = {}, { getState, dispatch }) => {
    const timer = getState().focusTimer
    const now = Date.now()
    const segFocusedMs = timer.mode === 'focus' && timer.segStartAt ? Math.max(0, now - timer.segStartAt) : 0
    const totalFocusedMs = timer.focusedMs + segFocusedMs

    if (timer.mode === 'focus' && totalFocusedMs >= 60 * 1000) {
      try {
        await createFocusSessionAPI({
          startedAt: now - totalFocusedMs,
          endedAt: now,
          cardId,
          boardId
        })
        toast.success(i18n.t('focusTimer.sessionLogged', { duration: formatDurationShort(totalFocusedMs) }))
        dispatch(incrementPomodoro())
      } catch {
        toast.error(i18n.t('focusTimer.sessionLogFailed'))
      }
    }

    dispatch(resetFocusTimer())
  }
)

export const {
  hydrateTimerState,
  startFocusTimer,
  pauseFocusTimer,
  resetFocusTimer,
  switchTimerMode,
  setCustomMinutes,
  applyCompleted,
  incrementPomodoro,
  setPanelOpen
} = timerSlice.actions

export const selectFocusTimerState = (state) => state.focusTimer
export const selectIsFocusPanelOpen = (state) => state.focusTimer.isPanelOpen

export const focusTimerReducer = timerSlice.reducer
