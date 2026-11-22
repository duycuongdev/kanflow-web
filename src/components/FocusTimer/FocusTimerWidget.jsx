import { useState, useRef, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Fab from '@mui/material/Fab'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import TextField from '@mui/material/TextField'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import LinearProgress from '@mui/material/LinearProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { motion, AnimatePresence } from 'framer-motion'
import dayjs from 'dayjs'

import TimerRoundedIcon from '@mui/icons-material/TimerRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import PauseRoundedIcon from '@mui/icons-material/PauseRounded'
import StopRoundedIcon from '@mui/icons-material/StopRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'

import { selectCurrentUser } from '~/redux/user/userSlice'
import { selectCurrentActiveCard, selectIsShowModalActiveCard } from '~/redux/activeCard/activeCardSlice'
import { createFocusSessionAPI, getFocusStatsAPI, getFocusLeaderboardAPI } from '~/apis'
import { getPageLoading, subscribePageLoading } from '~/utils/pageLoadingState'

/** Các chế độ timer: tập trung / nghỉ ngắn / nghỉ dài */
const TIMER_MODES = {
  focus: { label: 'focus', defaultMs: 25 * 60 * 1000, color: '#0052cc' },
  shortBreak: { label: 'shortBreak', defaultMs: 5 * 60 * 1000, color: '#00875a' },
  longBreak: { label: 'longBreak', defaultMs: 15 * 60 * 1000, color: '#6554c0' }
}

/** Màu hiển thị cho từng màu hạng trong bảng xếp hạng */
const RANK_MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }

/** Định dạng ms thành "1h 23m" (dùng cho thống kê) */
const formatDurationShort = (ms) => {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/** Định dạng ms thành "25:00" / "1:05:30" (dùng cho đếm ngược) */
const formatCountdown = (ms) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  if (hours > 0) return `${hours}:${mm}:${ss}`
  return `${mm}:${ss}`
}

export default function FocusTimerWidget() {
  const { t } = useTranslation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const currentUser = useSelector(selectCurrentUser)
  const currentActiveCard = useSelector(selectCurrentActiveCard)
  const isShowModalActiveCard = useSelector(selectIsShowModalActiveCard)

  const [isPageLoading, setIsPageLoading] = useState(getPageLoading())
  useEffect(() => {
    const unsubscribe = subscribePageLoading(setIsPageLoading)
    return unsubscribe
  }, [])

  // Khóa localStorage cho trạng thái timer theo từng người dùng
  const timerStorageKey = currentUser?._id
    ? `kanflow_focus_state_${currentUser._id}`
    : 'kanflow_focus_state_guest'

  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState('timer')

  // Trạng thái timer (persist localStorage để refresh trang không mất phiên đang chạy)
  const [timerState, setTimerState] = useState(() => {
    const initial = {
      mode: 'focus',
      durationMs: TIMER_MODES.focus.defaultMs,
      remainingMs: TIMER_MODES.focus.defaultMs,
      isRunning: false,
      endAt: null,
      segStartAt: null,
      focusedMs: 0,
      pomodoroCount: 0,
      customMinutes: 25
    }
    try {
      const saved = localStorage.getItem(timerStorageKey)
      if (saved) return { ...initial, ...JSON.parse(saved) }
    } catch {
      // ignore storage load error
    }
    return initial
  })

  // Đồng bộ trạng thái khi người dùng đổi tài khoản
  useEffect(() => {
    try {
      const saved = localStorage.getItem(timerStorageKey)
      if (saved) setTimerState((prev) => ({ ...prev, ...JSON.parse(saved) }))
    } catch {
      // ignore
    }
  }, [timerStorageKey])

  // Lưu trạng thái vào localStorage mỗi khi thay đổi
  useEffect(() => {
    try {
      localStorage.setItem(timerStorageKey, JSON.stringify(timerState))
    } catch {
      // ignore
    }
  }, [timerStorageKey, timerState])

  const [now, setNow] = useState(Date.now())
  const [showSuggestion, setShowSuggestion] = useState(null) // 'shortBreak' | 'longBreak' sau khi focus xong

  // Thống kê & bảng xếp hạng (tab Insights)
  const [stats, setStats] = useState(null) // { day, week, month } mỗi cái { totalMs, sessionCount }
  const [statsLoading, setStatsLoading] = useState(false)
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('week') // 'week' | 'month'
  const [leaderboard, setLeaderboard] = useState(null)
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)

  // Ref giữ card đang được focus (không persist - chỉ theo phiên đăng nhập)
  const focusedCardRef = useRef(null)
  useEffect(() => {
    if (isShowModalActiveCard && currentActiveCard) {
      focusedCardRef.current = { _id: currentActiveCard._id, title: currentActiveCard.title, boardId: currentActiveCard.boardId }
    }
  }, [isShowModalActiveCard, currentActiveCard])

  // Tick mỗi 500ms khi timer đang chạy (hoặc khi panel mở để cập nhật đồng hồ hiện tại)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(interval)
  }, [])

  const remainingMs = timerState.isRunning && timerState.endAt
    ? Math.max(0, timerState.endAt - now)
    : timerState.remainingMs

  // Tự động hoàn thành khi hết thời gian đếm ngược
  const completeTimer = useCallback((finishedState) => {
    const modeConfig = TIMER_MODES[finishedState.mode]
    const finishedAt = finishedState.endAt

    // Chỉ log phiên FOCUS (nghỉ ngắn không tính vào thống kê năng suất)
    if (finishedState.mode === 'focus' && finishedState.durationMs >= 60 * 1000) {
      // Log "end-anchored": nếu có pause giữa chừng thì window bị nén lại,
      // nhưng durationMs (thứ stats cộng dồn) vẫn đúng bằng thời gian tập trung thực tế
      createFocusSessionAPI({
        startedAt: finishedAt - finishedState.durationMs,
        endedAt: finishedAt,
        cardId: focusedCardRef.current?._id || null,
        boardId: focusedCardRef.current?.boardId || null
      }).then(() => {
        toast.success(t('focusTimer.sessionLogged', { duration: formatDurationShort(finishedState.durationMs) }))
      }).catch(() => {
        toast.error(t('focusTimer.sessionLogFailed'))
      })
    }

    const isFocusDone = finishedState.mode === 'focus'
    setTimerState((prev) => ({
      ...prev,
      isRunning: false,
      endAt: null,
      segStartAt: null,
      focusedMs: 0,
      remainingMs: finishedState.durationMs,
      pomodoroCount: isFocusDone ? prev.pomodoroCount + 1 : prev.pomodoroCount
    }))
    setShowSuggestion(isFocusDone ? 'shortBreak' : 'focus')

    toast.success(isFocusDone
      ? t('focusTimer.focusCompleted', { duration: formatDurationShort(finishedState.durationMs) })
      : t('focusTimer.breakCompleted', { mode: t(`focusTimer.mode.${modeConfig.label}`) })
    )
  }, [t])

  // Vòng lặp đếm ngược - kiểm tra hết giờ
  useEffect(() => {
    if (timerState.isRunning && timerState.endAt && now >= timerState.endAt) {
      completeTimer(timerState)
    }
  }, [now, timerState, completeTimer])

  const startTimer = () => {
    const segStart = Date.now()
    setTimerState((prev) => ({
      ...prev,
      isRunning: true,
      endAt: segStart + prev.remainingMs,
      segStartAt: segStart
    }))
  }

  const pauseTimer = () => {
    setTimerState((prev) => {
      const segFocused = prev.endAt ? Math.max(0, prev.endAt - Date.now()) : 0
      // focusedMs chỉ cộng cho mode focus (thống kê năng suất)
      const gained = prev.mode === 'focus' ? Math.max(0, prev.segStartAt ? Date.now() - prev.segStartAt : 0) : 0
      return {
        ...prev,
        isRunning: false,
        endAt: null,
        segStartAt: null,
        remainingMs: Math.max(0, segFocused > 0 ? prev.endAt - Date.now() : prev.remainingMs),
        focusedMs: prev.focusedMs + gained
      }
    })
  }

  const stopTimer = () => {
    setTimerState((prev) => {
      const segFocusedMs = prev.mode === 'focus' && prev.segStartAt ? Math.max(0, Date.now() - prev.segStartAt) : 0
      const totalFocusedMs = prev.focusedMs + segFocusedMs

      // Dừng sớm: vẫn log nếu đã tập trung được ít nhất 1 phút
      if (prev.mode === 'focus' && totalFocusedMs >= 60 * 1000) {
        const stoppedAt = Date.now()
        createFocusSessionAPI({
          startedAt: stoppedAt - totalFocusedMs,
          endedAt: stoppedAt,
          cardId: focusedCardRef.current?._id || null,
          boardId: focusedCardRef.current?.boardId || null
        }).then(() => {
          toast.success(t('focusTimer.sessionLogged', { duration: formatDurationShort(totalFocusedMs) }))
        }).catch(() => {
          toast.error(t('focusTimer.sessionLogFailed'))
        })
        setTimerState((latest) => ({ ...latest, pomodoroCount: latest.pomodoroCount + 1 }))
      }

      return {
        ...prev,
        isRunning: false,
        endAt: null,
        segStartAt: null,
        focusedMs: 0,
        remainingMs: prev.durationMs
      }
    })
    setShowSuggestion(null)
  }

  const resetTimer = () => {
    setTimerState((prev) => ({
      ...prev,
      isRunning: false,
      endAt: null,
      segStartAt: null,
      focusedMs: 0,
      remainingMs: prev.durationMs
    }))
    setShowSuggestion(null)
  }

  const switchMode = (modeKey) => {
    setTimerState((prev) => ({
      ...prev,
      mode: modeKey,
      durationMs: modeKey === 'focus' ? Math.max(1, prev.customMinutes) * 60 * 1000 : TIMER_MODES[modeKey].defaultMs,
      isRunning: false,
      endAt: null,
      segStartAt: null,
      focusedMs: 0,
      remainingMs: modeKey === 'focus' ? Math.max(1, prev.customMinutes) * 60 * 1000 : TIMER_MODES[modeKey].defaultMs
    }))
    setShowSuggestion(null)
  }

  const setCustomMinutes = (minutes) => {
    const clamped = Math.min(180, Math.max(1, Number(minutes) || 1))
    setTimerState((prev) => ({
      ...prev,
      customMinutes: clamped,
      ...(prev.mode === 'focus' && !prev.isRunning
        ? { durationMs: clamped * 60 * 1000, remainingMs: clamped * 60 * 1000 }
        : {})
    }))
  }

  // ==================== Insights: thống kê + bảng xếp hạng ====================

  const loadStats = useCallback(async () => {
    if (!currentUser) return
    setStatsLoading(true)
    try {
      const nowDayjs = dayjs()
      const ranges = {
        day: [nowDayjs.startOf('day').valueOf(), nowDayjs.endOf('day').valueOf() + 1],
        week: [nowDayjs.startOf('week').valueOf(), nowDayjs.endOf('week').valueOf() + 1],
        month: [nowDayjs.startOf('month').valueOf(), nowDayjs.endOf('month').valueOf() + 1]
      }
      const [day, week, month] = await Promise.all([
        getFocusStatsAPI(ranges.day[0], ranges.day[1]),
        getFocusStatsAPI(ranges.week[0], ranges.week[1]),
        getFocusStatsAPI(ranges.month[0], ranges.month[1])
      ])
      setStats({ day, week, month })
    } catch {
      // im lặng - stats không phải dữ liệu quan trọng cần báo lỗi
    } finally {
      setStatsLoading(false)
    }
  }, [currentUser])

  const loadLeaderboard = useCallback(async (period) => {
    if (!currentUser) return
    setLeaderboardLoading(true)
    try {
      const nowDayjs = dayjs()
      const [from, to] = period === 'month'
        ? [nowDayjs.startOf('month').valueOf(), nowDayjs.endOf('month').valueOf() + 1]
        : [nowDayjs.startOf('week').valueOf(), nowDayjs.endOf('week').valueOf() + 1]
      const data = await getFocusLeaderboardAPI(from, to)
      setLeaderboard(data)
    } catch {
      // im lặng
    } finally {
      setLeaderboardLoading(false)
    }
  }, [currentUser])

  // Mở tab Insights hoặc vừa log xong phiên → load lại số liệu
  useEffect(() => {
    if (isOpen && tab === 'insights' && currentUser) {
      loadStats()
      loadLeaderboard(leaderboardPeriod)
    }
  }, [isOpen, tab, currentUser, loadStats, loadLeaderboard, leaderboardPeriod])

  // Tiến độ vòng tròn (0 -> 1)
  const progress = timerState.durationMs > 0 ? 1 - remainingMs / timerState.durationMs : 0
  const modeConfig = TIMER_MODES[timerState.mode]
  const ringColor = modeConfig.color
  const ringSize = 200
  const ringStroke = 10
  const ringRadius = (ringSize - ringStroke) / 2
  const ringCircumference = 2 * Math.PI * ringRadius

  if (!currentUser) return null

  const activeCardChip = focusedCardRef.current
    ? focusedCardRef.current
    : (isShowModalActiveCard && currentActiveCard ? { _id: currentActiveCard._id, title: currentActiveCard.title } : null)

  const renderStatRow = (label, data) => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75 }}>
      <Typography variant='body2' sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
          {stats ? formatDurationShort(data?.totalMs || 0) : '—'}
        </Typography>
        <Typography variant='caption' sx={{ color: 'text.secondary' }}>
          {stats ? `· ${data?.sessionCount || 0} ${t('focusTimer.sessionsUnit')}` : ''}
        </Typography>
      </Box>
    </Box>
  )

  return (
    <>
      {/* Nút tròn mở widget - góc TRÁI DƯỚI (AI Copilot chiếm góc phải) */}
      <AnimatePresence>
        {!isPageLoading && (
          <motion.div
            key='focus-timer-fab'
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            style={{
              position: 'fixed',
              bottom: isMobile ? 'calc(76px + env(safe-area-inset-bottom, 0px))' : 24,
              left: isMobile ? 16 : 24,
              zIndex: 1200
            }}
          >
            <Tooltip title={t('focusTimer.title')}>
              <Fab
                aria-label={t('focusTimer.title')}
                onClick={() => setIsOpen((prev) => !prev)}
                sx={{
                  bgcolor: timerState.isRunning ? ringColor : (theme) => theme.palette.mode === 'dark' ? '#1e293b' : '#fff',
                  color: timerState.isRunning ? '#fff' : (theme) => theme.palette.mode === 'dark' ? '#e2e8f0' : ringColor,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  border: timerState.isRunning ? 'none' : '1px solid rgba(0,82,204,0.35)',
                  '&:hover': { bgcolor: timerState.isRunning ? ringColor : (theme) => theme.palette.mode === 'dark' ? '#273449' : '#f0f6ff' }
                }}
              >
                {timerState.isRunning
                  ? (
                    <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TimerRoundedIcon />
                      <Box sx={{
                        position: 'absolute', top: -2, right: -2, width: 10, height: 10,
                        borderRadius: '50%', bgcolor: '#ff5630', border: '2px solid currentColor'
                      }} />
                    </Box>
                  )
                  : <TimerRoundedIcon />}
              </Fab>
            </Tooltip>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel widget */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key='focus-timer-panel'
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <Paper
              elevation={12}
              sx={{
                position: 'fixed',
                bottom: { xs: 0, sm: 24 },
                left: { xs: 0, sm: 24 },
                width: { xs: '100vw', sm: 400 },
                height: { xs: 'auto', sm: 580 },
                maxHeight: { xs: '88dvh', sm: 'calc(100dvh - 120px)' },
                zIndex: 1350,
                borderRadius: { xs: '16px 16px 0 0', sm: 3 },
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: (theme) => theme.palette.mode === 'dark' ? '#101828' : '#fff'
              }}
            >
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5 }}>
                <TimerRoundedIcon sx={{ color: ringColor, mr: 1, fontSize: 22 }} />
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', flex: 1 }}>
                  {t('focusTimer.title')}
                </Typography>
                <IconButton size='small' onClick={() => setIsOpen(false)} aria-label={t('common.close')}>
                  <CloseRoundedIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Box>

              <Tabs
                value={tab}
                onChange={(e, newValue) => setTab(newValue)}
                variant='fullWidth'
                sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 } }}
              >
                <Tab value='timer' label={t('focusTimer.tabTimer')} />
                <Tab value='insights' label={t('focusTimer.tabInsights')} />
              </Tabs>

              {tab === 'timer' && (
                <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {/* Mode chips */}
                  <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {Object.entries(TIMER_MODES).map(([key, config]) => (
                      <Chip
                        key={key}
                        label={t(`focusTimer.mode.${config.label}`)}
                        onClick={() => switchMode(key)}
                        disabled={timerState.isRunning}
                        size='small'
                        sx={{
                          fontWeight: 600,
                          ...(timerState.mode === key
                            ? { bgcolor: config.color, color: '#fff' }
                            : { bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e293b' : '#f1f3f5' })
                        }}
                      />
                    ))}
                  </Box>

                  {/* Vòng tròn đếm ngược */}
                  <Box sx={{ position: 'relative', mt: 2, mb: 1 }}>
                    <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)' }}>
                      <circle
                        cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
                        fill='none'
                        stroke={theme.palette.mode === 'dark' ? '#1e293b' : '#e9ecef'}
                        strokeWidth={ringStroke}
                      />
                      <circle
                        cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
                        fill='none'
                        stroke={ringColor}
                        strokeWidth={ringStroke}
                        strokeLinecap='round'
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringCircumference * (1 - progress)}
                        style={{ transition: 'stroke-dashoffset 0.5s linear' }}
                      />
                    </svg>
                    <Box sx={{
                      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Typography sx={{ fontSize: 40, fontWeight: 800, letterSpacing: 1, color: (theme) => theme.palette.mode === 'dark' ? '#e2e8f0' : '#101828' }}>
                        {formatCountdown(remainingMs)}
                      </Typography>
                      <Typography variant='caption' sx={{ color: 'text.secondary', fontWeight: 600 }}>
                        {t(`focusTimer.mode.${modeConfig.label}`)}
                        {timerState.mode === 'focus' && timerState.pomodoroCount > 0
                          ? ` · 🍅 ${timerState.pomodoroCount}`
                          : ''}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Custom minutes cho mode focus */}
                  {timerState.mode === 'focus' && !timerState.isRunning && (
                    <TextField
                      type='number'
                      size='small'
                      label={t('focusTimer.customMinutes')}
                      value={timerState.customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      InputProps={{ inputProps: { min: 1, max: 180 } }}
                      sx={{ width: 140, mb: 1, '& input': { textAlign: 'center' } }}
                    />
                  )}

                  {/* Nút điều khiển */}
                  <Box sx={{ display: 'flex', gap: 1.5, mt: 1, alignItems: 'center' }}>
                    {!timerState.isRunning && (
                      <Button
                        variant='contained'
                        startIcon={<PlayArrowRoundedIcon />}
                        onClick={startTimer}
                        sx={{ textTransform: 'none', fontWeight: 700, bgcolor: ringColor, px: 3 }}
                      >
                        {remainingMs < timerState.durationMs && remainingMs > 0
                          ? t('focusTimer.resume')
                          : t('focusTimer.start')}
                      </Button>
                    )}
                    {timerState.isRunning && (
                      <>
                        <Button
                          variant='contained'
                          startIcon={<PauseRoundedIcon />}
                          onClick={pauseTimer}
                          sx={{ textTransform: 'none', fontWeight: 700, bgcolor: ringColor }}
                        >
                          {t('focusTimer.pause')}
                        </Button>
                        <Tooltip title={t('focusTimer.stopHint')}>
                          <IconButton onClick={stopTimer} sx={{ color: '#ff5630' }} aria-label={t('focusTimer.stopHint')}>
                            <StopRoundedIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {!timerState.isRunning && remainingMs !== timerState.durationMs && (
                      <Tooltip title={t('focusTimer.reset')}>
                        <IconButton onClick={resetTimer} aria-label={t('focusTimer.reset')}>
                          <RestartAltRoundedIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>

                  {/* Gợi ý chuyển mode sau khi hoàn thành */}
                  {showSuggestion && !timerState.isRunning && (
                    <Button
                      variant='outlined'
                      size='small'
                      sx={{ mt: 1.5, textTransform: 'none', fontWeight: 600 }}
                      onClick={() => switchMode(showSuggestion)}
                    >
                      {t('focusTimer.suggestion', { mode: t(`focusTimer.mode.${TIMER_MODES[showSuggestion].label}`) })}
                    </Button>
                  )}

                  {/* Card đang focus */}
                  {activeCardChip && (
                    <Chip
                      size='small'
                      label={`🎯 ${t('focusTimer.focusingOn')}: ${activeCardChip.title}`}
                      sx={{ mt: 1.5, maxWidth: '100%', bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e293b' : '#f1f3f5' }}
                    />
                  )}
                </Box>
              )}

              {tab === 'insights' && (
                <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pb: 2 }}>
                  {/* Thống kê của tôi */}
                  <Typography sx={{ fontWeight: 700, mt: 1.5, mb: 0.5, fontSize: '0.9rem' }}>
                    {t('focusTimer.myStats')}
                  </Typography>
                  {statsLoading && <LinearProgress sx={{ mb: 1 }} />}
                  <Paper variant='outlined' sx={{ px: 1.5, py: 0.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? '#0b1220' : '#fafbfc' }}>
                    {renderStatRow(t('focusTimer.period.today'), stats?.day)}
                    <Divider />
                    {renderStatRow(t('focusTimer.period.thisWeek'), stats?.week)}
                    <Divider />
                    {renderStatRow(t('focusTimer.period.thisMonth'), stats?.month)}
                  </Paper>

                  {/* Bảng xếp hạng */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, mb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <EmojiEventsRoundedIcon sx={{ fontSize: 20, color: '#ffab00' }} />
                      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {t('focusTimer.leaderboard')}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {['week', 'month'].map((period) => (
                        <Chip
                          key={period}
                          label={t(`focusTimer.period.${period === 'week' ? 'thisWeekShort' : 'thisMonthShort'}`)}
                          size='small'
                          onClick={() => setLeaderboardPeriod(period)}
                          sx={{
                            fontWeight: 600,
                            ...(leaderboardPeriod === period
                              ? { bgcolor: '#0052cc', color: '#fff' }
                              : { bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e293b' : '#f1f3f5' })
                          }}
                        />
                      ))}
                    </Box>
                  </Box>

                  {leaderboardLoading && <LinearProgress sx={{ mb: 1 }} />}

                  <Paper variant='outlined' sx={{ overflow: 'hidden', bgcolor: (theme) => theme.palette.mode === 'dark' ? '#0b1220' : '#fafbfc' }}>
                    {(leaderboard?.top || []).length === 0 && !leaderboardLoading && (
                      <Typography sx={{ px: 1.5, py: 2, color: 'text.secondary', textAlign: 'center', fontSize: '0.85rem' }}>
                        {t('focusTimer.leaderboardEmpty')}
                      </Typography>
                    )}
                    {(leaderboard?.top || []).map((row) => {
                      const isMe = row.userId === currentUser._id
                      return (
                        <Box
                          key={row.userId}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            ...(isMe ? { bgcolor: 'rgba(0, 82, 204, 0.10)' } : {})
                          }}
                        >
                          <Typography sx={{ width: 26, textAlign: 'center', fontWeight: 700, fontSize: '0.95rem' }}>
                            {RANK_MEDALS[row.rank] || row.rank}
                          </Typography>
                          <Avatar src={row.avatar || undefined} sx={{ width: 26, height: 26, fontSize: '0.8rem' }}>
                            {row.displayName?.charAt(0)?.toUpperCase()}
                          </Avatar>
                          <Typography sx={{ flex: 1, fontSize: '0.9rem', fontWeight: isMe ? 700 : 500, noWrap: true, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.displayName}{isMe ? ` (${t('focusTimer.you')})` : ''}
                          </Typography>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#0052cc' }}>
                            {formatDurationShort(row.totalMs)}
                          </Typography>
                        </Box>
                      )
                    })}

                    {/* Hạng của tôi nếu nằm ngoài top */}
                    {leaderboard?.me && leaderboard.me.rank > (leaderboard?.top?.length || 0) && (
                      <>
                        <Divider />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, bgcolor: 'rgba(0, 82, 204, 0.10)' }}>
                          <Typography sx={{ width: 26, textAlign: 'center', fontWeight: 700, fontSize: '0.95rem' }}>
                            {leaderboard.me.rank}
                          </Typography>
                          <Avatar src={leaderboard.me.avatar || undefined} sx={{ width: 26, height: 26, fontSize: '0.8rem' }}>
                            {leaderboard.me.displayName?.charAt(0)?.toUpperCase()}
                          </Avatar>
                          <Typography sx={{ flex: 1, fontSize: '0.9rem', fontWeight: 700, noWrap: true, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {leaderboard.me.displayName} ({t('focusTimer.you')})
                          </Typography>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#0052cc' }}>
                            {formatDurationShort(leaderboard.me.totalMs)}
                          </Typography>
                        </Box>
                      </>
                    )}
                  </Paper>
                </Box>
              )}
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
