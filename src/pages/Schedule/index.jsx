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
import AddRoundedIcon from '@mui/icons-material/AddRounded'

import AppBar from '~/components/AppBar/AppBar'
import WeekGrid from './WeekGrid'
import MonthGrid from './MonthGrid'
import DayAgenda from './DayAgenda'
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

  const [view, setView] = useState('week') // 'week' | 'month'
  const [anchorDate, setAnchorDate] = useState(() => dayjs())

  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Popover tạo/sửa entry: { mode: 'create'|'edit', entry?, draft?: {startAt,endAt}, anchorEl }
  const [popoverState, setPopoverState] = useState(null)

  const entriesRef = useRef(null)
  entriesRef.current = entries

  // ==================== Range hiển thị ====================

  // Week view: tuần bắt đầu từ thứ 2 (dayjs locale 'vi' weekStart = 1); Month view: cả tháng + đệm các ngày tràn
  const displayRange = useMemo(() => {
    if (view === 'month') {
      const gridStart = anchorDate.startOf('month').startOf('week')
      const gridEnd = anchorDate.endOf('month').endOf('week')
      return { from: gridStart.valueOf(), to: gridEnd.valueOf() + 1 }
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
    setAnchorDate((prev) => (view === 'month' ? prev.subtract(1, 'month') : prev.subtract(1, 'week')))
  }
  const goNext = () => {
    setAnchorDate((prev) => (view === 'month' ? prev.add(1, 'month') : prev.add(1, 'week')))
  }
  const goToday = () => setAnchorDate(dayjs())

  const headerLabel = useMemo(() => {
    if (view === 'month') return anchorDate.format('MMMM YYYY')
    const weekStart = anchorDate.startOf('week')
    const weekEnd = anchorDate.endOf('week')
    return `${weekStart.format('MMM D')} – ${weekEnd.format('MMM D, YYYY')}`
  }, [anchorDate, view])

  // Mobile: agenda theo ngày
  const mobileDay = anchorDate

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
              <ToggleButton value='week' aria-label={t('schedule.viewWeek')}>
                <ViewWeekRoundedIcon sx={{ fontSize: 18, mr: 0.5 }} /> {t('schedule.viewWeek')}
              </ToggleButton>
              <ToggleButton value='month' aria-label={t('schedule.viewMonth')}>
                <CalendarViewMonthRoundedIcon sx={{ fontSize: 18, mr: 0.5 }} /> {t('schedule.viewMonth')}
              </ToggleButton>
            </ToggleButtonGroup>
          )}

          {!isMobile && (
            <Button
              variant='contained'
              startIcon={<AddRoundedIcon />}
              onClick={(e) => {
                // Mặc định tạo entry vào khung giờ tròn tiếp theo của hôm nay
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

        {isMobile && (
          <DayAgenda
            day={mobileDay}
            entries={entries}
            onPrev={() => setAnchorDate((prev) => prev.subtract(1, 'day'))}
            onNext={() => setAnchorDate((prev) => prev.add(1, 'day'))}
            onAddClick={(anchorEl) => {
              const start = dayjs().minute(0).second(0).add(1, 'hour')
              openCreatePopover({ startAt: start.valueOf(), endAt: start.add(1, 'hour').valueOf() }, anchorEl)
            }}
            onEntryClick={(entry, anchorEl) => openEditPopover(entry, anchorEl)}
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
