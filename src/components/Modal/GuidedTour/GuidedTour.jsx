import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Portal from '@mui/material/Portal'

const PADDING = 8

function GuidedTour({ open, onClose }) {
  const { t } = useTranslation()
  const location = useLocation()
  const [activeStep, setActiveStep] = useState(0)
  const [targetRect, setTargetRect] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })

  const isBoardDetail = useMemo(() => {
    return /^\/boards\/[^/]+/.test(location.pathname)
  }, [location.pathname])

  const steps = useMemo(() => {
    if (isBoardDetail) {
      return [
        {
          target: '[data-tour="board-bar"]',
          title: t('guidedTour.boardBarTitle'),
          description: t('guidedTour.boardBarDesc'),
          preferredPlacement: 'bottom'
        },
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
          target: '[data-tour="board-content"]',
          title: t('guidedTour.dndTitle'),
          description: t('guidedTour.dndDesc'),
          preferredPlacement: 'top'
        },
        {
          target: '[data-tour="add-column-btn"]',
          title: t('guidedTour.addColumnTitle'),
          description: t('guidedTour.addColumnDesc'),
          preferredPlacement: 'left'
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

    let element = document.querySelector(currentStepData.target)
    if (!element && currentStepData.fallbackTarget) {
      element = document.querySelector(currentStepData.fallbackTarget)
    }

    const vw = window.innerWidth
    const vh = window.innerHeight
    const cardWidth = Math.min(380, vw - 32)
    const cardHeight = 240

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      const rect = element.getBoundingClientRect()

      const top = Math.max(0, rect.top - PADDING)
      const left = Math.max(0, rect.left - PADDING)
      const width = Math.min(vw - left, rect.width + PADDING * 2)
      const height = Math.min(vh - top, rect.height + PADDING * 2)

      setTargetRect({ top, left, width, height })

      let posTop = top + height + 16
      let posLeft = left

      if (posTop + cardHeight > vh - 20) {
        if (top - cardHeight - 16 > 20) {
          posTop = top - cardHeight - 16
        } else {
          posTop = Math.max(20, (vh - cardHeight) / 2)
        }
      }

      posLeft = Math.max(16, Math.min(posLeft, vw - cardWidth - 16))
      posTop = Math.max(16, Math.min(posTop, vh - cardHeight - 16))

      setTooltipPos({ top: posTop, left: posLeft })
    } else {
      setTargetRect(null)
      setTooltipPos({
        top: Math.max(20, (vh - cardHeight) / 2),
        left: Math.max(16, (vw - cardWidth) / 2)
      })
    }
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
                rx="18"
                ry="18"
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

      {/* Viền sáng dạ quang (Glowing Neon Border) quanh đối tượng được gợi ý */}
      {targetRect && (
        <Box
          sx={{
            position: 'fixed',
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: '18px',
            border: '2px solid #2dd4bf',
            boxShadow: '0 0 18px rgba(45, 212, 191, 0.6), inset 0 0 12px rgba(45, 212, 191, 0.2)',
            pointerEvents: 'none',
            zIndex: 99995,
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        />
      )}

      {/* Khung gợi ý phong cách Dark Teal với Step, Title, Desc và nút điều hướng */}
      <Box
        sx={{
          position: 'fixed',
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: { xs: 'calc(100vw - 32px)', sm: 380 },
          maxWidth: '92vw',
          bgcolor: '#042727',
          backgroundImage: 'linear-gradient(145deg, #072e2d 0%, #031b1a 100%)',
          color: '#ffffff',
          borderRadius: '16px',
          border: '1px solid rgba(45, 212, 191, 0.3)',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.6), 0 0 30px rgba(45, 212, 191, 0.18)',
          p: { xs: 2.2, sm: 2.5 },
          zIndex: 99999,
          pointerEvents: 'auto',
          transition: 'top 0.3s cubic-bezier(0.16, 1, 0.3, 1), left 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Số thứ tự bước: Bước x/y */}
        <Typography
          sx={{
            color: '#2dd4bf',
            fontSize: '0.82rem',
            fontWeight: 700,
            letterSpacing: '0.5px',
            mb: 0.8
          }}
        >
          {t('guidedTour.stepCount', { current: activeStep + 1, total: totalSteps })}
        </Typography>

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
    </Portal>
  )
}

export default GuidedTour
