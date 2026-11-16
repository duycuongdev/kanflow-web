import { useState } from 'react'
import Box from '@mui/material/Box'
import Modal from '@mui/material/Modal'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import CircularProgress from '@mui/material/CircularProgress'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import Collapse from '@mui/material/Collapse'
import { aiGenerateBoardAPI } from '~/apis'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

const SUGGESTED_PROMPTS = [
  'Lộ trình học AI Engineer trong 2 tháng (Python, LLM, Agent, MCP)',
  'Kế hoạch ra mắt sản phẩm Web MVP trong 4 tuần',
  'Chiến dịch Marketing đa kênh cho sản phẩm mới',
  'Quy trình Sprint phát triển phần mềm Agile 2 tuần'
]

export function AiCreateBoardModal({ open, onClose, afterCreateBoard }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [prompt, setPrompt] = useState('')
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('trello_gemini_api_key') || '')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClose = () => {
    if (isSubmitting) return
    setPrompt('')
    onClose()
  }

  const handleSaveApiKey = (key) => {
    setCustomApiKey(key)
    if (key.trim()) {
      localStorage.setItem('trello_gemini_api_key', key.trim())
    } else {
      localStorage.removeItem('trello_gemini_api_key')
    }
  }

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) {
      toast.error(t('boards.aiPromptRequired', 'Vui lòng nhập mô tả bảng bạn muốn tạo'))
      return
    }

    if (trimmedPrompt.length < 5) {
      toast.error(t('boards.aiPromptMinLength', 'Mô tả phải có ít nhất 5 ký tự'))
      return
    }

    setIsSubmitting(true)
    try {
      const createdBoard = await aiGenerateBoardAPI({
        prompt: trimmedPrompt,
        customApiKey: customApiKey.trim() || undefined
      })

      handleClose()

      if (createdBoard?._id) {
        const targetSlug = createdBoard.slug || 'board'
        navigate(`/boards/${createdBoard._id}/${targetSlug}`)
      } else if (afterCreateBoard) {
        afterCreateBoard()
      }
    } catch (_error) {
      // Error is centrally displayed by authorizedAxios interceptor
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby="ai-create-board-modal-title"
    >
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '94%', sm: 540, md: 580 },
        maxHeight: { xs: '92vh', sm: '88vh' },
        overflowY: 'auto',
        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: (theme) => theme.palette.mode === 'dark' ? '#f1f5f9' : '#172b4d',
        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        borderRadius: '14px',
        border: '1px solid',
        borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        outline: 0,
        p: { xs: '20px 18px', sm: '28px 30px' }
      }}>
        {/* Nút đóng modal */}
        <Box sx={{ position: 'absolute', top: '14px', right: '14px' }}>
          <IconButton size="small" onClick={handleClose} disabled={isSubmitting} aria-label={t('common.close')}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Tiêu đề modal kèm icon AI Gradient */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, pr: 4 }}>
          <Box sx={{
            width: 38,
            height: 38,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)'
          }}>
            <AutoAwesomeIcon sx={{ fontSize: 22 }} />
          </Box>
          <Typography id="ai-create-board-modal-title" variant="h6" fontWeight={700}>
            {t('boards.aiCreateBoardTitle', 'Tạo bảng bằng AI')}
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.5 }}>
          {t('boards.aiCreateBoardSubtitle', 'Mô tả dự án hoặc mục tiêu của bạn bằng ngôn ngữ tự nhiên. AI sẽ tự động phân tích và sinh toàn bộ cột workflow, thẻ công việc, nhãn và checklist chi tiết.')}
        </Typography>

        {/* Form nhập Prompt */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={3}
            autoFocus
            disabled={isSubmitting}
            label={t('boards.aiPromptLabel', 'Ý tưởng hoặc yêu cầu của bạn')}
            placeholder={t('boards.aiPromptPlaceholder', 'VD: Lập kế hoạch học AI Engineer trong 2 tháng với lộ trình từng tuần kèm bài tập thực hành...')}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                handleGenerate()
              }
            }}
          />

          {/* Gợi ý prompt mẫu 1-click */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.8 }}>
              {t('boards.aiPromptSuggestions', 'Gợi ý nhanh:')}
            </Typography>
            <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap', gap: 0.8 }}>
              {SUGGESTED_PROMPTS.map((suggested, idx) => (
                <Chip
                  key={idx}
                  label={suggested}
                  size="small"
                  onClick={() => setPrompt(suggested)}
                  disabled={isSubmitting}
                  sx={{
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    maxWidth: '100%',
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    '&:hover': {
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(168, 85, 247, 0.1)',
                      borderColor: '#a855f7'
                    }
                  }}
                />
              ))}
            </Stack>
          </Box>

          {/* Cấu hình Custom Gemini API Key (Tùy chọn) */}
          <Box sx={{ mt: 0.5 }}>
            <Button
              size="small"
              variant="text"
              startIcon={<VpnKeyOutlinedIcon fontSize="small" />}
              onClick={() => setShowKeyInput(!showKeyInput)}
              sx={{ textTransform: 'none', fontSize: '0.8rem', color: 'text.secondary', p: 0 }}
            >
              {showKeyInput ? t('boards.aiHideApiKey', 'Ẩn cấu hình API Key') : t('boards.aiCustomApiKey', 'Cung cấp Gemini API Key cá nhân (Tùy chọn)')}
            </Button>

            <Collapse in={showKeyInput}>
              <Box sx={{ mt: 1, p: 1.5, borderRadius: '8px', bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: '1px solid', borderColor: 'divider' }}>
                <TextField
                  fullWidth
                  size="small"
                  type="password"
                  label={t('boards.aiApiKeyLabel', 'Gemini API Key (Tùy chọn)')}
                  placeholder="AIzaSy..."
                  value={customApiKey}
                  onChange={(e) => handleSaveApiKey(e.target.value)}
                  helperText={t('boards.aiApiKeyHelper', 'Nếu server chưa cấu hình biến GEMINI_API_KEY, bạn có thể nhập key cá nhân từ Google AI Studio (miễn phí). Key được lưu trong trình duyệt của bạn.')}
                />
              </Box>
            </Collapse>
          </Box>

          {/* Loading indicator khi AI đang generate */}
          {isSubmitting && (
            <Box sx={{
              p: 2,
              borderRadius: '10px',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(168, 85, 247, 0.12)' : 'rgba(168, 85, 247, 0.08)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5
            }}>
              <CircularProgress size={22} sx={{ color: '#a855f7' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#a855f7' }}>
                {t('boards.aiGeneratingStatus', 'AI đang suy luận cấu trúc các cột, phân rã công việc và sinh checklist...')}
              </Typography>
            </Box>
          )}

          {/* Nút hành động */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.2, mt: 1 }}>
            <Button
              variant="outlined"
              onClick={handleClose}
              disabled={isSubmitting}
              sx={{ textTransform: 'none', borderRadius: '8px' }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={isSubmitting || !prompt.trim()}
              startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #db2777 100%)',
                  boxShadow: '0 6px 18px rgba(168, 85, 247, 0.5)'
                }
              }}
            >
              {isSubmitting ? t('boards.aiGenerating', 'Đang tạo bảng...') : t('boards.aiGenerateSubmit', 'Tạo bảng với AI')}
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  )
}

export default AiCreateBoardModal
