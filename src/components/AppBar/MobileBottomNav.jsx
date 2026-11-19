import { Link, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { selectCurrentActiveBoard } from '~/redux/activeBoard/activeBoardSlice'
import Notifications from './Notifications/Notifications'
import Profile from './Menus/Profile'

/**
 * Thanh điều hướng dưới cùng cho MOBILE (ẩn từ sm trở lên) - chuẩn UX mobile app:
 * các tab chính nằm trong vùng ngón tay thay vì trên đầu.
 * Gồm: Boards | Notifications | Account (tái sử dụng nguyên Notifications & Profile).
 * Chừa safe-area-inset-bottom để không bị home indicator của iPhone che.
 */
function MobileBottomNav({ onOpenTour, onOpenShortcuts }) {
  const { t } = useTranslation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const location = useLocation()
  const activeBoard = useSelector(selectCurrentActiveBoard)

  // Trên desktop (sm trở lên), không mount MobileBottomNav vào DOM để tránh gọi trùng API Notifications/Profile
  if (!isMobile) return null

  // Kính mờ chỉ khi đang ở board chi tiết có ảnh nền (không kéo sang trang danh sách)
  const onBoardWithImage = /^\/boards\/[^/]+/.test(location.pathname) && Boolean(activeBoard?.background)
  const isBoardsActive = location.pathname === '/boards' || location.pathname === '/boards/'

  return (
    <Box sx={{
      display: { xs: 'flex', sm: 'none' },
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1100,
      alignItems: 'center',
      justifyContent: 'space-around',
      // PWA standalone (iPhone): chừa chỗ cho home indicator
      height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      bgcolor: onBoardWithImage
        ? 'rgba(0, 0, 0, 0.58)'
        : (theme) => (theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.94)' : 'rgba(0, 82, 204, 0.96)'),
      backdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(255, 255, 255, 0.16)',
      boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.14)'
    }}>
      <TabLink
        to="/boards/"
        icon={<SpaceDashboardIcon />}
        label={t('appBar.boardList')}
        active={isBoardsActive}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: 68, transition: 'transform 0.12s ease', '&:active': { transform: 'scale(0.93)' } }}>
        <Notifications openUpward />
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 500, lineHeight: 1, color: '#ffffff' }}>
          {t('appBar.notifications')}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: 68, transition: 'transform 0.12s ease', '&:active': { transform: 'scale(0.93)' } }}>
        <Profile onOpenTour={onOpenTour} onOpenShortcuts={onOpenShortcuts} openUpward />
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 500, lineHeight: 1, color: '#ffffff' }}>
          {t('profileMenu.profile')}
        </Typography>
      </Box>
    </Box>
  )
}

function TabLink({ to, icon, label, active = false }) {
  return (
    <Box
      component={Link}
      to={to}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        minWidth: 68,
        py: 0.75,
        color: '#ffffff',
        textDecoration: 'none',
        transition: 'transform 0.12s ease',
        '&:active': { transform: 'scale(0.93)' }
      }}
    >
      {/* Hàng icon cao cố định 36px để icon thẳng hàng icon, chữ thẳng hàng chữ trên cả 3 tab */}
      <Box sx={{
        height: 36,
        px: 1.75,
        borderRadius: 99,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: active ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
        transition: 'background-color 0.2s ease'
      }}>
        {icon}
      </Box>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: active ? 700 : 500, lineHeight: 1, color: '#ffffff' }}>
        {label}
      </Typography>
    </Box>
  )
}

export default MobileBottomNav
