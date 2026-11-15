import { useState } from 'react'
import Box from '@mui/material/Box'
import Modal from '@mui/material/Modal'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import Typography from '@mui/material/Typography'
import LibraryAddIcon from '@mui/icons-material/LibraryAdd'
import { useForm } from 'react-hook-form'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import FieldErrorAlert from '~/components/Form/FieldErrorAlert'
import AbcIcon from '@mui/icons-material/Abc'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import ViewKanbanIcon from '@mui/icons-material/ViewKanban'
import CropSquareOutlinedIcon from '@mui/icons-material/CropSquareOutlined'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import { createNewBoardAPI } from '~/apis'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

/**
 * CreateBoardModal: Modal tạo Board mới siêu tinh gọn (chỉ Tiêu đề + Mẫu Kanban / Bảng trống),
 * tự động điều hướng vào Board mới tạo và kích hoạt Tour hướng dẫn.
 */
export function CreateBoardModal({ open, onClose, afterCreateNewBoard }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { register, handleSubmit, reset, formState: { errors } } = useForm()
  const [selectedTemplate, setSelectedTemplate] = useState('kanban')

  const handleCloseModal = () => {
    reset()
    setSelectedTemplate('kanban')
    onClose()
  }

  const submitCreateNewBoard = (data) => {
    createNewBoardAPI({
      title: data.title.trim(),
      template: selectedTemplate
    }).then((createdBoard) => {
      handleCloseModal()
      if (createdBoard?._id) {
        // Gắn cờ kích hoạt Tour khi vào board mới
        sessionStorage.setItem('trigger_board_tour', 'true')
        const targetSlug = createdBoard.slug || 'board'
        navigate(`/boards/${createdBoard._id}/${targetSlug}`)
      } else if (afterCreateNewBoard) {
        afterCreateNewBoard()
      }
    })
  }

  return (
    <Modal
      open={open}
      onClose={handleCloseModal}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
    >
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '94%', sm: 540, md: 560 },
        maxHeight: { xs: '92vh', sm: '88vh' },
        overflowY: 'auto',
        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: (theme) => theme.palette.mode === 'dark' ? '#f1f5f9' : '#172b4d',
        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        borderRadius: '12px',
        border: '1px solid',
        borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        outline: 0,
        padding: { xs: '18px 16px', sm: '24px 28px' }
      }}>
        {/* Nút đóng modal góc trên bên phải */}
        <Box sx={{
          position: 'absolute',
          top: '12px',
          right: '12px'
        }}>
          <IconButton size="small" onClick={handleCloseModal} aria-label={t('common.close')}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Tiêu đề modal */}
        <Box id="modal-modal-title" sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1, pr: 4 }}>
          <LibraryAddIcon color="primary" />
          <Typography variant="h6" component="h2" fontWeight={700}>
            {t('boards.createBoardTitle')}
          </Typography>
        </Box>

        <Box id="modal-modal-description" sx={{ my: 2 }}>
          <form onSubmit={handleSubmit(submitCreateNewBoard)}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.2 }}>

              {/* Phần chọn Template (Kanban mẫu vs Bảng trống) - Responsive mobile-first */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.2, color: 'text.secondary' }}>
                  {t('boards.templateLabel')}
                </Typography>

                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.5
                }}>
                  {/* Option 1: Bảng mẫu Kanban (Khuyên dùng) */}
                  <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTemplate('kanban')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedTemplate('kanban')
                      }
                    }}
                    sx={{
                      cursor: 'pointer',
                      p: 1.8,
                      borderRadius: '10px',
                      transition: 'all 0.2s ease',
                      border: '2px solid',
                      borderColor: selectedTemplate === 'kanban'
                        ? 'primary.main'
                        : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                      bgcolor: selectedTemplate === 'kanban'
                        ? (theme) => theme.palette.mode === 'dark' ? 'rgba(0, 82, 204, 0.16)' : '#f0f7ff'
                        : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'transparent',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0, 82, 204, 0.12)' : '#f7faff'
                      },
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 34,
                        height: 34,
                        borderRadius: '8px',
                        bgcolor: 'primary.main',
                        color: '#fff'
                      }}>
                        <ViewKanbanIcon fontSize="small" />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <Chip
                          label={t('boards.templateKanbanRecommended')}
                          size="small"
                          color="primary"
                          sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
                        />
                        {selectedTemplate === 'kanban'
                          ? <CheckCircleIcon color="primary" fontSize="small" />
                          : <RadioButtonUncheckedIcon sx={{ opacity: 0.4 }} fontSize="small" />
                        }
                      </Box>
                    </Box>

                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      {t('boards.templateKanbanTitle')}
                    </Typography>

                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.35 }}>
                      {t('boards.templateKanbanDesc')}
                    </Typography>
                  </Box>

                  {/* Option 2: Bảng trống */}
                  <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTemplate('blank')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedTemplate('blank')
                      }
                    }}
                    sx={{
                      cursor: 'pointer',
                      p: 1.8,
                      borderRadius: '10px',
                      transition: 'all 0.2s ease',
                      border: '2px solid',
                      borderColor: selectedTemplate === 'blank'
                        ? 'primary.main'
                        : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                      bgcolor: selectedTemplate === 'blank'
                        ? (theme) => theme.palette.mode === 'dark' ? 'rgba(0, 82, 204, 0.16)' : '#f0f7ff'
                        : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'transparent',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0, 82, 204, 0.12)' : '#f7faff'
                      },
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 34,
                        height: 34,
                        borderRadius: '8px',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                        color: 'text.secondary'
                      }}>
                        <CropSquareOutlinedIcon fontSize="small" />
                      </Box>
                      {selectedTemplate === 'blank'
                        ? <CheckCircleIcon color="primary" fontSize="small" />
                        : <RadioButtonUncheckedIcon sx={{ opacity: 0.4 }} fontSize="small" />
                      }
                    </Box>

                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      {t('boards.templateBlankTitle')}
                    </Typography>

                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.35 }}>
                      {t('boards.templateBlankDesc')}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Input Tiêu đề bảng */}
              <Box>
                <TextField
                  fullWidth
                  autoFocus
                  label={t('common.title')}
                  type="text"
                  variant="outlined"
                  placeholder={t('boards.boardTitlePlaceholder')}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AbcIcon fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                  {...register('title', {
                    required: t('validation.required'),
                    minLength: { value: 3, message: t('validation.minLength3') },
                    maxLength: { value: 50, message: t('validation.minLength50') }
                  })}
                  error={!!errors['title']}
                />
                <FieldErrorAlert errors={errors} fieldName={'title'} />
              </Box>

              {/* Nút hành động */}
              <Box sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 1.5,
                mt: 1,
                flexDirection: { xs: 'column-reverse', sm: 'row' }
              }}>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={handleCloseModal}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    py: { xs: 1, sm: 0.8 }
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  className="interceptor-loading"
                  type="submit"
                  variant="contained"
                  color="primary"
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 3,
                    py: { xs: 1, sm: 0.8 }
                  }}
                >
                  {t('common.create')}
                </Button>
              </Box>
            </Box>
          </form>
        </Box>
      </Box>
    </Modal>
  )
}
