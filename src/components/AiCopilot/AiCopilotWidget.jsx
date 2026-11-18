import { useState, useRef, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import MDEditor from '@uiw/react-md-editor'

import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded'
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'

import KanflowIcon from '~/components/Icons/KanflowIcon'
import { selectCurrentActiveBoard, fetchBoardDetailsAPI } from '~/redux/activeBoard/activeBoardSlice'
import { selectCurrentUser } from '~/redux/user/userSlice'
import { chatWithAiCopilotAPI } from '~/apis'

export default function AiCopilotWidget() {
  const { t, i18n } = useTranslation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const currentUser = useSelector(selectCurrentUser)
  const currentBoard = useSelector(selectCurrentActiveBoard)

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Khởi tạo tin nhắn chào hỏi ban đầu khi mở widget
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome-msg',
          isWelcome: true,
          role: 'assistant',
          content: t('copilot.greeting'),
          timestamp: Date.now()
        }
      ])
    }
  }, [t, messages.length])

  // Tự động cập nhật nội dung tin nhắn chào hỏi khi đổi ngôn ngữ
  useEffect(() => {
    setMessages(prev => prev.map(m => (m.isWelcome || m.id?.startsWith('welcome'))
      ? { ...m, content: t('copilot.greeting') }
      : m
    ))
  }, [i18n.language, t])

  // Tự động cuộn xuống cuối mỗi khi có tin nhắn mới
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen, messages, scrollToBottom])

  if (!currentUser) return null

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputValue || '').trim()
    if (!query || isLoading) return

    const userMessageId = `user-${Date.now()}`
    const newUserMsg = {
      id: userMessageId,
      role: 'user',
      content: query,
      timestamp: Date.now()
    }

    // Cập nhật tin nhắn người dùng ngay lập tức
    const updatedMessages = [...messages, newUserMsg]
    setMessages(updatedMessages)
    setInputValue('')
    setIsLoading(true)

    try {
      // Chuẩn bị payload gửi lên backend
      const historyPayload = updatedMessages
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }))

      const currentLang = i18n.language?.startsWith('vi') ? 'vi' : 'en'

      const response = await chatWithAiCopilotAPI({
        message: query,
        history: historyPayload,
        currentBoardId: currentBoard?._id || null,
        language: currentLang
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

      // Nếu action là tạo card hoặc column trên board hiện tại, reload lại board
      if (response.actionResult?.type === 'CARD_CREATED' || response.actionResult?.type === 'COLUMN_CREATED') {
        if (currentBoard?._id) {
          dispatch(fetchBoardDetailsAPI(currentBoard._id))
        }
      }
    } catch (err) {
      const errorMsg = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ ${err?.response?.data?.message || t('copilot.errorOccurred')}`,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        isWelcome: true,
        role: 'assistant',
        content: t('copilot.greeting'),
        timestamp: Date.now()
      }
    ])
  }

  const quickPrompts = [
    t('copilot.quickPrompt1'),
    t('copilot.quickPrompt2'),
    t('copilot.quickPrompt3'),
    t('copilot.quickPrompt4')
  ]

  return (
    <>
      {/* Floating Action Button (FAB) */}
      {!isOpen && (
        <Tooltip title={t('copilot.tooltip')} placement="left" arrow>
          <Fab
            size={isMobile ? 'medium' : 'large'}
            aria-label={t('copilot.title')}
            onClick={() => setIsOpen(true)}
            sx={{
              position: 'fixed',
              // Trên mobile đặt phía trên MobileBottomNav (60px + safe-area) để không che tab Profile
              bottom: { xs: 'calc(76px + env(safe-area-inset-bottom, 0px))', sm: 24 },
              right: { xs: 16, sm: 24 },
              zIndex: 1200,
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
      )}

      {/* Copilot Chat Window */}
      {isOpen && (
        <Paper
          elevation={12}
          sx={{
            position: 'fixed',
            top: { xs: 0, sm: 'auto' },
            bottom: { xs: 0, sm: 24 },
            right: { xs: 0, sm: 24 },
            left: { xs: 0, sm: 'auto' },
            width: { xs: '100vw', sm: 400 },
            // Dùng 100dvh để khi bàn phím ảo mobile bật lên, ô nhập chat tự co giãn và không bị che
            height: { xs: '100dvh', sm: 580 },
            maxHeight: { xs: '100dvh', sm: 'min(620px, calc(100dvh - 48px))' },
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
                    {isUser ? (
                      <Typography sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.content}
                      </Typography>
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
                          </Typography>
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
            <Paper
              sx={{
                p: '4px 8px',
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
              <InputBase
                inputRef={inputRef}
                multiline
                maxRows={3}
                placeholder={t('copilot.inputPlaceholder')}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                sx={{
                  ml: 1,
                  flex: 1,
                  fontSize: { xs: '1rem', sm: '0.875rem' },
                  lineHeight: 1.4
                }}
              />
              <IconButton
                color="primary"
                aria-label={t('common.send') || 'Send'}
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                sx={{
                  width: { xs: 40, sm: 34 },
                  height: { xs: 40, sm: 34 },
                  background: inputValue.trim() && !isLoading
                    ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
                    : 'transparent',
                  color: inputValue.trim() && !isLoading ? 'white' : 'text.disabled',
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
