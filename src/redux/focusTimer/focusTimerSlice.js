import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { toast } from 'react-toastify'
import i18n from '~/i18n'
import { createFocusSessionAPI } from '~/apis'

/**
 * Trạng thái Focus Timer dùng chung cho mọi nơi hiển thị:
 * - Trang Focus (/focus) + card sidebar (FocusTimerSidebarCard) - FocusTimerTicker điều phối
 * - Widget nổi mount toàn cục ở App: chịu trách nhiệm hydrate từ localStorage + persist trở lại
 * - FocusTimerTicker (mount toàn cục) chịu trách nhiệm tick phát hiện hết giờ và orchestration
 * - task: nhiệm vụ đang focus (card/board - set từ card modal hoặc trang Focus chọn cascade)
 * - plan: cấu hình chuỗi lặp (tập trung x phút, lặp n lần, nghỉ giữa các lượt ngắn/dài)
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
  hydrated: false,
  // Nhiệm vụ đang focus (log phiên gắn vào card/board này)
  task: { cardId: null, boardId: null, title: null },
  // Hàng đợi thẻ tập trung trong phiên: [{ id, cardId, boardId, cardTitle, boardTitle, isCompleted, completedAt }]
  taskQueue: [],
  // Chuỗi lặp: tập trung focusMinutes' × repeats lượt, nghỉ breakMode giữa các lượt
  plan: { active: false, focusMinutes: 25, repeats: 4, breakMode: 'short', round: 1, phase: 'idle' }
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
        if (saved[key] !== undefined && saved[key] !== null) state[key] = saved[key]
      })
      // Đang chạy nhưng endAt đã qua (tab đóng lâu): coi như phiên đó hoàn thành 1 pomodoro rồi dừng
      if (state.isRunning && state.endAt && state.endAt <= Date.now()) {
        if (state.mode === 'focus' && state.durationMs >= 60 * 1000) {
          state.pomodoroCount += 1
        }
        state.isRunning = false
        state.endAt = null
        state.segStartAt = null
        state.remainingMs = state.durationMs
        state.focusedMs = 0
        // Chuỗi lặp đang chạy mà mất phiên (đóng tab lâu): hủy chuỗi để tránh flow treo
        if (state.plan?.active) {
          state.plan = { ...initialState.plan }
        }
      }
      // Khôi phục hàng đợi thẻ tập trung và thẻ đang active nếu có
      if (Array.isArray(saved.taskQueue) && saved.taskQueue.length > 0) {
        state.taskQueue = saved.taskQueue
        if (saved.task?.cardId) {
          state.task = saved.task
        } else {
          const firstUncompleted = state.taskQueue.find((c) => !c.isCompleted)
          if (firstUncompleted) {
            state.task = {
              cardId: firstUncompleted.cardId,
              boardId: firstUncompleted.boardId,
              title: firstUncompleted.cardTitle,
              cardTitle: firstUncompleted.cardTitle,
              boardTitle: firstUncompleted.boardTitle
            }
          } else {
            state.task = { cardId: null, boardId: null, title: null }
          }
        }
      } else {
        state.taskQueue = []
        state.task = { cardId: null, boardId: null, title: null }
      }

      // Sau hydrate: nếu đang idle ở mode Focus, vòng đếm phản ánh đúng cấu hình chuỗi đã lưu
      // (tránh lệch giữa vòng đếm và form "Chế độ lặp" trên trang Focus)
      if (!state.plan?.active && !state.isRunning && state.mode === 'focus') {
        const minutes = Math.min(180, Math.max(1, Number(state.plan?.focusMinutes) || 1))
        state.customMinutes = minutes
        state.durationMs = minutes * 60 * 1000
        state.remainingMs = minutes * 60 * 1000
      }

      // Đánh dấu đã hydrate xong (cờ KHÔNG persist - mỗi lần mở lại trang chờ nạp mới)
      state.hydrated = true
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

    // Nhiệm vụ đang focus (từ card modal hoặc trang Focus)
    setFocusTask: (state, action) => {
      if (!action.payload) {
        state.task = null
        return
      }
      const {
        cardId = null,
        boardId = null,
        title = null,
        cardTitle = null,
        boardTitle = null,
        checklistId = null,
        checklistTitle = null,
        checklistItemId = null,
        itemTitle = null
      } = action.payload || {}
      state.task = {
        cardId,
        boardId,
        title: title || itemTitle || cardTitle || '',
        cardTitle: cardTitle || title || '',
        boardTitle: boardTitle || null,
        checklistId: checklistId || null,
        checklistTitle: checklistTitle || null,
        checklistItemId: checklistItemId || null,
        itemTitle: itemTitle || null
      }
      // Tự động đồng bộ vào hàng đợi nếu thẻ chưa có trong hàng đợi
      if (cardId) {
        if (!Array.isArray(state.taskQueue)) state.taskQueue = []
        if (!state.taskQueue.some((c) => c.cardId === cardId)) {
          state.taskQueue.push({
            id: crypto.randomUUID(),
            cardId,
            boardId,
            cardTitle: cardTitle || title || '',
            boardTitle: boardTitle || '',
            isCompleted: false,
            completedAt: null
          })
        }
      }
    },

    // Thêm thẻ vào hàng đợi tập trung
    addCardToQueue: (state, action) => {
      const { cardId, boardId, cardTitle, boardTitle } = action.payload || {}
      if (!cardId) return
      if (!Array.isArray(state.taskQueue)) state.taskQueue = []
      const exists = state.taskQueue.some((c) => c.cardId === cardId)
      if (exists) {
        toast.info(i18n.t('focusPage.cardAlreadyInQueue') || 'Thẻ này đã có trong hàng đợi')
        return
      }
      const newItem = {
        id: crypto.randomUUID(),
        cardId,
        boardId,
        cardTitle: cardTitle || '',
        boardTitle: boardTitle || '',
        isCompleted: false,
        completedAt: null
      }
      state.taskQueue.push(newItem)
      // Nếu chưa có thẻ active, gán thẻ này làm active
      if (!state.task?.cardId) {
        state.task = {
          cardId,
          boardId,
          title: cardTitle,
          cardTitle,
          boardTitle
        }
      }
    },

    // Xóa thẻ khỏi hàng đợi tập trung
    removeCardFromQueue: (state, action) => {
      const cardId = action.payload
      if (!Array.isArray(state.taskQueue)) return
      state.taskQueue = state.taskQueue.filter((c) => c.cardId !== cardId)
      // Nếu xóa đúng thẻ đang active, chuyển sang thẻ tiếp theo chưa hoàn thành
      if (state.task?.cardId === cardId) {
        const next = state.taskQueue.find((c) => !c.isCompleted)
        if (next) {
          state.task = {
            cardId: next.cardId,
            boardId: next.boardId,
            title: next.cardTitle,
            cardTitle: next.cardTitle,
            boardTitle: next.boardTitle
          }
        } else {
          state.task = null
        }
      }
    },

    // Đánh dấu hoàn thành thẻ hiện tại và tự động chuyển thẻ tiếp theo
    completeCurrentCardAndNext: (state) => {
      const currentCardId = state.task?.cardId
      if (currentCardId && Array.isArray(state.taskQueue)) {
        const item = state.taskQueue.find((c) => c.cardId === currentCardId)
        if (item) {
          item.isCompleted = true
          item.completedAt = Date.now()
        }
        // Tìm thẻ tiếp theo chưa hoàn thành trong hàng đợi
        const next = state.taskQueue.find((c) => !c.isCompleted)
        if (next) {
          state.task = {
            cardId: next.cardId,
            boardId: next.boardId,
            title: next.cardTitle,
            cardTitle: next.cardTitle,
            boardTitle: next.boardTitle
          }
        } else {
          // Đã hoàn thành toàn bộ thẻ trong hàng đợi
          state.task = null
        }
      }
    },

    // Chọn một thẻ bất kỳ trong hàng đợi làm thẻ active
    selectCardFromQueue: (state, action) => {
      const cardId = action.payload
      if (!Array.isArray(state.taskQueue)) return
      const target = state.taskQueue.find((c) => c.cardId === cardId)
      if (target) {
        state.task = {
          cardId: target.cardId,
          boardId: target.boardId,
          title: target.cardTitle,
          cardTitle: target.cardTitle,
          boardTitle: target.boardTitle
        }
      }
    },

    // Xóa toàn bộ hàng đợi
    clearTaskQueue: (state) => {
      state.taskQueue = []
      state.task = null
    },

    // Cấu hình chuỗi lặp
    setFocusPlan: (state, action) => {
      const { focusMinutes, repeats, breakMode, active, round, phase } = action.payload || {}
      if (focusMinutes !== undefined) state.plan.focusMinutes = Math.min(180, Math.max(1, Number(focusMinutes) || 1))
      if (repeats !== undefined) state.plan.repeats = Math.min(12, Math.max(1, Number(repeats) || 1))
      if (breakMode !== undefined) state.plan.breakMode = breakMode === 'long' ? 'long' : 'short'
      if (active !== undefined) state.plan.active = Boolean(active)
      if (round !== undefined) state.plan.round = Math.max(1, Number(round) || 1)
      if (phase !== undefined) state.plan.phase = phase
    }
  }
})

/**
 * Phiên hết giờ tự nhiên (FocusTimerTicker phát hiện khi tick) + orchestration chuỗi lặp:
 * - Không plan: giữ hành vi cũ - log (nếu focus ≥1 phút), toast, gợi ý mode tiếp theo
 * - Có plan active:
 *     hết lượt focus → nếu còn lượt: tự chuyển sang nghỉ (short/long) + tự start nghỉ
 *                    → nếu là lượt cuối: kết thúc chuỗi + toast hoàn thành
 *     hết nghỉ      → tự chuyển sang lượt focus tiếp theo + tự start
 * Mỗi lượt focus vẫn log 1 phiên riêng (stats/leaderboard giữ nguyên cách tính).
 * Trả về: 'shortBreak' | 'focus' (gợi ý mode, khi không có plan) | 'planCompleted' | null
 */
export const completeFocusSession = createAsyncThunk(
  'focusTimer/complete',
  async (arg, { getState, dispatch }) => {
    const timer = getState().focusTimer
    const finishedAt = timer.endAt || Date.now()
    const cardId = timer.task?.cardId || null
    const boardId = timer.task?.boardId || null
    const isFocusPhase = timer.mode === 'focus'

    if (isFocusPhase && timer.durationMs >= 60 * 1000) {
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

    const plan = timer.plan
    if (plan?.active) {
      if (isFocusPhase) {
        if (plan.round < plan.repeats) {
          // Còn lượt: nghỉ ngắn/dài rồi tự làm tiếp
          const breakModeKey = plan.breakMode === 'long' ? 'longBreak' : 'shortBreak'
          dispatch(switchTimerMode(breakModeKey))
          dispatch(setFocusPlan({ phase: 'break', round: plan.round }))
          dispatch(startFocusTimer({ now: Date.now() }))
          toast.success(i18n.t('focusPage.roundDoneBreakStarted', {
            round: plan.round,
            repeats: plan.repeats,
            breakMode: i18n.t(`focusTimer.mode.${breakModeKey}`)
          }))
          return null
        }
        // Lượt cuối: kết thúc chuỗi
        dispatch(setFocusPlan({ phase: 'idle', round: 1, active: false }))
        toast.success(i18n.t('focusPage.planCompleted', { repeats: plan.repeats }))
        return 'planCompleted'
      }
      // Hết giờ nghỉ: bắt đầu lượt focus tiếp theo
      const nextRound = plan.round + 1
      dispatch(setCustomMinutes(plan.focusMinutes))
      dispatch(switchTimerMode('focus'))
      dispatch(setFocusPlan({ phase: 'focus', round: nextRound }))
      dispatch(startFocusTimer({ now: Date.now() }))
      toast.success(i18n.t('focusPage.breakDoneNextRound', { round: nextRound, repeats: plan.repeats }))
      return null
    }

    // Không có plan: hành vi cũ
    toast.success(isFocusPhase
      ? i18n.t('focusTimer.focusCompleted', { duration: formatDurationShort(timer.durationMs) })
      : i18n.t('focusTimer.breakCompleted', { mode: i18n.t(`focusTimer.mode.${TIMER_MODES[timer.mode].label}`) })
    )
    return isFocusPhase ? 'shortBreak' : 'focus'
  }
)

/**
 * Dừng sớm (nút Stop): vẫn log nếu đã tập trung được ít nhất 1 phút.
 * Đang chạy chuỗi lặp thì hủy chuỗi luôn.
 */
export const stopFocusSession = createAsyncThunk(
  'focusTimer/stop',
  async (arg, { getState, dispatch }) => {
    const timer = getState().focusTimer
    const now = Date.now()
    const segFocusedMs = timer.mode === 'focus' && timer.segStartAt ? Math.max(0, now - timer.segStartAt) : 0
    const totalFocusedMs = timer.focusedMs + segFocusedMs
    const cardId = timer.task?.cardId || null
    const boardId = timer.task?.boardId || null

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
    if (timer.plan?.active) {
      dispatch(setFocusPlan({ active: false, round: 1, phase: 'idle' }))
      // Quay về mode focus với thời lượng mặc định để sẵn sàng cho phiên mới
      dispatch(switchTimerMode('focus'))
      toast.info(i18n.t('focusPage.planStopped'))
    }
  }
)

/**
 * Bắt đầu 1 chuỗi lặp từ trang Focus:
 * set plan → chuyển mode focus với đúng số phút → start
 */
export const startFocusPlan = createAsyncThunk(
  'focusTimer/startPlan',
  async ({ focusMinutes, repeats, breakMode } = {}, { dispatch }) => {
    dispatch(setFocusPlan({ focusMinutes, repeats, breakMode, active: true, round: 1, phase: 'focus' }))
    dispatch(setCustomMinutes(focusMinutes))
    dispatch(switchTimerMode('focus'))
    dispatch(startFocusTimer({ now: Date.now() }))
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
  setFocusTask,
  setFocusPlan,
  addCardToQueue,
  removeCardFromQueue,
  completeCurrentCardAndNext,
  selectCardFromQueue,
  clearTaskQueue
} = timerSlice.actions

export const selectFocusTimerState = (state) => state.focusTimer
export const selectFocusTask = (state) => state.focusTimer.task
export const selectFocusQueue = (state) => state.focusTimer.taskQueue || []
export const selectFocusPlan = (state) => state.focusTimer.plan

export const focusTimerReducer = timerSlice.reducer
