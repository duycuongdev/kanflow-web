import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import dayjs from 'dayjs'

import { getHolidaysForYear } from './holidays'
import { SCHEDULE_COLOR_PALETTE } from './constants'

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

/**
 * Mini month cho Year view: lưới ngày nhỏ, ngày lễ tô đỏ, ngày có lịch = chấm màu
 */
function MiniMonth({ monthDate, entries, holidayMap, onDayClick }) {
  const { t } = useTranslation()
  const todayStr = dayjs().format('YYYY-MM-DD')

  // Ô trống đầu tuần (tuần bắt đầu thứ 2) + các ngày trong tháng
  const cells = useMemo(() => {
    const firstDay = monthDate.startOf('month')
    const leadingBlanks = (firstDay.day() + 6) % 7 // day(): 0=CN..6=T7 → Mon-based offset
    const blanks = Array.from({ length: leadingBlanks }, () => null)
    const monthDays = Array.from({ length: monthDate.daysInMonth() }, (_, i) => firstDay.add(i, 'day'))
    return [...blanks, ...monthDays]
  }, [monthDate])

  // Đếm số entry theo ngày trong tháng này
  const entryCountByDay = useMemo(() => {
    const map = {}
    for (const entry of entries) {
      const key = dayjs(entry.startAt).format('YYYY-MM-DD')
      map[key] = (map[key] || 0) + 1
    }
    return map
  }, [entries])

  return (
    <Box sx={{
      bgcolor: (theme) => theme.palette.mode === 'dark' ? '#101828' : '#fff',
      borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.25
    }}>
      <Typography
        onClick={(e) => { e.stopPropagation(); onDayClick(monthDate.startOf('month'), 'month') }}
        sx={{
          fontWeight: 700, fontSize: '0.9rem', textTransform: 'capitalize', mb: 0.75, cursor: 'pointer',
          color: monthDate.isSame(dayjs(), 'month') ? '#0052cc' : 'text.primary',
          '&:hover': { textDecoration: 'underline' }
        }}
      >
        {monthDate.format('MMMM')}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.25 }}>
        {WEEKDAY_LABELS.map((label) => (
          <Typography key={label} sx={{ fontSize: '0.58rem', color: 'text.secondary', textAlign: 'center', fontWeight: 600 }}>
            {label}
          </Typography>
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: '1px' }}>
        {cells.map((day, index) => {
          if (!day) return <Box key={`blank-${index}`} sx={{ height: 26 }} />
          const dayStr = day.format('YYYY-MM-DD')
          const holiday = holidayMap.get(dayStr)
          const isToday = dayStr === todayStr
          const count = entryCountByDay[dayStr] || 0
          const textColor = holiday ? '#ff5630' : (day.day() === 0 ? 'rgba(255,86,48,0.65)' : 'text.primary')
          return (
            <Box
              key={dayStr}
              onClick={(e) => { e.stopPropagation(); onDayClick(day, 'day') }}
              title={holiday?.name || (count > 0 ? `${count} ${t('schedule.entriesTitle')}` : undefined)}
              sx={{
                position: 'relative',
                height: 26, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                borderRadius: 0.75, cursor: 'pointer',
                ...(isToday ? { border: '1.5px solid #0052cc' } : {}),
                ...(count > 0 && !holiday ? { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,82,204,0.18)' : 'rgba(0,82,204,0.08)' } : {}),
                ...(holiday ? { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,86,48,0.16)' : 'rgba(255,86,48,0.08)' } : {}),
                '&:hover': { bgcolor: 'rgba(0, 82, 204, 0.15)' }
              }}
            >
              <Typography sx={{ fontSize: '0.68rem', color: textColor, fontWeight: isToday ? 800 : 500, lineHeight: 1 }}>
                {day.date()}
              </Typography>
              {count > 0 && !holiday && (
                <Box sx={{
                  position: 'absolute', bottom: 1, width: 4, height: 4, borderRadius: '50%',
                  bgcolor: SCHEDULE_COLOR_PALETTE.blue
                }} />
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

/**
 * View năm: 12 mini-month, hiển thị ngày lễ + ngày có lịch
 */
export default function YearView({ anchorDate, entries, onDayClick }) {
  const holidayMap = useMemo(() => getHolidaysForYear(anchorDate.year()), [anchorDate])
  const months = useMemo(() => (
    Array.from({ length: 12 }, (_, i) => anchorDate.startOf('year').add(i, 'month'))
  ), [anchorDate])

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 1.5 }}>
      {months.map((monthDate) => (
        <MiniMonth
          key={monthDate.format('YYYY-MM')}
          monthDate={monthDate}
          entries={entries}
          holidayMap={holidayMap}
          onDayClick={onDayClick}
        />
      ))}
    </Box>
  )
}
