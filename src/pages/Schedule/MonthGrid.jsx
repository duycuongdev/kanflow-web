import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import dayjs from 'dayjs'

import { SCHEDULE_COLOR_PALETTE } from './constants'

const MAX_CHIPS_PER_CELL = 3

export default function MonthGrid({ anchorDate, entries, onDayClick, onEntryClick, onGoWeek }) {
  const { t } = useTranslation()

  // Lưới 6 tuần × 7 ngày bao trọn tháng (bắt đầu từ đầu tuần chứa ngày 1)
  const gridDays = useMemo(() => {
    const gridStart = anchorDate.startOf('month').startOf('week')
    return Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'))
  }, [anchorDate])

  const entriesByDay = useMemo(() => {
    const map = {}
    for (const day of gridDays) {
      const dayStr = day.format('YYYY-MM-DD')
      map[dayStr] = entries.filter((e) => dayjs(e.startAt).format('YYYY-MM-DD') === dayStr)
    }
    return map
  }, [gridDays, entries])

  const todayStr = dayjs().format('YYYY-MM-DD')
  const monthStr = anchorDate.format('YYYY-MM')
  const weekDayLabels = useMemo(() => {
    const monday = dayjs().startOf('week')
    return Array.from({ length: 7 }, (_, i) => monday.add(i, 'day').format('ddd'))
  }, [])

  return (
    <Box sx={{
      bgcolor: (theme) => theme.palette.mode === 'dark' ? '#101828' : '#fff',
      borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
    }}>
      {/* Header thứ trong tuần */}
      <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider' }}>
        {weekDayLabels.map((label) => (
          <Box key={label} sx={{ flex: 1, textAlign: 'center', py: 1 }}>
            <Typography variant='caption' sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 700 }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* 6 hàng tuần */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {gridDays.map((day) => {
          const dayStr = day.format('YYYY-MM-DD')
          const isToday = dayStr === todayStr
          const inMonth = day.format('YYYY-MM') === monthStr
          const dayEntries = entriesByDay[dayStr] || []
          const visibleEntries = dayEntries.slice(0, MAX_CHIPS_PER_CELL)
          const hiddenCount = dayEntries.length - visibleEntries.length

          return (
            <Box
              key={dayStr}
              onClick={(e) => {
                // Click ô trống: tạo entry vào 8h sáng của ngày đó
                const slotStart = day.hour(8).minute(0).second(0)
                onDayClick(day, slotStart, e.currentTarget)
              }}
              sx={{
                minHeight: 108,
                borderBottom: '1px solid', borderRight: '1px solid', borderColor: 'divider',
                px: 0.5, py: 0.5,
                cursor: 'pointer',
                ...(inMonth ? {} : { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }),
                ...(isToday ? { bgcolor: 'rgba(0, 82, 204, 0.06)' } : {}),
                '&:hover': { bgcolor: 'rgba(0, 82, 204, 0.08)' },
                '&:nth-of-type(7n)': { borderRight: 'none' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{
                  fontSize: '0.8rem', fontWeight: isToday ? 800 : 600,
                  ...(isToday ? {
                    color: '#fff', bgcolor: '#0052cc',
                    width: 22, height: 22, borderRadius: '50%',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                  } : {}),
                  ...(inMonth ? {} : { color: 'text.disabled' })
                }}>
                  {day.date()}
                </Typography>
                {isToday && (
                  <Typography variant='caption' sx={{ color: '#0052cc', fontWeight: 700, fontSize: '0.65rem' }}>
                    {t('schedule.today')}
                  </Typography>
                )}
              </Box>

              {/* Entry chips */}
              {visibleEntries.map((entry) => {
                const color = SCHEDULE_COLOR_PALETTE[entry.colorKey] || SCHEDULE_COLOR_PALETTE.blue
                return (
                  <Box
                    key={entry._id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEntryClick(entry, e.currentTarget)
                    }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      bgcolor: `${color}1f`, borderLeft: `2px solid ${color}`,
                      borderRadius: 0.5, px: 0.5, py: '1px', mt: 0.25,
                      cursor: 'pointer',
                      '&:hover': { filter: 'brightness(0.95)' }
                    }}
                  >
                    <Typography sx={{
                      fontSize: '0.68rem', fontWeight: 600, color,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>
                      {dayjs(entry.startAt).format('HH:mm')} {entry.title}
                    </Typography>
                  </Box>
                )
              })}

              {hiddenCount > 0 && (
                <Typography
                  onClick={(e) => {
                    e.stopPropagation()
                    onGoWeek(day)
                  }}
                  sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 0.25, cursor: 'pointer', '&:hover': { color: '#0052cc' } }}
                >
                  {t('schedule.moreEntries', { count: hiddenCount })}
                </Typography>
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
