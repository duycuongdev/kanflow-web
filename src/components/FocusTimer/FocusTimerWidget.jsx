import { useState, useRef, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
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
import {
  TIMER_MODES,
  formatDurationShort,
  formatCountdown,
  selectFocusTimerState,
  selectIsFocusPanelOpen,
  hydrateTimerState,
  startFocusTimer,
  pauseFocusTimer,
  resetFocusTimer,
  switchTimerMode,
  setCustomMinutes,
  setPanelOpen,
  completeFocusSession,
  stopFocusSession
} from '~/redux/focusTimer/focusTimerSlice'
import { getFocusStatsAPI, getFocusLeaderboardAPI } from '~/apis'
import { getPageLoading, subscribePageLoading } from '~/utils/pageLoadingState'

/** Màu hiển thị cho từng màu hạng trong bảng xếp hạng */
const RANK_MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function FocusTimerWidget() {
  const { t } = useTranslation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const dispatch = useDispatch()

  const currentUser = useSelector(selectCurrentUser)
  const currentActiveCard = useSelector(selectCurrentActiveCard)
  const isShowModalActiveCard = useSelector(selectIsShowModalActiveCard)
  const timerState = useSelector(selectFocusTimerState)
  const isOpen = useSelector(selectIsFocusPanelOpen)

  const [isPageLoading, setIsPageLoading] = useState(getPageLoading())
  useEffect(() => {
    const unsubscribe = subscribePageLoading(setIsPageLoading)
    return unsubscribe
  }, [])

  // Khóa localStorage cho trạng thái timer theo từng người dùng
  const timerStorageKey = currentUser?._id
    ? `kanflow_focus_state_${currentUser._id}`
    : 'kanflow_focus_state_guest'

  const [tab, setTab] = useState('timer')

  // Lưu trạng thái vào localStorage mỗi khi thay đổi.
  // Chỉ persist sau khi đã hydrate cho đúng user (tránh ghi đè dữ liệu cũ bằng state mặc định)
  const hydratedKeyRef = useRef(null)
  useEffect(() => {
    if (hydratedKeyRef.current !== timerStorageKey) return
    try {
      const persistable = { ...timerState }
      delete persistable.isPanelOpen // trạng thái mở panel là UI cục bộ, không persist
      localStorage.setItem(timerStorageKey, JSON.stringify(persistable))
    } catch {
      // ignore
    }
  }, [timerStorageKey, timerState])

  // Hydrate trạng thái từ localStorage khi mount / người dùng đổi tài khoản
  useEffect(() => {
    try {
      const saved = localStorage.getItem(timerStorageKey)
      dispatch(hydrateTimerState(saved ? JSON.parse(saved) : null))
    } catch {
      dispatch(hydrateTimerState(null))
    }
    hydratedKeyRef.current = timerStorageKey
  }, [timerStorageKey, dispatch])

  const [now, setNow] = useState(Date.now())
  const [showSuggestion, setShowSuggestion] = useState(null) // 'shortBreak' | 'focus' sau khi phiên xong

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

  // Tick mỗi 500ms để cập nhật đếm ngược
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(interval)
  }, [])

  const remainingMs = timerState.isRunning && timerState.endAt
    ? Math.max(0, timerState.endAt - now)
    : timerState.remainingMs

  // Tự động hoàn thành khi hết thời gian đếm ngược
  // (thunk completeFocusSession: log API + toast + reset state, trả về mode gợi ý tiếp theo)
  useEffect(() => {
    if (timerState.isRunning && timerState.endAt && now >= timerState.endAt) {
      dispatch(completeFocusSession({
        cardId: focusedCardRef.current?._id || null,
        boardId: focusedCardRef.current?.boardId || null
      })).then((res) => {
        setShowSuggestion(res.payload || null)
      })
    }
  }, [now, timerState.isRunning, timerState.endAt, dispatch])

  const startTimer = () => {
    dispatch(startFocusTimer({ now: Date.now() }))
  }

  const pauseTimer = () => {
    dispatch(pauseFocusTimer({ now: Date.now() }))
  }

  const stopTimer = () => {
    dispatch(stopFocusSession({
      cardId: focusedCardRef.current?._id || null,
      boardId: focusedCardRef.current?.boardId || null
    }))
    setShowSuggestion(null)
  }

  const resetTimer = () => {
    dispatch(resetFocusTimer())
    setShowSuggestion(null)
  }

  const switchMode = (modeKey) => {
    dispatch(switchTimerMode(modeKey))
    setShowSuggestion(null)
  }

  const handleSetCustomMinutes = (minutes) => {
    dispatch(setCustomMinutes(minutes))
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
                onClick={() => dispatch(setPanelOpen(!isOpen))}
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
                <IconButton size='small' onClick={() => dispatch(setPanelOpen(false))} aria-label={t('common.close')}>
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
                      onChange={(e) => handleSetCustomMinutes(e.target.value)}
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
