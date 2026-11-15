import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Portal from '@mui/material/Portal'
import { motion, useDragControls } from 'framer-motion'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'

const PADDING = 6

/**
 * Tìm phần tử DOM THỰC SỰ đang hiển thị trên giao diện (bỏ qua các placeholder ẩn display: none)
 */
const findVisibleElement = (selector) => {
  if (!selector) return null
  const elements = document.querySelectorAll(selector)
  for (const el of elements) {
    if (el.offsetParent === null) continue
    const rect = el.getBoundingClientRect()
    if (rect.width > 24 && rect.height > 24) {
      return el
    }
  }
  return null
}

function GuidedTour({ open, onClose }) {
  const { t } = useTranslation()
  const location = useLocation()
  const [activeStep, setActiveStep] = useState(0)
  const [targetRect, setTargetRect] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  const dragControls = useDragControls()

  const isBoardDetail = useMemo(() => {
    return /^\/boards\/[^/]+/.test(location.pathname)
  }, [location.pathname])

  const steps = useMemo(() => {
    if (isBoardDetail) {
      return [
        {
          target: '[data-tour="board-column"]',
          title: t('guidedTour.columnTitle'),
          description: t('guidedTour.columnDesc'),
          preferredPlacement: 'right'
        },
        {
          target: '[data-tour="board-card"]',
          fallbackTarget: '[data-tour="board-column"]',
          title: t('guidedTour.cardTitle'),
          description: t('guidedTour.cardDesc'),
          preferredPlacement: 'right'
        },
        {
          target: '[data-tour="board-card"]',
          fallbackTarget: '[data-tour="board-column"]',
          title: t('guidedTour.dndTitle'),
          description: t('guidedTour.dndDesc'),
          preferredPlacement: 'bottom'
        },
        {
          target: '[data-tour="add-column-btn"]',
          title: t('guidedTour.addColumnTitle'),
          description: t('guidedTour.addColumnDesc'),
          preferredPlacement: 'left'
        },
        {
          target: '[data-tour="board-tools"]',
          title: t('guidedTour.boardToolsTitle'),
          description: t('guidedTour.boardToolsDesc'),
          preferredPlacement: 'bottom'
        }
      ]
    }

    return [
      {
        target: '[data-tour="appbar-search"]',
        title: t('guidedTour.searchTitle'),
        description: t('guidedTour.searchDesc'),
        preferredPlacement: 'bottom'
      },
      {
        target: '[data-tour="boards-sidebar"]',
        title: t('guidedTour.sidebarTitle'),
        description: t('guidedTour.sidebarDesc'),
        preferredPlacement: 'right'
      },
      {
        target: '[data-tour="create-board-tile"]',
        title: t('guidedTour.createBoardTitle'),
        description: t('guidedTour.createBoardDesc'),
        preferredPlacement: 'bottom'
      },
      {
        target: '[data-tour="boards-grid"]',
        fallbackTarget: '[data-tour="create-board-tile"]',
        title: t('guidedTour.boardsGridTitle'),
        description: t('guidedTour.boardsGridDesc'),
        preferredPlacement: 'top'
      }
    ]
  }, [isBoardDetail, t])

  const currentStepData = steps[activeStep] || steps[0]
  const totalSteps = steps.length
  const isFirstStep = activeStep === 0
  const isLastStep = activeStep === totalSteps - 1

  const updatePosition = useCallback(() => {
    if (!open || !currentStepData) return

    let element = findVisibleElement(currentStepData.target)
    if (!element && currentStepData.fallbackTarget) {
      element = findVisibleElement(currentStepData.fallbackTarget)
    }

    const vw = window.innerWidth
    const vh = window.innerHeight
    const cardWidth = Math.min(380, vw - 32)
    const cardHeight = 220

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      const rect = element.getBoundingClientRect()

      if (rect.width > 24 && rect.height > 24) {
        const top = Math.max(0, rect.top - PADDING)
        const left = Math.max(0, rect.left - PADDING)
        const width = Math.min(vw - left, rect.width + PADDING * 2)
        const height = Math.min(vh - top, rect.height + PADDING * 2)

        setTargetRect({ top, left, width, height })

        let posTop = top + height + 16
        let posLeft = left
        const placement = currentStepData.preferredPlacement || 'bottom'

        // Ưu tiên hiển thị bên phải nếu có đủ chỗ
        if (placement === 'right' && left + width + 16 + cardWidth <= vw - 16) {
          posLeft = left + width + 16
          posTop = Math.max(20, top + (height - cardHeight) / 3)
        }
        // Ưu tiên hiển thị bên trái nếu có đủ chỗ
        else if (placement === 'left' && left - 16 - cardWidth >= 16) {
          posLeft = left - 16 - cardWidth
          posTop = Math.max(20, top + (height - cardHeight) / 3)
        }
        // Hiển thị phía trên nếu ở dưới không đủ chỗ
        else if (posTop + cardHeight > vh - 20) {
          if (top - cardHeight - 16 >= 20) {
            posTop = top - cardHeight - 16
          } else {
            posTop = Math.max(20, (vh - cardHeight) / 2)
          }
        }

        posLeft = Math.max(16, Math.min(posLeft, vw - cardWidth - 16))
        posTop = Math.max(20, Math.min(posTop, vh - cardHeight - 20))

        setTooltipPos({ top: posTop, left: posLeft })
        return
      }
    }

    // Nếu không tìm thấy phần tử hợp lệ -> ẩn viền spotlight, căn thẻ gợi ý ở giữa
    setTargetRect(null)
    setTooltipPos({
      top: Math.max(20, (vh - cardHeight) / 2),
      left: Math.max(16, (vw - cardWidth) / 2)
    })
  }, [open, currentStepData])

  useEffect(() => {
    if (open) {
      const timer = setTimeout(updatePosition, 100)
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('resize', updatePosition)
        window.removeEventListener('scroll', updatePosition, true)
      }
    }
  }, [open, activeStep, updatePosition])

  useEffect(() => {
    if (!open) {
      setActiveStep(0)
      setTargetRect(null)
    }
  }, [open])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!open) return
      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        handlePrev()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, activeStep, isLastStep])

  const handleNext = () => {
    if (isLastStep) {
      handleClose()
    } else {
      setActiveStep(prev => prev + 1)
    }
  }

  const handlePrev = () => {
    if (!isFirstStep) {
      setActiveStep(prev => prev - 1)
    }
  }

  const handleClose = () => {
    setActiveStep(0)
    if (onClose) onClose()
  }

  if (!open) return null

  return (
    <Portal>
      {/* SVG Spotlight Backdrop với viền bo góc transparent hole */}
      <svg
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 99990,
          pointerEvents: 'auto'
        }}
        onClick={handleClose}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="14"
                ry="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.65)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Viền sáng dạ quang (Glowing Neon Border) ôm sát phần tử đang được gợi ý */}
      {targetRect && (
        <Box
          sx={{
            position: 'fixed',
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: '14px',
            border: '2px solid #2dd4bf',
            boxShadow: '0 0 16px rgba(45, 212, 191, 0.6), inset 0 0 10px rgba(45, 212, 191, 0.2)',
            pointerEvents: 'none',
            zIndex: 99995,
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        />
      )}

      {/* Khung gợi ý phong cách Dark Teal, hỗ trợ kéo thả (Draggable) linh hoạt */}
      <motion.div
        key={activeStep}
        drag
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0.08}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: 'calc(100vw - 32px)',
          maxWidth: 380,
          zIndex: 99999,
          pointerEvents: 'auto'
        }}
      >
        <Box
          sx={{
            bgcolor: '#042727',
            backgroundImage: 'linear-gradient(145deg, #072e2d 0%, #031b1a 100%)',
            color: '#ffffff',
            borderRadius: '16px',
            border: '1px solid rgba(45, 212, 191, 0.3)',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.6), 0 0 30px rgba(45, 212, 191, 0.18)',
            p: { xs: 2.2, sm: 2.5 }
          }}
        >
          {/* Header với Drag Handle: kéo thả cả hộp thoại bằng chuột hoặc chạm */}
          <Box
            onPointerDown={(e) => dragControls.start(e)}
            style={{ touchAction: 'none' }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'grab',
              '&:active': { cursor: 'grabbing' },
              mb: 1.2,
              userSelect: 'none',
              pb: 0.5
            }}
          >
            {/* Số thứ tự bước: Bước x/y */}
            <Typography
              sx={{
                color: '#2dd4bf',
                fontSize: '0.82rem',
                fontWeight: 700,
                letterSpacing: '0.5px'
              }}
            >
              {t('guidedTour.stepCount', { current: activeStep + 1, total: totalSteps })}
            </Typography>

            {/* Pill kéo thả trực quan */}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.3,
                borderRadius: '12px',
                bgcolor: 'rgba(45, 212, 191, 0.12)',
                color: '#2dd4bf',
                fontSize: '0.72rem',
                fontWeight: 600,
                transition: 'background-color 0.2s',
                '&:hover': { bgcolor: 'rgba(45, 212, 191, 0.22)' }
              }}
            >
              <DragIndicatorIcon sx={{ fontSize: '15px' }} />
              <span>{t('guidedTour.dragToMove')}</span>
            </Box>
          </Box>

        {/* Tiêu đề hướng dẫn */}
        <Typography
          sx={{
            color: '#ffffff',
            fontSize: { xs: '1.02rem', sm: '1.1rem' },
            fontWeight: 700,
            lineHeight: 1.35,
            mb: 1
          }}
        >
          {currentStepData.title}
        </Typography>

        {/* Nội dung mô tả chi tiết */}
        <Typography
          sx={{
            color: '#cbd5e1',
            fontSize: '0.875rem',
            lineHeight: 1.55,
            mb: 2.5
          }}
        >
          {currentStepData.description}
        </Typography>

        {/* Cụm nút hành động phía dưới: Bỏ qua - Quay lại - Tiếp */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1
          }}
        >
          {/* Nút Bỏ qua */}
          <Button
            onClick={handleClose}
            sx={{
              color: '#94a3b8',
              textTransform: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              p: '4px 8px',
              minWidth: 'auto',
              '&:hover': {
                color: '#ffffff',
                bgcolor: 'transparent'
              }
            }}
          >
            {t('guidedTour.skip')}
          </Button>

          {/* Cụm nút Quay lại & Tiếp */}
          <Stack direction="row" spacing={1} alignItems="center">
            {activeStep > 0 && (
              <Button
                onClick={handlePrev}
                sx={{
                  color: '#f1f5f9',
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  textTransform: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  borderRadius: '9999px',
                  px: 1.8,
                  py: 0.6,
                  minWidth: 'auto',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.18)'
                  }
                }}
              >
                {t('guidedTour.back')}
              </Button>
            )}

            <Button
              onClick={handleNext}
              sx={{
                color: '#042727',
                bgcolor: '#14b8a6',
                textTransform: 'none',
                fontSize: '0.82rem',
                fontWeight: 700,
                borderRadius: '9999px',
                px: 2.2,
                py: 0.6,
                boxShadow: '0 2px 10px rgba(20, 184, 166, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                '&:hover': {
                  bgcolor: '#2dd4bf'
                }
              }}
            >
              {isLastStep ? (
                <span>{t('guidedTour.finish')}</span>
              ) : (
                <>
                  <span>{t('guidedTour.next')}</span>
                  <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>→</span>
                </>
              )}
            </Button>
          </Stack>
        </Box>
      </Box>
    </motion.div>
  </Portal>
  )
}

export default GuidedTour
