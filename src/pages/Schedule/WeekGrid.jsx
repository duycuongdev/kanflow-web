import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import dayjs from 'dayjs'

import { SCHEDULE_COLOR_PALETTE } from './constants'

const HOUR_HEIGHT = 48 // px cho 1 giờ
const GUTTER_WIDTH = 56 // cột nhãn giờ bên trái
const HOURS = Array.from({ length: 24 }, (_, i) => i)

/**
 * Chia các entry overlap thành nhiều cột song song trong cùng 1 ngày.
 * Trả về mảng entry kèm { columnIndex, columnCount } để render width/left.
 */
const layoutEntriesForDay = (dayEntries) => {
  const sorted = [...dayEntries].sort((a, b) => a.startAt - b.startAt || a.endAt - b.endAt)
  const result = []

  // Tách các cluster (nhóm entry giao nhau liên tiếp)
  let cluster = []
  let clusterEnd = 0
  const flushCluster = () => {
    if (cluster.length === 0) return
    // Gán column index: với mỗi entry, chọn column nhỏ nhất còn trống (theo endAt đã qua)
    const columnEnds = [] // endAt của entry cuối mỗi column
    const assigned = []
    for (const entry of cluster) {
      let col = columnEnds.findIndex((end) => end <= entry.startAt)
      if (col === -1) {
        col = columnEnds.length
        columnEnds.push(entry.endAt)
      } else {
        columnEnds[col] = entry.endAt
      }
      assigned.push({ ...entry, columnIndex: col })
    }
    const columnCount = columnEnds.length
    assigned.forEach((entry) => result.push({ ...entry, columnCount }))
    cluster = []
    clusterEnd = 0
  }

  for (const entry of sorted) {
    if (cluster.length > 0 && entry.startAt >= clusterEnd) {
      flushCluster()
    }
    cluster.push(entry)
    clusterEnd = Math.max(clusterEnd, entry.endAt)
  }
  flushCluster()

  return result
}

export default function WeekGrid({ weekStart, entries, isLoading, onSlotClick, onEntryClick }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day')), [weekStart])
  const todayStr = dayjs(now).format('YYYY-MM-DD')

  // Nhóm entry theo ngày + layout overlap
  const entriesByDay = useMemo(() => {
    const map = {}
    for (const day of weekDays) {
      const dayStr = day.format('YYYY-MM-DD')
      const dayEntries = entries.filter((e) =>
        dayjs(e.startAt).format('YYYY-MM-DD') === dayStr ||
        dayjs(e.endAt).format('YYYY-MM-DD') === dayStr
      )
      map[dayStr] = layoutEntriesForDay(dayEntries)
    }
    return map
  }, [weekDays, entries])

  // Vị trí đường "bây giờ" (nếu tuần này có hôm nay)
  const nowTop = (() => {
    const nowDayjs = dayjs(now)
    if (!weekDays.some((d) => d.format('YYYY-MM-DD') === todayStr)) return null
    return (nowDayjs.hour() + nowDayjs.minute() / 60) * HOUR_HEIGHT
  })()

  const handleColumnClick = (e, day) => {
    // Bỏ qua nếu click vào entry (entry tự stopPropagation)
    if (e.defaultPrevented) return
    const bodyRect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - bodyRect.top
    // Snap theo 30 phút
    const slotMinutes = Math.max(0, Math.floor((offsetY / HOUR_HEIGHT) / 0.5)) * 30
    const slotStart = day.startOf('day').add(slotMinutes, 'minute')
    onSlotClick(slotStart, e.currentTarget)
  }

  return (
    <Box sx={{
      bgcolor: (theme) => theme.palette.mode === 'dark' ? '#101828' : '#fff',
      borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
    }}>
      {/* Header ngày */}
      <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ width: GUTTER_WIDTH, flexShrink: 0 }} />
        {weekDays.map((day) => {
          const isToday = day.format('YYYY-MM-DD') === todayStr
          return (
            <Box
              key={day.format('YYYY-MM-DD')}
              sx={{
                flex: 1, textAlign: 'center', py: 1,
                borderLeft: '1px solid', borderColor: 'divider',
                ...(isToday ? { bgcolor: 'rgba(0, 82, 204, 0.08)' } : {})
              }}
            >
              <Typography variant='caption' sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600 }}>
                {day.format('ddd')}
              </Typography>
              <Typography sx={{
                fontWeight: isToday ? 800 : 600,
                fontSize: '1.05rem',
                ...(isToday ? {
                  color: '#fff', bgcolor: '#0052cc',
                  width: 30, height: 30, borderRadius: '50%',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  ml: 0.5
                } : {})
              }}>
                {day.date()}
              </Typography>
            </Box>
          )
        })}
      </Box>

      {/* Body: nhãn giờ + 7 cột */}
      <Box sx={{ position: 'relative' }}>
        {isLoading && (
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center',
            justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.06)'
          }}>
            <CircularProgress size={28} />
          </Box>
        )}

        <Box sx={{ display: 'flex', maxHeight: 'calc(100dvh - 220px)', overflowY: 'auto' }}>
          {/* Cột nhãn giờ */}
          <Box sx={{ width: GUTTER_WIDTH, flexShrink: 0 }}>
            {HOURS.map((hour) => (
              <Box key={hour} sx={{ height: HOUR_HEIGHT }}>
                <Typography
                  variant='caption'
                  sx={{ color: 'text.secondary', display: 'block', transform: 'translateY(-6px)', pr: 1, textAlign: 'right' }}
                >
                  {hour > 0 ? `${String(hour).padStart(2, '0')}:00` : ''}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* 7 cột ngày */}
          {weekDays.map((day) => {
            const dayStr = day.format('YYYY-MM-DD')
            const isToday = dayStr === todayStr
            const dayEntries = entriesByDay[dayStr] || []
            return (
              <Box
                key={dayStr}
                onClick={(e) => handleColumnClick(e, day)}
                sx={{
                  flex: 1, position: 'relative', cursor: 'pointer',
                  borderLeft: '1px solid', borderColor: 'divider',
                  ...(isToday ? { bgcolor: 'rgba(0, 82, 204, 0.04)' } : {}),
                  '&:hover': { bgcolor: 'rgba(0, 82, 204, 0.06)' }
                }}
              >
                {/* Lưới kẻ giờ */}
                {HOURS.map((hour) => (
                  <Box
                    key={hour}
                    sx={{
                      height: HOUR_HEIGHT,
                      borderBottom: '1px solid',
                      borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                      pointerEvents: 'none'
                    }}
                  />
                ))}

                {/* Đường "bây giờ" */}
                {isToday && nowTop !== null && (
                  <Box sx={{
                    position: 'absolute', left: 0, right: 0, top: nowTop,
                    height: 2, bgcolor: '#ff5630', zIndex: 3, pointerEvents: 'none',
                    '&::before': {
                      content: '""', position: 'absolute', left: -5, top: -3,
                      width: 8, height: 8, borderRadius: '50%', bgcolor: '#ff5630'
                    }
                  }} />
                )}

                {/* Entries */}
                {dayEntries.map((entry) => {
                  const entryStart = dayjs(entry.startAt)
                  const entryEnd = dayjs(entry.endAt)
                  // Entry có thể tràn từ ngày khác sang: kẹp hiển thị trong biên ngày này
                  const dayStart = day.startOf('day')
                  const dayEnd = day.endOf('day')
                  const clippedStart = entryStart.isBefore(dayStart) ? dayStart : entryStart
                  const clippedEnd = entryEnd.isAfter(dayEnd) ? dayEnd : entryEnd
                  const top = (clippedStart.hour() + clippedStart.minute() / 60) * HOUR_HEIGHT
                  const height = Math.max(
                    22,
                    (clippedEnd.diff(clippedStart, 'minute') / 60) * HOUR_HEIGHT
                  )
                  const color = SCHEDULE_COLOR_PALETTE[entry.colorKey] || SCHEDULE_COLOR_PALETTE.blue
                  const widthPct = 100 / (entry.columnCount || 1)
                  const leftPct = widthPct * (entry.columnIndex || 0)

                  return (
                    <Box
                      key={entry._id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEntryClick(entry, e.currentTarget)
                      }}
                      sx={{
                        position: 'absolute',
                        top, height, left: `${leftPct + 1}%`, width: `calc(${widthPct}% - 4px)`,
                        zIndex: 2,
                        bgcolor: `${color}1f`,
                        borderLeft: `3px solid ${color}`,
                        borderRadius: 1,
                        px: 0.75, py: 0.25,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                        '&:hover': { transform: 'scale(1.01)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 4 }
                      }}
                    >
                      <Typography sx={{
                        fontSize: '0.72rem', fontWeight: 700, color,
                        whiteSpace: height > 30 ? 'nowrap' : 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3
                      }}>
                        {height > 34 && `${entryStart.format('HH:mm')} `}
                        {entry.title}
                      </Typography>
                      {height > 48 && entry.cardTitle && (
                        <Typography sx={{
                          fontSize: '0.68rem', color: 'text.secondary',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          🎯 {entry.cardTitle}
                        </Typography>
                      )}
                    </Box>
                  )
                })}
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* Hint */}
      <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant='caption' sx={{ color: 'text.secondary' }}>
          {t('schedule.weekHint')}
        </Typography>
      </Box>
    </Box>
  )
}
