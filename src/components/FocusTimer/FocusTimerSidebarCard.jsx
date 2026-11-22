import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import TimerRoundedIcon from '@mui/icons-material/TimerRounded'

/**
 * Mục "Focus Timer" trên sidebar trang Boards - chỉ icon + chữ,
 * bấm vào mở trang Focus (/focus) để setup và chạy chuỗi tập trung.
 */
export default function FocusTimerSidebarCard() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Box
      onClick={() => navigate('/focus')}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'pointer',
        color: (themeBg) => themeBg.palette.mode === 'dark' ? '#cbd5e1' : '#172b4d',
        padding: '12px 16px',
        borderRadius: '8px',
        fontWeight: 500,
        fontSize: '0.875rem',
        transition: 'all 0.15s ease',
        '&:hover': {
          backgroundColor: (themeBg) => themeBg.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
        }
      }}
    >
      <TimerRoundedIcon fontSize='small' />
      {t('focusTimer.title')}
    </Box>
  )
}
