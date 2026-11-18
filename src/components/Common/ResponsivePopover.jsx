import Box from '@mui/material/Box'
import Popover from '@mui/material/Popover'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

/**
 * ResponsivePopover:
 * - Desktop (sm+): render MUI Popover bình thường neo theo anchorEl.
 * - Mobile (xs): tự động chuyển sang Bottom Sheet (SwipeableDrawer) vuốt xuống để đóng,
 *   tối ưu thao tác 1 ngón cái và hỗ trợ safe-area iOS/Android.
 */
function ResponsivePopover({
  open,
  anchorEl,
  onClose,
  children,
  PaperProps,
  slotProps,
  ...restProps
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  if (isMobile) {
    return (
      <SwipeableDrawer
        anchor="bottom"
        open={Boolean(open)}
        onClose={onClose}
        onOpen={() => {}}
        disableSwipeToOpen
        ModalProps={{ keepMounted: false }}
        sx={{ zIndex: 1400 }}
        PaperProps={{
          sx: {
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            maxHeight: '85dvh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: (t) => (t.palette.mode === 'dark' ? '#1e293b' : '#ffffff'),
            paddingBottom: 'env(safe-area-inset-bottom, 0px)'
          }
        }}
      >
        {/* Thanh nắm kéo chuẩn Bottom Sheet Mobile */}
        <Box
          onClick={onClose}
          sx={{
            pt: 1.25,
            pb: 0.75,
            display: 'flex',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer'
          }}
        >
          <Box sx={{
            width: 40,
            height: 4,
            borderRadius: 2,
            bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.2)')
          }} />
        </Box>

        {/* Nội dung có thể cuộn bên trong Bottom Sheet */}
        <Box sx={{
          overflowY: 'auto',
          flex: 1,
          width: '100%',
          '& > .MuiBox-root': {
            width: '100% !important',
            maxWidth: '100% !important',
            maxHeight: 'none !important'
          }
        }}>
          {children}
        </Box>
      </SwipeableDrawer>
    )
  }

  return (
    <Popover
      open={Boolean(open)}
      anchorEl={anchorEl}
      onClose={onClose}
      PaperProps={PaperProps}
      slotProps={slotProps}
      {...restProps}
    >
      {children}
    </Popover>
  )
}

export default ResponsivePopover
