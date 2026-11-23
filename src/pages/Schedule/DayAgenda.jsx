import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import dayjs from 'dayjs'

import { getHolidaysForYear } from './holidays'
import { SCHEDULE_COLOR_PALETTE } from './constants'

import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'

/**
 * View mobile: danh sách entry theo 1 ngày + điều hướng ‹ ›
 */
export default function DayAgenda({ day, entries, onPrev, onNext, onAddClick, onEntryClick }) {
  const { t } = useTranslation()

  const holiday = getHolidaysForYear(day.year()).get(day.format('YYYY-MM-DD'))

  const dayEntries = entries
    .filter((e) => dayjs(e.startAt).format('YYYY-MM-DD') === day.format('YYYY-MM-DD'))
    .sort((a, b) => dayjs(a.startAt).valueOf() - dayjs(b.startAt).valueOf())

  return (
    <Box>
      {/* Thanh điều hướng ngày */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <IconButton onClick={onPrev} aria-label={t('schedule.prev')}>
          <ChevronLeftRoundedIcon />
        </IconButton>
        <Typography sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
          {day.format('dddd, DD MMM YYYY')}
        </Typography>
        <IconButton onClick={onNext} aria-label={t('schedule.next')}>
          <ChevronRightRoundedIcon />
        </IconButton>
      </Box>

      {/* Banner ngày lễ */}
      {holiday && (
        <Box sx={{
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,86,48,0.14)' : 'rgba(255,86,48,0.08)',
          border: '1px solid rgba(255,86,48,0.35)',
          borderRadius: 2, px: 2, py: 1.25, mb: 1.5
        }}>
          <Typography sx={{ color: '#ff5630', fontWeight: 700, fontSize: '0.9rem' }}>
            🎉 {holiday.name}
          </Typography>
        </Box>
      )}

      {/* Danh sách entry */}
      {dayEntries.length === 0 && (
        <Box sx={{
          textAlign: 'center', py: 6,
          bgcolor: (theme) => theme.palette.mode === 'dark' ? '#101828' : '#fff',
          borderRadius: 2
        }}>
          <Typography sx={{ fontSize: 40, mb: 1 }}>🗓️</Typography>
          <Typography sx={{ color: 'text.secondary', mb: 2 }}>
            {t('schedule.noEntries')}
          </Typography>
        </Box>
      )}

      {dayEntries.map((entry) => {
        const color = SCHEDULE_COLOR_PALETTE[entry.colorKey] || SCHEDULE_COLOR_PALETTE.blue
        return (
          <Box
            key={entry._id}
            onClick={(e) => onEntryClick(entry, e.currentTarget)}
            sx={{
              display: 'flex', gap: 1.5, alignItems: 'flex-start',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? '#101828' : '#fff',
              borderRadius: 2, p: 1.5, mb: 1,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              cursor: 'pointer',
              borderLeft: `4px solid ${color}`,
              '&:active': { transform: 'scale(0.99)' }
            }}
          >
            <Box sx={{ minWidth: 64 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {dayjs(entry.startAt).format('HH:mm')}
              </Typography>
              <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                → {dayjs(entry.endAt).format('HH:mm')}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {entry.title}
              </Typography>
              {entry.description && (
                <Typography variant='caption' sx={{ color: 'text.secondary', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.description}
                </Typography>
              )}
              {entry.itemTitle && (
                <Chip size='small' label={`📌 ${entry.itemTitle}`} sx={{ mt: 0.5, mr: 0.5, height: 20, fontSize: '0.7rem', bgcolor: 'rgba(0,82,204,0.1)' }} />
              )}
              {entry.cardTitle && (
                <Chip size='small' label={`🎯 ${entry.cardTitle}`} sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }} />
              )}
            </Box>
          </Box>
        )
      })}

      {/* Nút thêm entry */}
      <Button
        fullWidth
        variant='contained'
        startIcon={<AddRoundedIcon />}
        onClick={(e) => onAddClick(e.currentTarget)}
        sx={{ mt: 1.5, textTransform: 'none', fontWeight: 700, py: 1.2 }}
      >
        {t('schedule.newEntry')}
      </Button>
    </Box>
  )
}
