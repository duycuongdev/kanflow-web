import { useState, useRef, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Fab from '@mui/material/Fab'
import InputBase from '@mui/material/InputBase'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { motion, AnimatePresence } from 'framer-motion'
import dayjs from 'dayjs'
import MDEditor from '@uiw/react-md-editor'

import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded'
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'

import KanflowIcon from '~/components/Icons/KanflowIcon'
import { selectCurrentActiveBoard, fetchBoardDetailsAPI } from '~/redux/activeBoard/activeBoardSlice'
import { selectCurrentUser } from '~/redux/user/userSlice'
import { chatWithAiCopilotAPI, closeBoardAPI } from '~/apis'
import { getPageLoading, subscribePageLoading } from '~/utils/pageLoadingState'

const MAX_ATTACHMENTS = 5
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export default function AiCopilotWidget() {
  const { t, i18n } = useTranslation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const currentUser = useSelector(selectCurrentUser)
  const currentBoard = useSelector(selectCurrentActiveBoard)

  const [isPageLoading, setIsPageLoading] = useState(getPageLoading())

  useEffect(() => {
    const unsubscribe = subscribePageLoading(setIsPageLoading)
    return unsubscribe
  }, [])

  const shouldHideWidget = isPageLoading

  // Khóa localStorage cho lịch sử trò chuyện theo từng người dùng
  const historyStorageKey = currentUser?._id
    ? `kanflow_copilot_history_${currentUser._id}`
    : 'kanflow_copilot_history_guest'

  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attachments, setAttachments] = useState([])

  // Khởi tạo tin nhắn từ localStorage hoặc tin nhắn chào ban đầu
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(historyStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {
      // ignore storage load error
    }
    return [
      {
        id: 'welcome-msg',
        isWelcome: true,
        role: 'assistant',
        content: t('copilot.greeting'),
        timestamp: Date.now()
      }
    ]
  })

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

  // Đồng bộ lịch sử khi người dùng đổi tài khoản đăng nhập
  useEffect(() => {
    try {
      const saved = localStorage.getItem(historyStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
          return
        }
      }
    } catch {
      // ignore
    }
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        isWelcome: true,
        role: 'assistant',
        content: t('copilot.greeting'),
        timestamp: Date.now()
      }
    ])
  }, [historyStorageKey, t])

  // Lưu lịch sử vào localStorage mỗi khi messages thay đổi (giữ tối đa 40 tin nhắn mới nhất)
  useEffect(() => {
    if (!messages || messages.length === 0) return
    try {
      const toSave = messages.slice(-40)
      localStorage.setItem(historyStorageKey, JSON.stringify(toSave))
    } catch {
      // ignore storage save error
    }
  }, [messages, historyStorageKey])

  // Tự động cập nhật nội dung tin nhắn chào hỏi khi đổi ngôn ngữ
  useEffect(() => {
    setMessages(prev => prev.map(m => (m.isWelcome || m.id?.startsWith('welcome'))
      ? { ...m, content: t('copilot.greeting') }
      : m
    ))
  }, [i18n.language, t])

  // Tự động cuộn xuống cuối mỗi khi có tin nhắn mới hoặc thêm tệp đính kèm
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen, messages, scrollToBottom])

  // Xử lý đọc file thành Base64 và URL xem trước
  const processFiles = useCallback((fileList) => {
    const filesArray = Array.from(fileList || [])
    if (filesArray.length === 0) return

    if (attachments.length + filesArray.length > MAX_ATTACHMENTS) {
      toast.warning(t('copilot.maxFilesExceeded'))
      return
    }

    filesArray.forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(t('copilot.fileTooLarge', { name: file.name }))
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result
        const base64 = typeof dataUrl === 'string' && dataUrl.includes(',')
          ? dataUrl.split(',')[1]
          : ''

        const newAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name || 'clipboard-image.png',
          mimeType: file.type || 'image/png',
          base64,
          dataUrl,
          isImage: file.type?.startsWith('image/')
        }

        setAttachments(prev => {
          if (prev.length >= MAX_ATTACHMENTS) return prev
          return [...prev, newAttachment]
        })
      }

      reader.readAsDataURL(file)
    })
  }, [attachments.length, t])

  // Lắng nghe sự kiện paste ảnh từ clipboard (Ctrl+V)
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageFiles = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type && item.type.indexOf('image') !== -1) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault()
      processFiles(imageFiles)
    }
  }, [processFiles])

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
      e.target.value = '' // Reset input để cho phép chọn lại cùng file
    }
  }

  const handleRemoveAttachment = (idToRemove) => {
    setAttachments(prev => prev.filter(att => att.id !== idToRemove))
  }

  if (!currentUser) return null

  const handleSendMessage = async (textToSend, { attachmentsOverride = null, failedMsgId = null } = {}) => {
    let query = (textToSend || inputValue || '').trim()

    // Nếu không nhập nội dung text nhưng có đính kèm file, dùng câu hỏi mặc định
    if (!query && attachments.length > 0) {
      query = t('copilot.defaultAttachmentPrompt')
    }

    if (!query || isLoading) return

    const currentAttachments = attachmentsOverride ?? [...attachments]
    const userMessageId = `user-${Date.now()}`
    const newUserMsg = {
      id: userMessageId,
      role: 'user',
      content: query,
      attachments: currentAttachments,
      timestamp: Date.now()
    }

    // Cập nhật tin nhắn người dùng ngay lập tức & dọn dẹp input
    // (đang GỬI LẠI thì bỏ tin nhắn lỗi cũ)
    const baseMessages = failedMsgId ? messages.filter((m) => m.id !== failedMsgId) : messages
    const updatedMessages = [...baseMessages, newUserMsg]
    setMessages(updatedMessages)
    setInputValue('')
    setAttachments([])
    setIsLoading(true)

    try {
      // Chuẩn bị payload gửi lên backend (lịch sử tối đa 6 lượt)
      const historyPayload = updatedMessages
        .slice(-6)
        .map(m => ({
          role: m.role,
          content: m.content,
          attachments: (m.attachments || []).map(a => ({
            name: a.name,
            mimeType: a.mimeType
          }))
        }))

      const currentLang = i18n.language?.startsWith('vi') ? 'vi' : 'en'

      const attachmentsPayload = currentAttachments.map(att => ({
        name: att.name,
        mimeType: att.mimeType,
        base64: att.base64,
        dataUrl: att.dataUrl
      }))

      const response = await chatWithAiCopilotAPI({
        message: query,
        history: historyPayload,
        currentBoardId: currentBoard?._id || null,
        language: currentLang,
        attachments: attachmentsPayload,
        // Giờ máy client để AI giải mã các mốc thời gian tương đối ("ngày mai 9h"...)
        localNowISO: dayjs().format()
      })

      const botMessageId = `bot-${Date.now()}`
      const botMsg = {
        id: botMessageId,
        role: 'assistant',
        content: response.message || '',
        action: response.action || null,
        actionResult: response.actionResult || null,
        timestamp: Date.now()
      }

      setMessages(prev => [...prev, botMsg])

      // Nếu action là tạo card/column hoặc đặt hạn chót trên board hiện tại, reload lại board
      if (['CARD_CREATED', 'COLUMN_CREATED', 'CARDS_DUE_DATE_UPDATED', 'COLUMN_UPDATED', 'COLUMN_ARCHIVED', 'COLUMN_RESTORED', 'CARD_UPDATED', 'CARD_ARCHIVED', 'CARD_RESTORED', 'CARD_MEMBER_ADDED', 'CARD_MEMBER_REMOVED', 'BOARD_REOPENED'].includes(response.actionResult?.type)) {
        if (currentBoard?._id) {
          dispatch(fetchBoardDetailsAPI(currentBoard._id))
        }
      }
    } catch (err) {
      // Đánh dấu tin nhắn gửi thất bại -> hiện nút "Gửi lại" ngay dưới tin nhắn
      const reason = err?.response?.data?.message || err?.message || t('copilot.errorOccurred')
      setMessages(prev => prev.map((m) => (m.id === userMessageId ? { ...m, failed: true, failedReason: reason } : m)))
    } finally {
      setIsLoading(false)
    }
  }

  // Gửi lại 1 tin nhắn đã thất bại: xóa tin lỗi rồi gửi lại nguyên nội dung + attachments
  const handleResendMessage = (msg) => {
    if (isLoading) return
    const attachmentsForResend = (msg.attachments || []).map((a) => ({
      name: a.name,
      mimeType: a.mimeType,
      base64: a.base64,
      dataUrl: a.dataUrl
    }))
    handleSendMessage(msg.content, { attachmentsOverride: attachmentsForResend, failedMsgId: msg.id })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleClearHistory = () => {
    try {
      localStorage.removeItem(historyStorageKey)
    } catch {
      // ignore
    }
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        isWelcome: true,
        role: 'assistant',
        content: t('copilot.greeting'),
        timestamp: Date.now()
      }
    ])
    setAttachments([])
  }

  const quickPrompts = [
    t('copilot.quickPrompt1'),
    t('copilot.quickPrompt2'),
    t('copilot.quickPrompt3'),
    t('copilot.quickPrompt4')
  ]

  const canSend = (Boolean(inputValue.trim()) || attachments.length > 0) && !isLoading

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <AnimatePresence>
        {!isOpen && !shouldHideWidget && (
          <motion.div
            key="ai-copilot-fab"
            initial={{ opacity: 0, scale: 0.5, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            style={{
              position: 'fixed',
              bottom: isMobile ? 'calc(76px + env(safe-area-inset-bottom, 0px))' : 48,
              right: isMobile ? 16 : 24,
              zIndex: 1200
            }}
          >
            <Tooltip title={t('copilot.tooltip')} placement="left" arrow>
              <Fab
                size={isMobile ? 'medium' : 'large'}
                aria-label={t('copilot.title')}
                onClick={() => setIsOpen(true)}
                sx={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #4f46e5 50%, #7c3aed 100%)',
                  color: 'white',
                  boxShadow: '0 8px 24px rgba(79, 70, 229, 0.45)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'scale(1.08)',
                    boxShadow: '0 12px 32px rgba(79, 70, 229, 0.65)'
                  }
                }}
              >
                <KanflowIcon sx={{ fontSize: isMobile ? 24 : 28 }} />
              </Fab>
            </Tooltip>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Copilot Chat Window */}
      {isOpen && !shouldHideWidget && (
        <Paper
          elevation={12}
          onPaste={handlePaste}
          sx={{
            position: 'fixed',
            top: { xs: 0, sm: 'auto' },
            bottom: { xs: 0, sm: 24 },
            right: { xs: 0, sm: 24 },
            left: { xs: 0, sm: 'auto' },
            width: { xs: '100vw', sm: 420 },
            // Dùng 100dvh để khi bàn phím ảo mobile bật lên, ô nhập chat tự co giãn và không bị che
            height: { xs: '100dvh', sm: 600 },
            maxHeight: { xs: '100dvh', sm: 'min(640px, calc(100dvh - 48px))' },
            borderRadius: { xs: 0, sm: 3.5 },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 1350,
            border: (t) => ({ xs: 'none', sm: `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}` }),
            boxShadow: (t) => t.palette.mode === 'dark'
              ? '0 16px 40px rgba(0,0,0,0.7), 0 0 20px rgba(79, 70, 229, 0.25)'
              : '0 16px 40px rgba(15, 23, 42, 0.22), 0 0 20px rgba(79, 70, 229, 0.15)',
            bgcolor: (t) => t.palette.mode === 'dark' ? '#0f172a' : '#ffffff'
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: 2,
              pt: { xs: 'calc(12px + env(safe-area-inset-top, 0px))', sm: 1.5 },
              pb: 1.5,
              background: 'linear-gradient(135deg, #0284c7 0%, #4f46e5 50%, #7c3aed 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
              flexShrink: 0
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <KanflowIcon sx={{ fontSize: 28, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
              <Typography sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                {t('copilot.title')}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Tooltip title={t('copilot.clearHistory')} arrow>
                <IconButton
                  size={isMobile ? 'medium' : 'small'}
                  aria-label={t('copilot.clearHistory')}
                  onClick={handleClearHistory}
                  sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
                >
                  <DeleteSweepRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title={t('copilot.close')} arrow>
                <IconButton
                  size={isMobile ? 'medium' : 'small'}
                  aria-label={t('copilot.close')}
                  onClick={() => setIsOpen(false)}
                  sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
                >
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Current Board Context Tag */}
          {currentBoard?.title && (
            <Box
              sx={{
                px: 2,
                py: 0.75,
                bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.08)',
                borderBottom: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.15)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <Typography sx={{ fontSize: '0.75rem', color: (t) => t.palette.mode === 'dark' ? '#818cf8' : '#4f46e5', fontWeight: 600 }}>
                📌 {t('copilot.activeBoardContext', { title: currentBoard.title })}
              </Typography>
            </Box>
          )}

          {/* Messages Body */}
          <Box
            sx={{
              flex: 1,
              p: 2,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.75,
              bgcolor: (t) => t.palette.mode === 'dark' ? '#0b1120' : '#f8fafc'
            }}
          >
            {messages.map((msg) => {
              const isUser = msg.role === 'user'

              return (
                <Box
                  key={msg.id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '100%'
                  }}
                >
                  <Box
                    sx={{
                      maxWidth: '88%',
                      p: 1.5,
                      borderRadius: 2.5,
                      ...(isUser
                        ? {
                          bgcolor: '#6366f1',
                          color: '#ffffff',
                          borderBottomRightRadius: 4
                        }
                        : {
                          bgcolor: (t) => t.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
                          color: (t) => t.palette.mode === 'dark' ? '#f1f5f9' : '#0f172a',
                          border: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                          borderBottomLeftRadius: 4,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                        })
                    }}
                  >
                    {/* Hiển thị tệp / ảnh đính kèm trong tin nhắn của người dùng */}
                    {isUser && msg.attachments && msg.attachments.length > 0 && (
                      <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {msg.attachments.map((att, attIdx) => {
                          if (att.isImage || att.mimeType?.startsWith('image/')) {
                            return (
                              <Box
                                key={att.id || attIdx}
                                component="img"
                                src={att.dataUrl || `data:${att.mimeType};base64,${att.base64}`}
                                alt={att.name || 'image'}
                                onClick={() => {
                                  const url = att.dataUrl || `data:${att.mimeType};base64,${att.base64}`
                                  window.open(url, '_blank')
                                }}
                                sx={{
                                  maxHeight: 140,
                                  maxWidth: '100%',
                                  borderRadius: 1.5,
                                  objectFit: 'cover',
                                  cursor: 'pointer',
                                  border: '1px solid rgba(255,255,255,0.3)',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                  transition: 'transform 0.2s',
                                  '&:hover': {
                                    transform: 'scale(1.02)'
                                  }
                                }}
                              />
                            )
                          }
                          return (
                            <Chip
                              key={att.id || attIdx}
                              icon={<InsertDriveFileRoundedIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />}
                              label={att.name}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(255,255,255,0.2)',
                                color: '#ffffff',
                                fontSize: '0.75rem',
                                maxWidth: '100%'
                              }}
                            />
                          )
                        })}
                      </Box>
                    )}

                    {isUser ? (
                      <>
                        <Typography sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {msg.content}
                        </Typography>
                        {msg.failed && (
                          <Box sx={{ mt: 0.75, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                            <Typography sx={{ fontSize: '0.72rem', color: '#ff9b7b', flex: 1, minWidth: 100 }}>
                              ⚠️ {msg.failedReason || t('copilot.errorOccurred')}
                            </Typography>
                            <Button
                              size='small'
                              variant='contained'
                              color='error'
                              startIcon={<ReplayRoundedIcon sx={{ fontSize: '15px !important' }} />}
                              onClick={() => handleResendMessage(msg)}
                              disabled={isLoading}
                              sx={{ textTransform: 'none', fontSize: '0.72rem', fontWeight: 700, py: 0.15, borderRadius: 1.5 }}
                            >
                              {t('copilot.resend')}
                            </Button>
                          </Box>
                        )}
                      </>
                    ) : (
                      <Box
                        data-color-mode={theme.palette.mode}
                        sx={{
                          fontSize: '0.875rem',
                          wordBreak: 'break-word',
                          '& .wmde-markdown': {
                            bgcolor: 'transparent !important',
                            color: 'inherit !important',
                            fontSize: '0.875rem',
                            lineHeight: 1.6
                          },
                          '& p': { m: 0, mb: 1, '&:last-child': { mb: 0 } },
                          '& ul, & ol': { pl: 2.5, my: 0.5 }
                        }}
                      >
                        <MDEditor.Markdown source={msg.isWelcome || msg.id?.startsWith('welcome') ? t('copilot.greeting') : msg.content} />
                      </Box>
                    )}

                    {/* Action Execution Result Card */}
                    {msg.actionResult && (
                      <Box
                        sx={{
                          mt: 1.5,
                          p: 1.25,
                          borderRadius: 2,
                          bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#10b981' }} />
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#10b981' }}>
                            {msg.actionResult.type === 'BOARD_CREATED' && t('copilot.boardCreatedSuccess')}
                            {msg.actionResult.type === 'COLUMN_CREATED' && t('copilot.columnCreatedSuccess', { title: msg.actionResult.data?.title })}
                            {msg.actionResult.type === 'CARD_CREATED' && t('copilot.cardCreatedSuccess', { title: msg.actionResult.data?.title })}
                            {msg.actionResult.type === 'SCHEDULE_CREATED' && t('copilot.scheduleCreatedSuccess', { title: msg.actionResult.data?.title, time: msg.actionResult.data?.startAt ? dayjs(msg.actionResult.data.startAt).format('DD/MM/YYYY HH:mm') : '' })}
                            {msg.actionResult.type === 'CARDS_DUE_DATE_UPDATED' && t('copilot.cardsDueDateUpdated', { count: msg.actionResult.data?.updatedCount || 0 })}
                            {['COLUMN_UPDATED', 'COLUMN_ARCHIVED', 'COLUMN_RESTORED', 'CARD_UPDATED', 'CARD_ARCHIVED', 'CARD_RESTORED', 'CARD_MEMBER_ADDED', 'CARD_MEMBER_REMOVED', 'MEMBER_INVITED', 'BOARD_REOPENED'].includes(msg.actionResult.type) && t('copilot.boardActionDone')}
                          </Typography>

                          {msg.actionResult?.type === 'BOARD_CLOSE_CONFIRMATION' && (
                            <Box
                              sx={{
                                mt: 1.5,
                                p: 1.25,
                                borderRadius: 2,
                                bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255, 86, 48, 0.12)' : 'rgba(255, 86, 48, 0.08)',
                                border: '1px solid rgba(255, 86, 48, 0.35)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1
                              }}
                            >
                              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#ff5630' }}>
                                {t('copilot.boardCloseConfirmation', { title: msg.actionResult.data?.title })}
                              </Typography>
                              <Button
                                size="small"
                                variant="contained"
                                color="error"
                                onClick={async () => {
                                  try {
                                    await closeBoardAPI(msg.actionResult.data._id)
                                    toast.success(t('copilot.boardClosedDone', { title: msg.actionResult.data?.title }))
                                    if (currentBoard?._id === msg.actionResult.data._id) {
                                      navigate('/boards/')
                                    }
                                    setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, actionResult: { ...m.actionResult, type: 'BOARD_CLOSED', data: m.actionResult.data } } : m)))
                                  } catch { /* lỗi đã toast ở interceptor */ }
                                }}
                                sx={{
                                  textTransform: 'none',
                                  fontSize: '0.775rem',
                                  fontWeight: 700,
                                  py: 0.5,
                                  borderRadius: 1.5
                                }}
                              >
                                {t('copilot.confirmCloseBoard')}
                              </Button>
                            </Box>
                          )}
                        </Box>

                        {msg.actionResult.type === 'BOARD_CREATED' && msg.actionResult.data?._id && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            endIcon={<LaunchRoundedIcon sx={{ fontSize: '16px !important' }} />}
                            onClick={() => {
                              navigate(`/boards/${msg.actionResult.data._id}`)
                              if (isMobile) setIsOpen(false)
                            }}
                            sx={{
                              textTransform: 'none',
                              fontSize: '0.775rem',
                              fontWeight: 600,
                              py: 0.5,
                              borderRadius: 1.5
                            }}
                          >
                            {t('copilot.openBoard')}
                          </Button>
                        )}

                        {msg.actionResult.type === 'SCHEDULE_CREATED' && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            endIcon={<LaunchRoundedIcon sx={{ fontSize: '16px !important' }} />}
                            onClick={() => {
                              navigate('/schedule')
                              if (isMobile) setIsOpen(false)
                            }}
                            sx={{
                              textTransform: 'none',
                              fontSize: '0.775rem',
                              fontWeight: 600,
                              py: 0.5,
                              borderRadius: 1.5
                            }}
                          >
                            {t('copilot.openSchedule')}
                          </Button>
                        )}
                      </Box>
                    )}
                  </Box>
                </Box>
              )
            })}

            {/* Thinking Indicator */}
            {isLoading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1 }}>
                <CircularProgress size={16} thickness={5} sx={{ color: '#a855f7' }} />
                <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', fontStyle: 'italic' }}>
                  {t('copilot.thinking')}
                </Typography>
              </Box>
            )}

            {/* Quick Suggestions Chips (only if 1 or 2 messages in chat) */}
            {messages.length <= 2 && !isLoading && (
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600, px: 0.5 }}>
                  {t('copilot.quickSuggestions')}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {quickPrompts.map((prompt, idx) => (
                    <Chip
                      key={idx}
                      label={prompt}
                      size="small"
                      clickable
                      onClick={() => handleSendMessage(prompt)}
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        py: 0.5,
                        bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        border: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                        '&:hover': {
                          bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(168, 85, 247, 0.1)',
                          borderColor: '#a855f7'
                        }
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Box>

          {/* Input Bar */}
          <Box
            sx={{
              px: 1.5,
              pt: 1.25,
              pb: { xs: 'calc(12px + env(safe-area-inset-bottom, 0px))', sm: 1.5 },
              flexShrink: 0,
              bgcolor: (t) => t.palette.mode === 'dark' ? '#0f172a' : '#ffffff',
              borderTop: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`
            }}
          >
            {/* Thanh Preview tệp / ảnh đính kèm trước khi gửi */}
            {attachments.length > 0 && (
              <Box
                sx={{
                  mb: 1,
                  p: 1,
                  borderRadius: 2,
                  bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  border: (t) => `1px dashed ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  overflowX: 'auto',
                  flexWrap: 'nowrap'
                }}
              >
                {attachments.map((att) => (
                  <Box
                    key={att.id}
                    sx={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0
                    }}
                  >
                    {att.isImage ? (
                      <Box sx={{ position: 'relative' }}>
                        <Box
                          component="img"
                          src={att.dataUrl}
                          alt={att.name}
                          sx={{
                            width: 52,
                            height: 52,
                            borderRadius: 1.5,
                            objectFit: 'cover',
                            border: '1px solid rgba(99, 102, 241, 0.3)'
                          }}
                        />
                        <IconButton
                          size="small"
                          aria-label={t('copilot.removeAttachment')}
                          onClick={() => handleRemoveAttachment(att.id)}
                          sx={{
                            position: 'absolute',
                            top: -6,
                            right: -6,
                            bgcolor: '#ef4444',
                            color: 'white',
                            p: '2px',
                            '&:hover': { bgcolor: '#dc2626' }
                          }}
                        >
                          <CancelRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    ) : (
                      <Chip
                        icon={<InsertDriveFileRoundedIcon sx={{ fontSize: '16px !important' }} />}
                        label={att.name}
                        size="small"
                        onDelete={() => handleRemoveAttachment(att.id)}
                        sx={{
                          fontSize: '0.75rem',
                          maxWidth: 160
                        }}
                      />
                    )}
                  </Box>
                ))}
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', ml: 'auto', flexShrink: 0 }}>
                  {attachments.length}/{MAX_ATTACHMENTS}
                </Typography>
              </Box>
            )}

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,.pdf,.txt,.json,.csv,.md"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            <Paper
              sx={{
                p: '4px 6px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: 2.5,
                bgcolor: (t) => t.palette.mode === 'dark' ? '#1e293b' : '#f1f5f9',
                border: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                boxShadow: 'none',
                '&:focus-within': {
                  borderColor: '#8b5cf6',
                  boxShadow: '0 0 0 2px rgba(139, 92, 246, 0.2)'
                }
              }}
            >
              {/* Nút đính kèm tệp */}
              <Tooltip title={t('copilot.attachFile')} arrow placement="top">
                <IconButton
                  size="small"
                  aria-label={t('copilot.attachFile')}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || attachments.length >= MAX_ATTACHMENTS}
                  sx={{
                    color: 'text.secondary',
                    p: 0.75,
                    '&:hover': {
                      color: '#6366f1',
                      bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)'
                    }
                  }}
                >
                  <AttachFileRoundedIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>

              <InputBase
                inputRef={inputRef}
                multiline
                maxRows={3}
                placeholder={attachments.length > 0 ? t('copilot.defaultAttachmentPrompt') : t('copilot.inputPlaceholder')}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                sx={{
                  ml: 0.5,
                  flex: 1,
                  fontSize: { xs: '1rem', sm: '0.875rem' },
                  lineHeight: 1.4
                }}
              />

              <IconButton
                color="primary"
                aria-label={t('common.send') || 'Send'}
                onClick={() => handleSendMessage()}
                disabled={!canSend}
                sx={{
                  width: { xs: 40, sm: 34 },
                  height: { xs: 40, sm: 34 },
                  background: canSend
                    ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
                    : 'transparent',
                  color: canSend ? 'white' : 'text.disabled',
                  transition: 'all 0.2s',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
                    color: 'white'
                  },
                  '&.Mui-disabled': {
                    color: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'
                  }
                }}
              >
                {isLoading ? (
                  <CircularProgress size={18} sx={{ color: 'inherit' }} />
                ) : (
                  <SendRoundedIcon sx={{ fontSize: 18 }} />
                )}
              </IconButton>
            </Paper>
          </Box>
        </Paper>
      )}
    </>
  )
}
