import { useState, useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import LinearProgress from '@mui/material/LinearProgress'
import Divider from '@mui/material/Divider'
import { useTheme } from '@mui/material/styles'
import dayjs from 'dayjs'

import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import PauseRoundedIcon from '@mui/icons-material/PauseRounded'
import StopRoundedIcon from '@mui/icons-material/StopRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import TimerRoundedIcon from '@mui/icons-material/TimerRounded'
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded'

import AppBar from '~/components/AppBar/AppBar'
import {
  TIMER_MODES,
  formatCountdown,
  formatDurationShort,
  selectFocusTimerState,
  selectFocusPlan,
  selectFocusTask,
  startFocusTimer,
  pauseFocusTimer,
  stopFocusSession,
  resetFocusTimer,
  setFocusTask,
  startFocusPlan
} from '~/redux/focusTimer/focusTimerSlice'
import { fetchBoardsAPI, fetchBoardDetailsAPI, getFocusStatsAPI } from '~/apis'

/** Cascade chọn nhiệm vụ: Bảng → Card → Checklist → Item (tái dùng pattern của Schedule popover) */
function TaskCascade({ onChainChange }) {
  const { t } = useTranslation()
  const [boards, setBoards] = useState([])
  const [boardId, setBoardId] = useState('')
  const [cardId, setCardId] = useState('')
  const [checklistId, setChecklistId] = useState('')
  const [itemId, setItemId] = useState('')
  const [cardOptions, setCardOptions] = useState([])
  const [loadingBoard, setLoadingBoard] = useState(false)

  useEffect(() => {
    fetchBoardsAPI('?page=1&itemsPerPage=100')
      .then((data) => setBoards(data.boards || []))
      .catch(() => { /* lỗi đã toast ở interceptor */ })
  }, [])

  useEffect(() => {
    if (!boardId) {
      setCardOptions([])
      return
    }
    let cancelled = false
    setLoadingBoard(true)
    fetchBoardDetailsAPI(boardId)
      .then((boardDetails) => {
        if (cancelled) return
        setCardOptions((boardDetails.columns || []).flatMap((column) => (column.cards || [])))
        onChainChange({ boardId, boardTitle: boardDetails.title, cardId: null, cardTitle: null, checklistId: null, checklistTitle: null, checklistItemId: null, itemTitle: null })
        setCardId('')
        setChecklistId('')
        setItemId('')
      })
      .catch(() => { /* lỗi đã toast ở interceptor */ })
      .finally(() => { if (!cancelled) setLoadingBoard(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId])

  const selectedCard = cardOptions.find((c) => c._id === cardId)
  const selectedChecklist = selectedCard?.checklists?.find((cl) => (cl._id || cl.title) === checklistId)

  const handleCard = (value) => {
    setCardId(value)
    setChecklistId('')
    setItemId('')
    const card = cardOptions.find((c) => c._id === value)
    onChainChange({
      boardId,
      cardId: value || null,
      cardTitle: card?.title || null,
      checklistId: null,
      checklistTitle: null,
      checklistItemId: null,
      itemTitle: null
    })
  }

  const handleChecklist = (value) => {
    setChecklistId(value)
    setItemId('')
    const checklist = selectedCard?.checklists?.find((cl) => (cl._id || cl.title) === value)
    onChainChange({
      boardId,
      cardId,
      cardTitle: selectedCard?.title || null,
      checklistId: value || null,
      checklistTitle: checklist?.title || null,
      checklistItemId: null,
      itemTitle: null
    })
  }

  const handleItem = (value) => {
    setItemId(value)
    const item = selectedChecklist?.items?.find((it) => (it._id || it.title) === value)
    onChainChange({
      boardId,
      cardId,
      cardTitle: selectedCard?.title || null,
      checklistId: checklistId || null,
      checklistTitle: selectedChecklist?.title || null,
      checklistItemId: value || null,
      itemTitle: item?.title || null
    })
  }

  return (
    <Box>
      <Select
        fullWidth
        size='small'
        displayEmpty
        value={boardId}
        onChange={(e) => setBoardId(e.target.value)}
        sx={{ mb: 1 }}
        renderValue={(value) => {
          if (!value) return <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>{t('schedule.selectBoard')}</Typography>
          const board = boards.find((b) => b._id === value)
          return board?.title || value
        }}
      >
        {boards.map((board) => (
          <MenuItem key={board._id} value={board._id}>{board.title}</MenuItem>
        ))}
        {boards.length === 0 && (
          <MenuItem disabled value=''>
            <Typography sx={{ fontSize: '0.85rem' }}>{t('schedule.noBoards')}</Typography>
          </MenuItem>
        )}
      </Select>

      {boardId && (
        <Select
          fullWidth
          size='small'
          displayEmpty
          value={cardId}
          onChange={(e) => handleCard(e.target.value)}
          sx={{ mb: 1 }}
          renderValue={(value) => {
            if (!value) return <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>{t('schedule.selectCard')}</Typography>
            const card = cardOptions.find((c) => c._id === value)
            return card?.title || value
          }}
        >
          <MenuItem value=''>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>{t('schedule.noCard')}</Typography>
          </MenuItem>
          {cardOptions.map((card) => (
            <MenuItem key={card._id} value={card._id}>
              <Typography sx={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>
                {card.title}
              </Typography>
            </MenuItem>
          ))}
        </Select>
      )}

      {cardId && selectedCard?.checklists?.length > 0 && (
        <Select
          fullWidth
          size='small'
          displayEmpty
          value={checklistId}
          onChange={(e) => handleChecklist(e.target.value)}
          sx={{ mb: 1 }}
          renderValue={(value) => {
            if (!value) return <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>{t('schedule.selectChecklist')}</Typography>
            const checklist = selectedCard.checklists.find((cl) => (cl._id || cl.title) === value)
            return checklist?.title || value
          }}
        >
          <MenuItem value=''>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>{t('schedule.noChecklist')}</Typography>
          </MenuItem>
          {selectedCard.checklists.map((checklist) => (
            <MenuItem key={checklist._id || checklist.title} value={checklist._id || checklist.title}>
              <Typography sx={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>
                {checklist.title}
              </Typography>
            </MenuItem>
          ))}
        </Select>
      )}

      {checklistId && selectedChecklist?.items?.length > 0 && (
        <Select
          fullWidth
          size='small'
          displayEmpty
          value={itemId}
          onChange={(e) => handleItem(e.target.value)}
          renderValue={(value) => {
            if (!value) return <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>{t('schedule.selectItem')}</Typography>
            const item = selectedChecklist.items.find((it) => (it._id || it.title) === value)
            return item?.title || value
          }}
        >
          <MenuItem value=''>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>{t('schedule.noItem')}</Typography>
          </MenuItem>
          {selectedChecklist.items.map((item) => (
            <MenuItem key={item._id || item.title} value={item._id || item.title}>
              <Typography sx={{
                fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280,
                textDecoration: item.isDone ? 'line-through' : 'none',
                color: item.isDone ? 'text.disabled' : 'text.primary'
              }}>
                {item.title}
              </Typography>
            </MenuItem>
          ))}
        </Select>
      )}

      {loadingBoard && <LinearProgress sx={{ mt: 1 }} />}
    </Box>
  )
}

export default function Focus() {
  const { t } = useTranslation()
  const theme = useTheme()
  const dispatch = useDispatch()

  const timerState = useSelector(selectFocusTimerState)
  const plan = useSelector(selectFocusPlan)
  const focusTask = useSelector(selectFocusTask)

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(interval)
  }, [])

  // Cấu hình chuỗi (local state cho form) - đồng bộ khi plan đang chạy
  const [focusMinutes, setFocusMinutes] = useState(plan.focusMinutes)
  const [repeats, setRepeats] = useState(plan.repeats)
  const [breakMode, setBreakMode] = useState(plan.breakMode)

  // Thống kê hôm nay
  const [todayMs, setTodayMs] = useState(null)
  useEffect(() => {
    const nowDayjs = dayjs()
    getFocusStatsAPI(nowDayjs.startOf('day').valueOf(), nowDayjs.endOf('day').valueOf() + 1)
      .then((data) => setTodayMs(data.totalMs || 0))
      .catch(() => { /* im lặng */ })
  }, [timerState.pomodoroCount])

  const remainingMs = timerState.isRunning && timerState.endAt
    ? Math.max(0, timerState.endAt - now)
    : timerState.remainingMs

  const modeConfig = TIMER_MODES[timerState.mode]
  const progress = timerState.durationMs > 0 ? 1 - remainingMs / timerState.durationMs : 0
  const ringSize = 260
  const ringStroke = 12
  const ringRadius = (ringSize - ringStroke) / 2
  const ringCircumference = 2 * Math.PI * ringRadius

  // Tổng thời gian chuỗi: focus × repeats + break × (repeats - 1)
  const planSummary = useMemo(() => {
    const focusMs = Math.max(1, Number(focusMinutes) || 1) * 60000
    const breakMs = (breakMode === 'long' ? 15 : 5) * 60000
    const reps = Math.max(1, Number(repeats) || 1)
    const total = focusMs * reps + breakMs * (reps - 1)
    return { total, reps }
  }, [focusMinutes, repeats, breakMode])

  const handleStartPlan = () => {
    dispatch(startFocusPlan({ focusMinutes: Math.max(1, Number(focusMinutes) || 1), repeats: Math.max(1, Number(repeats) || 1), breakMode }))
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? '#0f172a' : '#f4f5f7',
      pb: { xs: 'calc(76px + env(safe-area-inset-bottom, 0px))', sm: 0 }
    }}>
      <AppBar />

      <Container maxWidth='xl' sx={{ pt: 2 }}>
        {/* Header */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          mb: 2, bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? '#101828' : '#fff',
          borderRadius: 2, px: 2, py: 1.5, boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
        }}>
          <TimerRoundedIcon sx={{ color: modeConfig.color }} />
          <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
            {t('focusPage.title')}
          </Typography>
          <Box sx={{ flex: 1 }} />
          {todayMs !== null && (
            <Chip
              size='small'
              label={`${t('focusPage.todayFocus')}: ${formatDurationShort(todayMs)}`}
              sx={{ fontWeight: 700, bgcolor: 'rgba(0,82,204,0.10)', color: '#0052cc' }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2.5, alignItems: 'flex-start' }}>
          {/* TRÁI: vòng tròn tập trung */}
          <Paper elevation={8} sx={{
            flexShrink: 0, width: { xs: '100%', md: 400 },
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            p: { xs: 2, md: 3 }, borderRadius: 3,
            bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? '#101828' : '#fff'
          }}>
            {/* Vòng lặp đang chạy */}
            {plan.active && (
              <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                {Array.from({ length: plan.repeats }, (_, i) => {
                  const roundNo = i + 1
                  const done = plan.phase === 'focus' ? roundNo < plan.round : roundNo <= plan.round - 1
                  const current = plan.phase === 'focus' && roundNo === plan.round
                  const breaking = plan.phase === 'break' && roundNo === plan.round
                  return (
                    <Chip
                      key={roundNo}
                      size='small'
                      label={t('focusPage.roundChip', { n: roundNo })}
                      sx={{
                        fontWeight: 600,
                        ...(done ? { bgcolor: '#00875a', color: '#fff' } : {}),
                        ...(current && !breaking ? { bgcolor: '#0052cc', color: '#fff' } : {}),
                        ...(breaking ? { bgcolor: '#6554c0', color: '#fff' } : {}),
                        ...(done || current || breaking ? {} : { bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? '#1e293b' : '#f1f3f5' })
                      }}
                    />
                  )
                })}
              </Box>
            )}

            <Box sx={{ position: 'relative', mb: 1 }}>
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
                  stroke={modeConfig.color}
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
                <Typography sx={{ fontSize: 52, fontWeight: 800, letterSpacing: 1, color: (themeBg) => themeBg.palette.mode === 'dark' ? '#e2e8f0' : '#101828' }}>
                  {formatCountdown(remainingMs)}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {plan.active
                    ? t('focusPage.roundOf', { round: plan.round, repeats: plan.repeats })
                    : t(`focusTimer.mode.${modeConfig.label}`)}
                </Typography>
                <Typography variant='caption' sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {timerState.mode === 'focus' && timerState.pomodoroCount > 0 ? `🍅 ${timerState.pomodoroCount}` : ''}
                </Typography>
              </Box>
            </Box>

            {/* Nhiệm vụ đang focus */}
            {focusTask?.title && (
              <Chip
                label={`🎯 ${t('focusTimer.focusingOn')}: ${focusTask.title}`}
                sx={{ mb: 1.5, maxWidth: '100%', bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? '#1e293b' : '#f1f3f5' }}
              />
            )}

            {/* Điều khiển */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 1 }}>
              {!timerState.isRunning && (
                <Button
                  variant='contained'
                  size='large'
                  startIcon={<PlayArrowRoundedIcon />}
                  onClick={() => dispatch(startFocusTimer({ now: Date.now() }))}
                  sx={{ textTransform: 'none', fontWeight: 700, bgcolor: modeConfig.color, px: 4 }}
                >
                  {remainingMs < timerState.durationMs && remainingMs > 0 ? t('focusTimer.resume') : t('focusTimer.start')}
                </Button>
              )}
              {timerState.isRunning && (
                <>
                  <Button
                    variant='contained'
                    size='large'
                    startIcon={<PauseRoundedIcon />}
                    onClick={() => dispatch(pauseFocusTimer({ now: Date.now() }))}
                    sx={{ textTransform: 'none', fontWeight: 700, bgcolor: modeConfig.color, px: 3 }}
                  >
                    {t('focusTimer.pause')}
                  </Button>
                  <Tooltip title={t('focusTimer.stopHint')}>
                    <IconButton
                      onClick={() => dispatch(stopFocusSession())}
                      sx={{ color: '#ff5630' }}
                      aria-label={t('focusTimer.stopHint')}
                      size='large'
                    >
                      <StopRoundedIcon />
                    </IconButton>
                  </Tooltip>
                </>
              )}
              {!timerState.isRunning && remainingMs !== timerState.durationMs && (
                <Tooltip title={t('focusTimer.reset')}>
                  <IconButton onClick={() => dispatch(resetFocusTimer())} aria-label={t('focusTimer.reset')} size='large'>
                    <RestartAltRoundedIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Paper>

          {/* PHẢI: nhiệm vụ + chế độ lặp */}
          <Box sx={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Nhiệm vụ */}
            <Paper elevation={8} sx={{
              p: { xs: 2, md: 2.5 }, borderRadius: 3,
              bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? '#101828' : '#fff'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <EventNoteRoundedIcon sx={{ color: '#0052cc', fontSize: 20 }} />
                <Typography sx={{ fontWeight: 700 }}>
                  {t('focusPage.taskSection')}
                </Typography>
              </Box>
              <TaskCascade
                onChainChange={(chain) => {
                  const hasCard = Boolean(chain.cardId)
                  dispatch(setFocusTask({
                    cardId: chain.cardId || null,
                    boardId: chain.boardId || null,
                    title: chain.itemTitle || chain.cardTitle || null
                  }))
                  return hasCard
                }}
              />
              <Typography variant='caption' sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                {t('focusPage.taskHint')}
              </Typography>
            </Paper>

            {/* Chế độ lặp */}
            <Paper elevation={8} sx={{
              p: { xs: 2, md: 2.5 }, borderRadius: 3,
              bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? '#101828' : '#fff'
            }}>
              <Typography sx={{ fontWeight: 700, mb: 1.5 }}>
                {t('focusPage.planSection')}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
                <TextField
                  type='number'
                  size='small'
                  label={t('focusPage.focusMinutes')}
                  value={focusMinutes}
                  disabled={plan.active}
                  onChange={(e) => setFocusMinutes(e.target.value)}
                  InputProps={{ inputProps: { min: 1, max: 180 } }}
                  sx={{ width: 150, '& input': { textAlign: 'center' } }}
                />
                <TextField
                  type='number'
                  size='small'
                  label={t('focusPage.repeats')}
                  value={repeats}
                  disabled={plan.active}
                  onChange={(e) => setRepeats(e.target.value)}
                  InputProps={{ inputProps: { min: 1, max: 12 } }}
                  sx={{ width: 150, '& input': { textAlign: 'center' } }}
                />
                <Box>
                  <Typography variant='caption' sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    {t('focusPage.breakMode')}
                  </Typography>
                  <ToggleButtonGroup
                    value={breakMode}
                    exclusive
                    onChange={(e, v) => v && setBreakMode(v)}
                    size='small'
                    disabled={plan.active}
                  >
                    <ToggleButton value='short'>{t('focusPage.breakShort')}</ToggleButton>
                    <ToggleButton value='long'>{t('focusPage.breakLong')}</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              </Box>

              <Typography variant='body2' sx={{ color: 'text.secondary', mb: 1.5 }}>
                {t('focusPage.summary', {
                  focus: Math.max(1, Number(focusMinutes) || 1),
                  repeats: planSummary.reps,
                  breakMode: breakMode === 'long' ? t('focusPage.breakModeLongText') : t('focusPage.breakModeShortText'),
                  breakMinutes: breakMode === 'long' ? 15 : 5,
                  total: formatDurationShort(planSummary.total)
                })}
              </Typography>

              <Divider sx={{ mb: 1.5 }} />

              {plan.active ? (
                <Button
                  fullWidth
                  variant='outlined'
                  color='error'
                  onClick={() => dispatch(stopFocusSession())}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  {t('focusPage.stopPlan')}
                </Button>
              ) : (
                <Button
                  fullWidth
                  variant='contained'
                  size='large'
                  startIcon={<TimerRoundedIcon />}
                  onClick={handleStartPlan}
                  sx={{ textTransform: 'none', fontWeight: 700, py: 1.2 }}
                >
                  {t('focusPage.startPlan')}
                </Button>
              )}
            </Paper>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
