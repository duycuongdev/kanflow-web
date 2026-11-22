import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import dayjs from 'dayjs'

import { getHolidaysForYear } from './holidays'
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

export default function WeekGrid({ weekStart, entries, isLoading, onSlotClick, onEntryClick, onEntryDrop }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(Date.now())
  // Slot đang hover: { dayStr, hour } - highlight đúng 1 khung giờ (vd 9:00-10:00)
  const [hoveredSlot, setHoveredSlot] = useState(null)
  // Phiên kéo entry: ghost hiển thị ở { dayStr, topMin }; moved = đã kéo thật
  const [dragPreview, setDragPreview] = useState(null)
  const dragSessionRef = useRef(null)
  const suppressClickRef = useRef(false)

  const scrollBodyRef = useRef(null)
  // Bản ghost đang hiển thị (dùng ở pointerup để tính vị trí thả cuối)
  const dragPreviewStateRef = useRef(null)
  useEffect(() => { dragPreviewStateRef.current = dragPreview }, [dragPreview])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day')), [weekStart])
  const todayStr = dayjs(now).format('YYYY-MM-DD')
  const holidayMap = useMemo(() => getHolidaysForYear(weekStart.year()), [weekStart])

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

  // Tự cuộn tới khung giờ hiện tại (hoặc 8h sáng) khi mở lưới / đổi tuần
  useEffect(() => {
    const body = scrollBodyRef.current
    if (!body) return
    const nowDayjs = dayjs()
    const isThisWeek = weekDays.some((d) => d.format('YYYY-MM-DD') === nowDayjs.format('YYYY-MM-DD'))
    const targetHour = isThisWeek ? Math.max(0, nowDayjs.hour() - 2) : 7
    body.scrollTop = targetHour * HOUR_HEIGHT
    // weekDays đổi theo weekStart - mỗi lần đổi tuần cuộn lại
  }, [weekDays])

  // ==================== Kéo-thả entry để dời giờ/ngày ====================
  // Nhấn giữ entry -> pointermove (window) tính cột ngày + khung giờ mới (snap 30') ->
  // thả ra -> onEntryDrop(entry, newStartMs) để parent gọi API lưu.

  const handleEntryMouseDown = (e, entry) => {
    if (e.button !== 0) return
    // Không kéo khi bấm vào phần tử con tương tác (nếu có)
    const rect = e.currentTarget.getBoundingClientRect()
    const grabOffsetMin = Math.max(0, ((e.clientY - rect.top) / HOUR_HEIGHT) * 60)
    dragSessionRef.current = {
      entry,
      grabOffsetMin,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false
    }
  }

  useEffect(() => {
    const onPointerMove = (e) => {
      const session = dragSessionRef.current
      if (!session) return
      if (!session.moved && Math.hypot(e.clientX - session.startClientX, e.clientY - session.startClientY) < 4) return
      session.moved = true

      const el = document.elementFromPoint(e.clientX, e.clientY)
      const col = el?.closest('[data-day-col]')
      if (!col) return
      const dayStr = col.getAttribute('data-day-col')
      const colRect = col.getBoundingClientRect()
      const durationMin = Math.max(1, Math.round((session.entry.endAt - session.entry.startAt) / 60000))
      const rawMinutes = ((e.clientY - colRect.top) / HOUR_HEIGHT) * 60 - session.grabOffsetMin
      const snapped = Math.max(0, Math.min(24 * 60 - durationMin, Math.round(rawMinutes / 30) * 30))
      setDragPreview({ entryId: session.entry._id, dayStr, topMin: snapped, durationMin })
    }

    const onPointerUp = () => {
      const session = dragSessionRef.current
      if (!session) return
      dragSessionRef.current = null

      if (session.moved) {
        // Chặn click mở popover / tạo lịch ngay sau khi kéo
        suppressClickRef.current = true
        setTimeout(() => { suppressClickRef.current = false }, 50)
        const preview = dragPreviewStateRef.current
        if (preview) {
          const dayStr = preview.dayStr
          const day = weekDays.find((d) => d.format('YYYY-MM-DD') === dayStr)
          if (day) {
            const newStartMs = day.startOf('day').valueOf() + preview.topMin * 60000
            onEntryDrop(session.entry, newStartMs)
          }
        }
      }
      setDragPreview(null)
      setHoveredSlot(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [weekDays, dragPreviewStateRef, onEntryDrop])

  const handleColumnMouseMove = (e, day) => {
    const bodyRect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - bodyRect.top
    const hour = Math.max(0, Math.min(23, Math.floor(offsetY / HOUR_HEIGHT)))
    setHoveredSlot({ dayStr: day.format('YYYY-MM-DD'), hour })
  }

  const handleColumnLeave = () => {
    setHoveredSlot(null)
  }

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
      {/* MỘT scroll container duy nhất chứa header (sticky) + body ⇒ header và 7 cột
          luôn thẳng hàng (không bị lệch do scrollbar chiếm chỗ) */}
      <Box ref={scrollBodyRef} sx={{ maxHeight: 'calc(100dvh - 220px)', overflowY: 'auto', position: 'relative' }}>
        {isLoading && (
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 6, display: 'flex', alignItems: 'center',
            justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.06)'
          }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {/* Header ngày - sticky nằm TRONG scroll container */}
        <Box sx={{
          display: 'flex',
          position: 'sticky', top: 0, zIndex: 4,
          bgcolor: (theme) => theme.palette.mode === 'dark' ? '#101828' : '#fff',
          borderBottom: '1px solid', borderColor: 'divider'
        }}>
          <Box sx={{ width: GUTTER_WIDTH, flexShrink: 0 }} />
          {weekDays.map((day) => {
            const dayStr = day.format('YYYY-MM-DD')
            const isToday = dayStr === todayStr
            const holiday = holidayMap.get(dayStr)
            return (
              <Box
                key={dayStr}
                sx={{
                  flex: 1, textAlign: 'center', py: 0.75,
                  borderLeft: '1px solid', borderColor: 'divider',
                  ...(isToday ? { bgcolor: 'rgba(0, 82, 204, 0.08)' } : {})
                }}
              >
                <Typography variant='caption' sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, display: 'block', lineHeight: 1.4 }}>
                  {day.format('ddd')}
                </Typography>
                <Typography sx={{
                  fontWeight: isToday ? 800 : 600,
                  fontSize: '1.05rem',
                  display: 'inline-block',
                  ...(isToday ? {
                    color: '#fff', bgcolor: '#0052cc',
                    width: 30, height: 30, borderRadius: '50%',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                  } : {})
                }}>
                  {day.date()}
                </Typography>
                {holiday && (
                  <Typography sx={{
                    fontSize: '0.6rem', color: '#ff5630', fontWeight: 600,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', px: 0.5
                  }}>
                    {holiday.name}
                  </Typography>
                )}
              </Box>
            )
          })}
        </Box>

        {/* Body: nhãn giờ + 7 cột ngày */}
        <Box sx={{ display: 'flex' }}>
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
            const hoveredHour = hoveredSlot?.dayStr === dayStr ? hoveredSlot.hour : null
            return (
              <Box
                key={dayStr}
                data-day-col={dayStr}
                onMouseMove={(e) => { if (!dragSessionRef.current) handleColumnMouseMove(e, day) }}
                onMouseLeave={handleColumnLeave}
                onClick={(e) => { if (!suppressClickRef.current) handleColumnClick(e, day) }}
                sx={{
                  flex: 1, position: 'relative', cursor: 'pointer',
                  borderLeft: '1px solid', borderColor: 'divider',
                  ...(isToday ? { bgcolor: 'rgba(0, 82, 204, 0.04)' } : {})
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

                {/* Highlight khung giờ đang hover (vd 9:00-10:00) */}
                {hoveredHour !== null && (
                  <Box sx={{
                    position: 'absolute', left: 0, right: 0,
                    top: hoveredHour * HOUR_HEIGHT, height: HOUR_HEIGHT,
                    bgcolor: 'rgba(0, 82, 204, 0.10)',
                    border: '1px dashed rgba(0, 82, 204, 0.35)',
                    borderRadius: 0.5,
                    pointerEvents: 'none',
                    zIndex: 1
                  }}>
                    <Typography variant='caption' sx={{
                      position: 'absolute', top: 2, left: 4,
                      fontSize: '0.6rem', color: '#0052cc', fontWeight: 600
                    }}>
                      {String(hoveredHour).padStart(2, '0')}:00 – {String((hoveredHour + 1) % 24).padStart(2, '0')}:00
                    </Typography>
                  </Box>
                )}

                {/* Ghost của entry đang được kéo tới cột này */}
                {dragPreview && dragPreview.dayStr === dayStr && (
                  <Box sx={{
                    position: 'absolute',
                    top: dragPreview.topMin / 60 * HOUR_HEIGHT,
                    height: dragPreview.durationMin / 60 * HOUR_HEIGHT,
                    left: '2%', width: '96%',
                    zIndex: 3, pointerEvents: 'none',
                    border: '2px dashed rgba(0, 82, 204, 0.6)',
                    borderRadius: 1,
                    bgcolor: 'rgba(0, 82, 204, 0.10)'
                  }}>
                    <Typography variant='caption' sx={{
                      position: 'absolute', top: 2, left: 4,
                      fontSize: '0.65rem', color: '#0052cc', fontWeight: 700
                    }}>
                      {dayjs(day.startOf('day').valueOf() + dragPreview.topMin * 60000).format('HH:mm')}
                    </Typography>
                  </Box>
                )}

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
                      onMouseDown={(e) => handleEntryMouseDown(e, entry)}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (suppressClickRef.current) return
                        onEntryClick(entry, e.currentTarget)
                      }}
                      sx={{
                        position: 'absolute',
                        top, height, left: `${leftPct + 1}%`, width: `calc(${widthPct}% - 4px)`,
                        zIndex: dragPreview?.entryId === entry._id ? 1 : 2,
                        opacity: dragPreview?.entryId === entry._id ? 0.3 : 1,
                        bgcolor: `${color}1f`,
                        borderLeft: `3px solid ${color}`,
                        borderRadius: 1,
                        px: 0.75, py: 0.25,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                        '&:hover': { transform: 'scale(1.01)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 5 }
                      }}
                    >
                      <Typography sx={{
                        fontSize: '0.72rem', fontWeight: 700, color,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3
                      }}>
                        {height > 34 && `${entryStart.format('HH:mm')} `}
                        {entry.title}
                      </Typography>
                      {height > 48 && entry.itemTitle && (
                        <Typography sx={{
                          fontSize: '0.68rem', color: 'text.secondary',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          📌 {entry.itemTitle}
                        </Typography>
                      )}
                      {height > 48 && !entry.itemTitle && entry.cardTitle && (
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
