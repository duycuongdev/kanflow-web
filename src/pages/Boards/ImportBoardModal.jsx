import { useState, useRef } from 'react'
import Box from '@mui/material/Box'
import Modal from '@mui/material/Modal'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import Typography from '@mui/material/Typography'
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined'
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined'
import { importBoardAPI } from '~/apis'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

export function ImportBoardModal({ open, onClose, afterImportBoard }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [file, setFile] = useState(null)
  const [boardData, setBoardData] = useState(null)
  const [editedTitle, setEditedTitle] = useState('')
  const [parseError, setParseError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const handleReset = () => {
    setFile(null)
    setBoardData(null)
    setEditedTitle('')
    setParseError('')
    setIsSubmitting(false)
    setIsDragging(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    if (isSubmitting) return
    handleReset()
    onClose()
  }

  const processFile = (selectedFile) => {
    if (!selectedFile) return
    setParseError('')

    if (!selectedFile.name.endsWith('.json')) {
      setParseError(t('boards.importInvalidFileType'))
      return
    }

    setFile(selectedFile)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result)
        if (!json || typeof json !== 'object' || !json.title) {
          setParseError(t('boards.importMissingTitleError'))
          setBoardData(null)
          return
        }
        setBoardData(json)
        setEditedTitle(json.title || '')
      } catch (err) {
        setParseError(t('boards.importJsonParseError'))
        setBoardData(null)
      }
    }
    reader.readAsText(selectedFile)
  }

  const handleFileInputChange = (e) => {
    const selectedFile = e.target.files?.[0]
    processFile(selectedFile)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files?.[0]
    processFile(droppedFile)
  }

  const handleImport = async () => {
    const trimmedTitle = editedTitle.trim()
    if (!boardData || !trimmedTitle) {
      toast.error(t('boards.importTitleRequired'))
      return
    }

    if (trimmedTitle.length < 3) {
      toast.error(t('validation.minLength3'))
      return
    }

    if (trimmedTitle.length > 50) {
      toast.error(t('validation.minLength50'))
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        title: trimmedTitle,
        columns: boardData.columns || []
      }

      const createdBoard = await importBoardAPI(payload)
      handleClose()

      if (createdBoard?._id) {
        const targetSlug = createdBoard.slug || 'board'
        navigate(`/boards/${createdBoard._id}/${targetSlug}`)
      } else if (afterImportBoard) {
        afterImportBoard()
      }
    } catch (_error) {
      // Thông báo lỗi API đã được interceptor authorizedAxios hiển thị tự động,
      // không gọi toast.error ở đây để tránh bị thông báo trùng lặp 2 lần cùng lúc
    } finally {
      setIsSubmitting(false)
    }
  }

  // Thống kê sơ bộ
  const totalColumns = boardData?.columns?.length || 0
  const totalCards = boardData?.columns?.reduce((sum, col) => sum + (col.cards?.length || 0), 0) || 0

  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby="import-board-modal-title"
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
        p: { xs: '18px 16px', sm: '24px 28px' }
      }}>
        {/* Nút đóng modal */}
        <Box sx={{ position: 'absolute', top: '12px', right: '12px' }}>
          <IconButton size="small" onClick={handleClose} disabled={isSubmitting} aria-label={t('common.close')}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Tiêu đề modal */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1, pr: 4 }}>
          <FileUploadOutlinedIcon color="primary" sx={{ fontSize: 28 }} />
          <Typography id="import-board-modal-title" variant="h6" fontWeight={700}>
            {t('boards.importBoardTitle')}
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          {t('boards.importBoardSubtitle')}
        </Typography>

        {/* Lỗi nếu file không hợp lệ */}
        {parseError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
            {parseError}
          </Alert>
        )}

        {/* Khu vực kéo thả / chọn file */}
        {!boardData ? (
          <Box
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: '2px dashed',
              borderColor: isDragging ? '#0052cc' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : '#d0d7de',
              bgcolor: isDragging ? 'rgba(0, 82, 204, 0.08)' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fafbfc',
              borderRadius: '12px',
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#0052cc',
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0, 82, 204, 0.1)' : 'rgba(0, 82, 204, 0.04)'
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />
            <InsertDriveFileOutlinedIcon sx={{ fontSize: 48, color: '#0052cc', mb: 1 }} />
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
              {t('boards.importDropzoneTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('boards.importDropzoneHint')}
            </Typography>
          </Box>
        ) : (
          /* Xem trước dữ liệu và cho phép chỉnh sửa tiêu đề */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: '10px',
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                {t('boards.importFilePreview')} ({file?.name})
              </Typography>

              <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                <Chip
                  icon={<ViewColumnOutlinedIcon sx={{ fontSize: '16px !important' }} />}
                  label={`${totalColumns} ${t('boards.importColumns')}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  icon={<DashboardCustomizeOutlinedIcon sx={{ fontSize: '16px !important' }} />}
                  label={`${totalCards} ${t('boards.importCards')}`}
                  size="small"
                  variant="outlined"
                />
                {boardData.exportedAt && (
                  <Chip
                    label={`${t('boards.importExportedAt')}: ${new Date(boardData.exportedAt).toLocaleDateString()}`}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Stack>

              {/* Danh sách tên cột xem trước */}
              {totalColumns > 0 && (
                <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', mb: 1 }}>
                  {boardData.columns.map((c, i) => (
                    <Box
                      key={i}
                      sx={{
                        fontSize: '0.75rem',
                        px: 1,
                        py: 0.3,
                        borderRadius: '6px',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                        color: 'text.primary',
                        fontWeight: 600
                      }}
                    >
                      {c.title} ({c.cards?.length || 0})
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* Tiêu đề bảng */}
            <TextField
              fullWidth
              size="small"
              label={t('common.title')}
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              placeholder={t('boards.boardTitlePlaceholder')}
              required
              inputProps={{ minLength: 3, maxLength: 50 }}
            />

            {/* Nút hành động */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Button
                variant="text"
                size="small"
                onClick={handleReset}
                disabled={isSubmitting}
                sx={{ textTransform: 'none' }}
              >
                {t('boards.importChooseDifferentFile')}
              </Button>

              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  sx={{ textTransform: 'none' }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleImport}
                  disabled={isSubmitting || !editedTitle.trim()}
                  startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <FileUploadOutlinedIcon />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(0, 82, 204, 0.3)'
                  }}
                >
                  {isSubmitting ? t('boards.importing') : t('boards.importSubmit')}
                </Button>
              </Stack>
            </Box>
          </Box>
        )}
      </Box>
    </Modal>
  )
}
export default ImportBoardModal
