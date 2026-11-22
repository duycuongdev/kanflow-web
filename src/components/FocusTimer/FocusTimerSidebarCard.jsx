import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import { useTheme } from '@mui/material/styles'

import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import PauseRoundedIcon from '@mui/icons-material/PauseRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import TimerRoundedIcon from '@mui/icons-material/TimerRounded'

import {
  TIMER_MODES,
  formatCountdown,
  selectFocusTimerState,
  startFocusTimer,
  pauseFocusTimer,
  setPanelOpen
} from '~/redux/focusTimer/focusTimerSlice'

/**
 * Card Focus Timer mini cho sidebar trang Boards - dùng CHUNG state với widget nổi
 * (redux focusTimerSlice) nên đếm ngược/nút bấm luôn đồng bộ với widget.
 * Điều khiển: Start/Pause nhanh + nút mở panel đầy đủ (đổi mode, stop, thống kê...).
 */
export default function FocusTimerSidebarCard() {
  const { t } = useTranslation()
  const theme = useTheme()
  const dispatch = useDispatch()

  const timerState = useSelector(selectFocusTimerState)

  // Tick 500ms để cập nhật đếm ngược khi đang chạy
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(interval)
  }, [])

  const remainingMs = timerState.isRunning && timerState.endAt
    ? Math.max(0, timerState.endAt - now)
    : timerState.remainingMs

  const modeConfig = TIMER_MODES[timerState.mode]
  const progress = timerState.durationMs > 0 ? 1 - remainingMs / timerState.durationMs : 0
  const ringSize = 46
  const ringStroke = 4
  const ringRadius = (ringSize - ringStroke) / 2
  const ringCircumference = 2 * Math.PI * ringRadius

  return (
    <Box sx={{
      borderRadius: '10px',
      border: '1px solid',
      borderColor: (themeBg) => themeBg.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0, 82, 204, 0.18)',
      bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0, 82, 204, 0.04)',
      p: 1.5
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <TimerRoundedIcon sx={{ fontSize: 18, color: modeConfig.color }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', flex: 1 }}>
          {t('focusTimer.title')}
        </Typography>
        {timerState.isRunning && (
          <Box sx={{
            width: 8, height: 8, borderRadius: '50%', bgcolor: '#ff5630',
            animation: 'pulse 1.5s ease-in-out infinite',
            '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } }
          }} />
        )}
      </Box>

      {/* Đếm ngược + vòng tiến độ */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
        <Box sx={{ position: 'relative', width: ringSize, height: ringSize, flexShrink: 0 }}>
          <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
              fill='none'
              stroke={theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}
              strokeWidth={ringStroke}
            />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
              fill='none'
              stroke={modeConfig.color}
              strokeWidth={ringStroke}
              strokeLinecap='round'
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringCircumference * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 0.5s linear' }}
            />
          </svg>
          {timerState.mode === 'focus' && timerState.pomodoroCount > 0 && (
            <Typography sx={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700
            }}>
              🍅{timerState.pomodoroCount}
            </Typography>
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.35rem', letterSpacing: 0.5, lineHeight: 1.1 }}>
            {formatCountdown(remainingMs)}
          </Typography>
          <Typography variant='caption' sx={{ color: 'text.secondary', fontWeight: 600 }}>
            {t(`focusTimer.mode.${modeConfig.label}`)}
          </Typography>
        </Box>
        {/* Start / Pause nhanh */}
        <IconButton
          size='small'
          aria-label={timerState.isRunning ? t('focusTimer.pause') : t('focusTimer.start')}
          onClick={() => (timerState.isRunning
            ? dispatch(pauseFocusTimer({ now: Date.now() }))
            : dispatch(startFocusTimer({ now: Date.now() })))}
          sx={{
            bgcolor: modeConfig.color, color: '#fff',
            '&:hover': { bgcolor: modeConfig.color, filter: 'brightness(1.1)' }
          }}
        >
          {timerState.isRunning ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
        </IconButton>
      </Box>

      {/* Mở panel đầy đủ */}
      <Button
        fullWidth
        size='small'
        variant='text'
        startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 16 }} />}
        onClick={() => dispatch(setPanelOpen(true))}
        sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', justifyContent: 'flex-start', px: 1 }}
      >
        {t('focusTimer.openFullPanel')}
      </Button>
    </Box>
  )
}
