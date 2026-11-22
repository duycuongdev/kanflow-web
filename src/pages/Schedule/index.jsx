import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import dayjs from 'dayjs'

import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import TodayRoundedIcon from '@mui/icons-material/TodayRounded'
import CalendarViewMonthRoundedIcon from '@mui/icons-material/CalendarViewMonthRounded'
import ViewWeekRoundedIcon from '@mui/icons-material/ViewWeekRounded'
import ViewDayRoundedIcon from '@mui/icons-material/ViewDayRounded'
import DateRangeRoundedIcon from '@mui/icons-material/DateRangeRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'

import AppBar from '~/components/AppBar/AppBar'
import WeekGrid from './WeekGrid'
import MonthGrid from './MonthGrid'
import DayAgenda from './DayAgenda'
import YearView from './YearView'
import ScheduleEntryPopover from './ScheduleEntryPopover'
import { socketIoInstance } from '~/socketClient'
import {
  getScheduleEntriesAPI,
  createScheduleEntryAPI,
  updateScheduleEntryAPI,
  deleteScheduleEntryAPI
} from '~/apis'

export default function Schedule() {
  const { t } = useTranslation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [view, setView] = useState(() => (window.innerWidth < theme.breakpoints.values.sm ? 'day' : 'week')) // 'day' | 'week' | 'month' | 'year'
  const [anchorDate, setAnchorDate] = useState(() => dayjs())

  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Popover tạo/sửa entry: { mode: 'create'|'edit', entry?, draft?: {startAt,endAt}, anchorEl }
  const [popoverState, setPopoverState] = useState(null)

  const entriesRef = useRef(null)
  entriesRef.current = entries

  // ==================== Range hiển thị ====================

  const displayRange = useMemo(() => {
    if (view === 'year') {
      return {
        from: anchorDate.startOf('year').valueOf(),
        to: anchorDate.endOf('year').valueOf() + 1
      }
    }
    if (view === 'month') {
      const gridStart = anchorDate.startOf('month').startOf('week')
      const gridEnd = anchorDate.endOf('month').endOf('week')
      return { from: gridStart.valueOf(), to: gridEnd.valueOf() + 1 }
    }
    if (view === 'day') {
      return { from: anchorDate.startOf('day').valueOf(), to: anchorDate.endOf('day').valueOf() + 1 }
    }
    const weekStart = anchorDate.startOf('week')
    const weekEnd = anchorDate.endOf('week')
    return { from: weekStart.valueOf(), to: weekEnd.valueOf() + 1 }
  }, [anchorDate, view])

  // ==================== Load data ====================

  const fetchEntries = useCallback(async (from, to) => {
    setIsLoading(true)
    try {
      const data = await getScheduleEntriesAPI(from, to)
      setEntries(data)
    } catch {
      // lỗi đã được toast ở tầng interceptor
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries(displayRange.from, displayRange.to)
  }, [displayRange, fetchEntries])

  // ==================== Realtime (đồng bộ đa thiết bị qua phòng cá nhân) ====================

  useEffect(() => {
    // Join phòng cá nhân (room = userId) - server tự ép join đúng room của chính user
    socketIoInstance.emit('FE_USER_JOIN_ROOM')

    const onScheduleChanged = (payload) => {
      const { actionType, entry } = payload || {}
      if (!actionType || !entry?._id) return

      setEntries((prev) => {
        if (actionType === 'DELETE') {
          return prev.filter((e) => e._id !== entry._id)
        }
        if (actionType === 'CREATE' || actionType === 'UPDATE') {
          const exists = prev.some((e) => e._id === entry._id)
          if (exists) {
            return prev.map((e) => (e._id === entry._id ? entry : e))
          }
          // Chỉ thêm vào list nếu entry nằm trong khoảng đang hiển thị
          const inRange = entry.startAt < displayRange.to && entry.endAt > displayRange.from
          return inRange ? [...prev, entry].sort((a, b) => a.startAt - b.startAt) : prev
        }
        return prev
      })
    }

    socketIoInstance.on('BE_SCHEDULE_CHANGED', onScheduleChanged)
    return () => socketIoInstance.off('BE_SCHEDULE_CHANGED', onScheduleChanged)
  }, [displayRange])

  // ==================== Actions ====================

  const handleSaveEntry = async (entryId, payload) => {
    if (entryId) {
      const updated = await updateScheduleEntryAPI(entryId, payload)
      setEntries((prev) => prev.map((e) => (e._id === entryId ? updated : e)))
      return updated
    }
    const created = await createScheduleEntryAPI(payload)
    // socket BE_SCHEDULE_CHANGED sẽ tự thêm vào list (cả tab này lẫn tab khác)
    setEntries((prev) => (prev.some((e) => e._id === created._id) ? prev : [...prev, created]))
    return created
  }

  const handleDeleteEntry = async (entryId) => {
    await deleteScheduleEntryAPI(entryId)
    setEntries((prev) => prev.filter((e) => e._id !== entryId))
  }

  const openCreatePopover = (draft, anchorEl = null) => {
    setPopoverState({ mode: 'create', draft, anchorEl })
  }

  const openEditPopover = (entry, anchorEl) => {
    setPopoverState({ mode: 'edit', entry, anchorEl })
  }

  // ==================== Navigation ====================

  const goPrev = () => {
    setAnchorDate((prev) => {
      if (view === 'day') return prev.subtract(1, 'day')
      if (view === 'month') return prev.subtract(1, 'month')
      if (view === 'year') return prev.subtract(1, 'year')
      return prev.subtract(1, 'week')
    })
  }
  const goNext = () => {
    setAnchorDate((prev) => {
      if (view === 'day') return prev.add(1, 'day')
      if (view === 'month') return prev.add(1, 'month')
      if (view === 'year') return prev.add(1, 'year')
      return prev.add(1, 'week')
    })
  }
  const goToday = () => setAnchorDate(dayjs())

  // Nhãn header rõ ràng theo từng view
  const headerLabel = useMemo(() => {
    if (view === 'year') return String(anchorDate.year())
    if (view === 'month') {
      return t('schedule.headerMonth', { month: anchorDate.month() + 1, year: anchorDate.year() })
    }
    if (view === 'day') {
      return anchorDate.format('dddd, DD/MM/YYYY')
    }
    const weekStart = anchorDate.startOf('week')
    const weekEnd = anchorDate.endOf('week')
    return t('schedule.headerWeek', {
      range: `${weekStart.format('DD/MM')} – ${weekEnd.format('DD/MM/YYYY')}`
    })
  }, [anchorDate, view, t])

  const viewOptions = [
    { value: 'day', label: t('schedule.viewDay'), icon: ViewDayRoundedIcon },
    { value: 'week', label: t('schedule.viewWeek'), icon: ViewWeekRoundedIcon },
    { value: 'month', label: t('schedule.viewMonth'), icon: CalendarViewMonthRoundedIcon },
    { value: 'year', label: t('schedule.viewYear'), icon: DateRangeRoundedIcon }
  ]

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? '#0f172a' : '#f4f5f7',
      pb: { xs: 'calc(76px + env(safe-area-inset-bottom, 0px))', sm: 0 }
    }}>
      <AppBar />

      <Container maxWidth='xl' sx={{ pt: 2 }}>
        {/* Header: điều hướng + đổi view */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
          mb: 2, bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? '#101828' : '#fff',
          borderRadius: 2, px: 2, py: 1.5, boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton onClick={goPrev} size='small' aria-label={t('schedule.prev')}>
              <ChevronLeftRoundedIcon />
            </IconButton>
            <Tooltip title={t('schedule.today')}>
              <IconButton onClick={goToday} size='small' aria-label={t('schedule.today')}>
                <TodayRoundedIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={goNext} size='small' aria-label={t('schedule.next')}>
              <ChevronRightRoundedIcon />
            </IconButton>
          </Box>

          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', textTransform: 'capitalize', minWidth: { xs: 'auto', sm: 220 } }}>
            {headerLabel}
          </Typography>

          <Box sx={{ flex: 1 }} />

          {!isMobile && (
            <ToggleButtonGroup
              value={view}
              exclusive
              onChange={(e, newValue) => newValue && setView(newValue)}
              size='small'
            >
              {viewOptions.map(({ value, label, icon: Icon }) => (
                <ToggleButton key={value} value={value} aria-label={label}>
                  <Icon sx={{ fontSize: 18, mr: 0.5 }} /> {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}

          {/* Mobile: giữ nút thêm (agenda không có slot để bấm); desktop tạo lịch bằng bấm ô giờ */}
          {isMobile && (
            <Button
              variant='contained'
              startIcon={<AddRoundedIcon />}
              onClick={(e) => {
                const start = dayjs().minute(0).second(0).add(1, 'hour')
                openCreatePopover({ startAt: start.valueOf(), endAt: start.add(1, 'hour').valueOf() }, e.currentTarget)
              }}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {t('schedule.newEntry')}
            </Button>
          )}
        </Box>

        {/* Nội dung theo view */}
        {view === 'week' && !isMobile && (
          <WeekGrid
            weekStart={anchorDate.startOf('week')}
            entries={entries}
            isLoading={isLoading}
            onSlotClick={(slotStart, anchorEl) => openCreatePopover({ startAt: slotStart.valueOf(), endAt: slotStart.add(1, 'hour').valueOf() }, anchorEl)}
            onEntryClick={openEditPopover}
          />
        )}

        {view === 'month' && !isMobile && (
          <MonthGrid
            anchorDate={anchorDate}
            entries={entries}
            onDayClick={(day, slotStart, anchorEl) => openCreatePopover({ startAt: slotStart.valueOf(), endAt: slotStart.add(1, 'hour').valueOf() }, anchorEl)}
            onEntryClick={openEditPopover}
            onGoWeek={(day) => {
              setAnchorDate(day)
              setView('week')
            }}
          />
        )}

        {view === 'year' && !isMobile && (
          <YearView
            anchorDate={anchorDate}
            entries={entries}
            onDayClick={(day, targetView) => {
              setAnchorDate(day)
              setView(targetView)
            }}
          />
        )}

        {(view === 'day' || isMobile) && (
          <DayAgenda
            day={anchorDate}
            entries={entries}
            onPrev={() => setAnchorDate((prev) => prev.subtract(1, 'day'))}
            onNext={() => setAnchorDate((prev) => prev.add(1, 'day'))}
            onAddClick={(anchorEl) => {
              const start = dayjs().minute(0).second(0).add(1, 'hour')
              openCreatePopover({ startAt: start.valueOf(), endAt: start.add(1, 'hour').valueOf() }, anchorEl)
            }}
            onEntryClick={openEditPopover}
          />
        )}
      </Container>

      {/* Popover tạo/sửa entry */}
      <ScheduleEntryPopover
        state={popoverState}
        onClose={() => setPopoverState(null)}
        onSave={handleSaveEntry}
        onDelete={handleDeleteEntry}
      />
    </Box>
  )
}
