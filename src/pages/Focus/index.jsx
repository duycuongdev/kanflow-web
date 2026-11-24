import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Collapse from '@mui/material/Collapse'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import LinearProgress from '@mui/material/LinearProgress'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import { useTheme } from '@mui/material/styles'
import dayjs from 'dayjs'
import dayOfYearPlugin from 'dayjs/plugin/dayOfYear'

dayjs.extend(dayOfYearPlugin)

import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import PauseRoundedIcon from '@mui/icons-material/PauseRounded'
import StopRoundedIcon from '@mui/icons-material/StopRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import TimerRoundedIcon from '@mui/icons-material/TimerRounded'
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

import AppBar from '~/components/AppBar/AppBar'
import { selectCurrentUser } from '~/redux/user/userSlice'
import { updateCardInBoard } from '~/redux/activeBoard/activeBoardSlice'
import { updateCurrentActiveCard } from '~/redux/activeCard/activeCardSlice'
import {
  TIMER_MODES,
  formatCountdown,
  formatDurationShort,
  selectFocusTimerState,
  selectFocusPlan,
  selectFocusTask,
  startFocusTimer,
  pauseFocusTimer,
  stopFocusSession,
  resetFocusTimer,
  switchTimerMode,
  setCustomMinutes,
  setFocusTask,
  startFocusPlan
} from '~/redux/focusTimer/focusTimerSlice'
import Pagination from '@mui/material/Pagination'

import Checkbox from '@mui/material/Checkbox'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { fetchBoardsAPI, fetchBoardDetailsAPI, getFocusStatsAPI, getFocusLeaderboardAPI, updateCardDetailsAPI } from '~/apis'
import { mapOrder } from '~/utils/sorts'

// Cache danh sách boards ở tầng module để tránh fetch lại mỗi lần component TaskCascade mount
let cachedBoards = null

/** Danh sách việc cần làm (Checklists) của thẻ với hộp kiểm hoàn thành và thanh tiến độ */
function CardChecklistPanel({
  checklists = [],
  onToggleItemDone,
  isGlassmorphic = false,
  collapsible = false,
  defaultExpanded = true,
  maxHeight = 220
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(defaultExpanded)

  const allItems = (checklists || []).flatMap(cl => (cl.items || []).map(it => ({ ...it, checklistId: cl._id || cl.title, checklistTitle: cl.title })))
  const totalItems = allItems.length
  const completedItems = allItems.filter(it => it.isDone).length
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  if (totalItems === 0) return null

  return (
    <Box
      sx={{
        borderRadius: 2.5,
        p: 1.5,
        border: '1px solid',
        ...(isGlassmorphic ? {
          bgcolor: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderColor: 'rgba(255, 255, 255, 0.16)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        } : {
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,82,204,0.03)',
          borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,82,204,0.12)'
        })
      }}
    >
      {/* Header với tiến độ */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{
            fontWeight: 700,
            fontSize: isGlassmorphic ? '0.85rem' : '0.9rem',
            color: isGlassmorphic ? 'rgba(255,255,255,0.95)' : 'text.primary'
          }}>
            📋 {t('focusPage.cardChecklists')}
          </Typography>
          <Chip
            size='small'
            label={`${completedItems}/${totalItems} (${progressPercent}%)`}
            sx={{
              height: 20,
              fontSize: '0.68rem',
              fontWeight: 700,
              ...(isGlassmorphic ? {
                bgcolor: progressPercent === 100 ? 'rgba(0,135,90,0.85)' : 'rgba(0,82,204,0.7)',
                color: '#fff'
              } : {
                bgcolor: progressPercent === 100 ? '#00875a' : '#0052cc',
                color: '#fff'
              })
            }}
          />
        </Box>
        {collapsible && (
          <IconButton
            size='small'
            onClick={() => setExpanded(!expanded)}
            sx={{ color: isGlassmorphic ? 'rgba(255,255,255,0.7)' : 'text.secondary', p: 0.25 }}
          >
            {expanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        )}
      </Box>

      {/* Thanh tiến độ */}
      <LinearProgress
        variant='determinate'
        value={progressPercent}
        sx={{
          height: 5,
          borderRadius: 2.5,
          mb: expanded ? 1 : 0,
          bgcolor: isGlassmorphic ? 'rgba(255,255,255,0.12)' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,82,204,0.1)',
          '& .MuiLinearProgress-bar': {
            borderRadius: 2.5,
            bgcolor: progressPercent === 100 ? '#36b37e' : (isGlassmorphic ? '#4c9aff' : '#0052cc')
          }
        }}
      />

      {/* Danh sách các checklist items */}
      <Collapse in={expanded}>
        <Box sx={{
          maxHeight,
          overflowY: 'auto',
          pr: 0.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          '&::-webkit-scrollbar': { width: 5 },
          '&::-webkit-scrollbar-thumb': {
            borderRadius: 2.5,
            bgcolor: isGlassmorphic ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'
          }
        }}>
          {(checklists || []).map((cl) => {
            const clId = cl._id || cl.title
            return (
              <Box key={clId}>
                {checklists.length > 1 && (
                  <Typography sx={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: isGlassmorphic ? 'rgba(255,255,255,0.55)' : 'text.secondary',
                    mt: 0.5,
                    mb: 0.25
                  }}>
                    {cl.title}
                  </Typography>
                )}
                {(cl.items || []).map((it) => {
                  const itId = it._id || it.title
                  return (
                    <Box
                      key={itId}
                      onClick={() => onToggleItemDone && onToggleItemDone(clId, itId, !it.isDone)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1,
                        py: 0.6,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        border: '1px solid',
                        ...(isGlassmorphic ? {
                          bgcolor: it.isDone ? 'rgba(0,135,90,0.22)' : 'rgba(255,255,255,0.04)',
                          borderColor: it.isDone ? 'rgba(54,179,126,0.35)' : 'rgba(255,255,255,0.06)',
                          '&:hover': {
                            bgcolor: it.isDone ? 'rgba(0,135,90,0.3)' : 'rgba(255,255,255,0.08)'
                          }
                        } : {
                          bgcolor: (theme) => it.isDone
                            ? (theme.palette.mode === 'dark' ? 'rgba(0,135,90,0.12)' : 'rgba(0,135,90,0.07)')
                            : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'),
                          borderColor: it.isDone ? 'rgba(0,135,90,0.3)' : 'transparent',
                          '&:hover': {
                            bgcolor: (theme) => it.isDone
                              ? (theme.palette.mode === 'dark' ? 'rgba(0,135,90,0.16)' : 'rgba(0,135,90,0.1)')
                              : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)')
                          }
                        })
                      }}
                    >
                      <Checkbox
                        checked={Boolean(it.isDone)}
                        size='small'
                        onChange={(e) => {
                          e.stopPropagation()
                          onToggleItemDone && onToggleItemDone(clId, itId, e.target.checked)
                        }}
                        sx={{
                          p: 0,
                          color: isGlassmorphic ? 'rgba(255,255,255,0.45)' : '#00875a',
                          '&.Mui-checked': { color: '#36b37e' }
                        }}
                      />
                      <Typography
                        sx={{
                          flex: 1,
                          fontSize: '0.82rem',
                          fontWeight: it.isDone ? 500 : 600,
                          textDecoration: it.isDone ? 'line-through' : 'none',
                          color: isGlassmorphic
                            ? (it.isDone ? 'rgba(255,255,255,0.45)' : '#fff')
                            : (it.isDone ? 'text.disabled' : 'text.primary'),
                          lineHeight: 1.35,
                          userSelect: 'none'
                        }}
                      >
                        {it.title}
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
            )
          })}
        </Box>
      </Collapse>
    </Box>
  )
}

/** Cascade chọn nhiệm vụ: Bảng → Card → Checklist → Item (tái dùng pattern của Schedule popover) */
function TaskCascade({ onChainChange, initialTask, onClearTask, onActiveCardChange, activeCardChecklists, onToggleChecklistItem }) {
  const { t } = useTranslation()
  const [boards, setBoards] = useState(() => cachedBoards || [])
  const [boardId, setBoardId] = useState(() => initialTask?.boardId || '')
  const [cardId, setCardId] = useState(() => initialTask?.cardId || '')
  const [checklistId, setChecklistId] = useState(() => initialTask?.checklistId || '')
  const [itemId, setItemId] = useState(() => initialTask?.checklistItemId || '')
  const [cardOptions, setCardOptions] = useState([])
  const [loadingBoard, setLoadingBoard] = useState(false)
  // false = đã chọn xong nhiệm vụ (thu gọn chỉ hiện nhiệm vụ); true = đang mở lại các ô chọn
  const [editingAttach, setEditingAttach] = useState(false)
  const [savingComplete, setSavingComplete] = useState(false)

  // Đồng bộ khi initialTask từ bên ngoài thay đổi (ví dụ khi user bấm "Tập trung" từ thẻ khác hoặc lịch)
  useEffect(() => {
    if (initialTask?.cardId) {
      if (initialTask.boardId) setBoardId(initialTask.boardId)
      setCardId(initialTask.cardId)
      setChecklistId(initialTask.checklistId || '')
      setItemId(initialTask.checklistItemId || '')
      setEditingAttach(false)
    } else if (initialTask === null) {
      setBoardId('')
      setCardId('')
      setChecklistId('')
      setItemId('')
      setEditingAttach(false)
    }
  }, [initialTask?.cardId, initialTask?.boardId, initialTask?.checklistId, initialTask?.checklistItemId])

  const selectedCardLocal = cardOptions.find((c) => c._id === cardId)
  const selectedChecklistLocal = selectedCardLocal?.checklists?.find((cl) => (cl._id || cl.title) === checklistId)
  const selectedItemLocal = selectedChecklistLocal?.items?.find((it) => (it._id || it.title) === itemId)
    || (selectedCardLocal?.checklists || []).flatMap(cl => cl.items || []).find((it) => (it._id || it.title) === itemId)

  // Thu gọn cascade khi đã có cardId (trừ khi user bấm "Đổi nhiệm vụ")
  const cascadeCollapsed = Boolean(cardId) && !editingAttach

  const boardTitleDisplay = boards.find((b) => b._id === boardId)?.title || initialTask?.boardTitle || ''
  const cardTitleDisplay = selectedCardLocal?.title || initialTask?.cardTitle || initialTask?.title || ''
  const checklistTitleDisplay = selectedChecklistLocal?.title || initialTask?.checklistTitle || ''
  const itemTitleDisplay = selectedItemLocal?.title || initialTask?.itemTitle || ''

  /**
   * Đánh dấu hoàn thành/xóa hoàn thành của item checklist được chọn.
   * Cập nhật cả card (PUT /v1/cards) => board của card đồng bộ theo (socket BE_BOARD_UPDATED)
   */
  const handleToggleItemDone = async (checked) => {
    if (!selectedCardLocal || !selectedItemLocal) return
    setSavingComplete(true)
    try {
      const parentCl = selectedChecklistLocal || selectedCardLocal.checklists?.find(cl => cl.items?.some(it => (it._id || it.title) === (selectedItemLocal._id || selectedItemLocal.title)))
      if (!parentCl) return

      const newChecklists = selectedCardLocal.checklists.map((cl) =>
        (cl._id || cl.title) === (parentCl._id || parentCl.title)
          ? {
            ...cl,
            items: cl.items.map((it) =>
              (it._id || it.title) === (selectedItemLocal._id || selectedItemLocal.title)
                ? { ...it, isDone: checked }
                : it
            )
          }
          : cl
      )
      await updateCardDetailsAPI(selectedCardLocal._id, { checklists: newChecklists })
      // Cập nhật local để checkbox + preview phản ánh ngay
      setCardOptions((prev) => prev.map((c) => (c._id === selectedCardLocal._id ? { ...c, checklists: newChecklists } : c)))
    } catch {
      // lỗi đã toast ở interceptor
    } finally {
      setSavingComplete(false)
    }
  }

  useEffect(() => {
    if (cachedBoards && cachedBoards.length > 0) {
      setBoards(cachedBoards)
      return
    }
    fetchBoardsAPI('?page=1&itemsPerPage=100')
      .then((data) => {
        const list = data.boards || []
        cachedBoards = list
        setBoards(list)
      })
      .catch(() => { /* lỗi đã toast ở interceptor */ })
  }, [])

  useEffect(() => {
    if (!boardId) {
      setCardOptions([])
      return
    }
    let cancelled = false
    setLoadingBoard(true)
    fetchBoardDetailsAPI(boardId)
      .then((boardDetails) => {
        if (cancelled) return
        // Sắp xếp column theo board.columnOrderIds và card theo column.cardOrderIds chuẩn theo Board
        const orderedColumns = mapOrder(boardDetails.columns || [], boardDetails.columnOrderIds || [], '_id')
        const cards = orderedColumns.flatMap((column) => {
          const orderedCards = mapOrder(column.cards || [], column.cardOrderIds || [], '_id')
          return orderedCards.map((c) => ({ ...c, columnTitle: column.title }))
        })
        setCardOptions(cards)

        const targetCardId = cardId || initialTask?.cardId
        const matchedCard = cards.find((c) => c._id === targetCardId)

        if (matchedCard) {
          if (cardId !== matchedCard._id) {
            setCardId(matchedCard._id)
          }
          if (onActiveCardChange) {
            onActiveCardChange(matchedCard)
          }
          const targetClId = checklistId || initialTask?.checklistId
          const matchedCl = matchedCard.checklists?.find((cl) => (cl._id || cl.title) === targetClId)
          if (matchedCl && checklistId !== (matchedCl._id || matchedCl.title)) {
            setChecklistId(matchedCl._id || matchedCl.title)
          }
          const targetItemId = itemId || initialTask?.checklistItemId
          const matchedItem = (matchedCl?.items || (matchedCard.checklists || []).flatMap(cl => cl.items || [])).find((it) => (it._id || it.title) === targetItemId)
          if (matchedItem && itemId !== (matchedItem._id || matchedItem.title)) {
            setItemId(matchedItem._id || matchedItem.title)
          }
        } else if (!editingAttach && !targetCardId) {
          onChainChange({ boardId, boardTitle: boardDetails.title, cardId: null, cardTitle: null, checklistId: null, checklistTitle: null, checklistItemId: null, itemTitle: null })
          setCardId('')
          setChecklistId('')
          setItemId('')
          if (onActiveCardChange) onActiveCardChange(null)
        }
      })
      .catch(() => { /* lỗi đã toast ở interceptor */ })
      .finally(() => { if (!cancelled) setLoadingBoard(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId])

  const selectedCard = cardOptions.find((c) => c._id === cardId)
  const selectedChecklist = selectedCard?.checklists?.find((cl) => (cl._id || cl.title) === checklistId)

  const handleCard = (value) => {
    setCardId(value)
    setChecklistId('')
    setItemId('')
    const card = cardOptions.find((c) => c._id === value)
    const board = boards.find((b) => b._id === boardId)
    if (onActiveCardChange) onActiveCardChange(card || null)
    onChainChange({
      boardId,
      boardTitle: board?.title || boardTitleDisplay || null,
      cardId: value || null,
      cardTitle: card?.title || null,
      checklistId: null,
      checklistTitle: null,
      checklistItemId: null,
      itemTitle: null
    })
    if (value) setEditingAttach(false)
  }

  const handleChecklist = (value) => {
    setChecklistId(value)
    setItemId('')
    const checklist = selectedCard?.checklists?.find((cl) => (cl._id || cl.title) === value)
    const board = boards.find((b) => b._id === boardId)
    onChainChange({
      boardId,
      boardTitle: board?.title || boardTitleDisplay || null,
      cardId,
      cardTitle: selectedCard?.title || cardTitleDisplay || null,
      checklistId: value || null,
      checklistTitle: checklist?.title || null,
      checklistItemId: null,
      itemTitle: null
    })
  }

  const handleItem = (value) => {
    setItemId(value)
    const targetCl = selectedChecklist || selectedCard?.checklists?.find((cl) => cl.items?.some((it) => (it._id || it.title) === value))
    const item = targetCl?.items?.find((it) => (it._id || it.title) === value)
    const board = boards.find((b) => b._id === boardId)
    onChainChange({
      boardId,
      boardTitle: board?.title || boardTitleDisplay || null,
      cardId,
      cardTitle: selectedCard?.title || cardTitleDisplay || null,
      checklistId: targetCl?._id || targetCl?.title || checklistId || null,
      checklistTitle: targetCl?.title || null,
      checklistItemId: value || null,
      itemTitle: item?.title || null
    })
    if (value) setEditingAttach(false)
  }

  const handleClear = () => {
    setBoardId('')
    setCardId('')
    setChecklistId('')
    setItemId('')
    setEditingAttach(false)
    if (onActiveCardChange) onActiveCardChange(null)
    if (onClearTask) onClearTask()
    onChainChange({ boardId: null, boardTitle: null, cardId: null, cardTitle: null, checklistId: null, checklistTitle: null, checklistItemId: null, itemTitle: null })
  }

  return (
    <Box>
      {!cascadeCollapsed && (
        <Select
          fullWidth
          size='small'
          displayEmpty
          value={boardId}
          onChange={(e) => setBoardId(e.target.value)}
          sx={{ mb: 1 }}
          MenuProps={{ PaperProps: { sx: { maxHeight: 260 } } }}
          renderValue={(value) => {
            if (!value) return <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>{t('schedule.selectBoard')}</Typography>
            const board = boards.find((b) => b._id === value)
            return board?.title || value
          }}
        >
          {boards.map((board) => (
            <MenuItem key={board._id} value={board._id}>{board.title}</MenuItem>
          ))}
          {boards.length === 0 && (
            <MenuItem disabled value=''>
              <Typography sx={{ fontSize: '0.85rem' }}>{t('schedule.noBoards')}</Typography>
            </MenuItem>
          )}
        </Select>
      )}

      {(editingAttach || !cardId) && boardId && (
        <Select
          fullWidth
          size='small'
          displayEmpty
          value={cardId}
          onChange={(e) => handleCard(e.target.value)}
          sx={{ mb: 1 }}
          MenuProps={{ PaperProps: { sx: { maxHeight: 260 } } }}
          renderValue={(value) => {
            if (!value) return <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>{t('schedule.selectCard')}</Typography>
            const card = cardOptions.find((c) => c._id === value)
            return card?.title || value
          }}
        >
          <MenuItem value=''>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>{t('schedule.noCard')}</Typography>
          </MenuItem>
          {cardOptions.map((card) => (
            <MenuItem key={card._id} value={card._id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                {card.columnTitle && (
                  <Chip
                    size='small'
                    label={card.columnTitle}
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
                    }}
                  />
                )}
                <Typography sx={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
                  {card.title}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      )}

      {cardId && !cascadeCollapsed && selectedCard?.checklists?.length > 0 && (
        <Select
          fullWidth
          size='small'
          displayEmpty
          value={checklistId}
          onChange={(e) => handleChecklist(e.target.value)}
          sx={{ mb: 1 }}
          MenuProps={{ PaperProps: { sx: { maxHeight: 260 } } }}
          renderValue={(value) => {
            if (!value) return <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>{t('schedule.selectChecklist')}</Typography>
            const checklist = selectedCard.checklists.find((cl) => (cl._id || cl.title) === value)
            return checklist?.title || value
          }}
        >
          <MenuItem value=''>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>{t('schedule.noChecklist')}</Typography>
          </MenuItem>
          {selectedCard.checklists.map((checklist) => (
            <MenuItem key={checklist._id || checklist.title} value={checklist._id || checklist.title}>
              <Typography sx={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>
                {checklist.title}
              </Typography>
            </MenuItem>
          ))}
        </Select>
      )}

      {checklistId && !cascadeCollapsed && selectedChecklist?.items?.length > 0 && (
        <Select
          fullWidth
          size='small'
          displayEmpty
          value={itemId}
          onChange={(e) => handleItem(e.target.value)}
          MenuProps={{ PaperProps: { sx: { maxHeight: 260 } } }}
          renderValue={(value) => {
            if (!value) return <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>{t('schedule.selectItem')}</Typography>
            const item = selectedChecklist.items.find((it) => (it._id || it.title) === value)
            return item?.title || value
          }}
        >
          <MenuItem value=''>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>{t('schedule.noItem')}</Typography>
          </MenuItem>
          {selectedChecklist.items.map((item) => (
            <MenuItem key={item._id || item.title} value={item._id || item.title}>
              <Typography sx={{
                fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280,
                textDecoration: item.isDone ? 'line-through' : 'none',
                color: item.isDone ? 'text.disabled' : 'text.primary'
              }}>
                {item.title}
              </Typography>
            </MenuItem>
          ))}
        </Select>
      )}

      {/* Đã chọn xong nhiệm vụ: thu gọn chỉ hiện chuỗi đã chọn + nút đổi */}
      {cascadeCollapsed && cardId && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap',
          bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,82,204,0.05)',
          border: '1px solid', borderColor: 'divider',
          borderRadius: 1.5, p: 1.25, mb: 1.25
        }}>
          {boardTitleDisplay && <Chip size='small' label={`🗂 ${boardTitleDisplay}`} sx={{ height: 22, fontSize: '0.7rem' }} />}
          {cardTitleDisplay && <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>›</Typography>}
          {cardTitleDisplay && <Chip size='small' label={`🎯 ${cardTitleDisplay}`} sx={{ height: 22, fontSize: '0.7rem' }} />}
          {checklistTitleDisplay && <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>›</Typography>}
          {checklistTitleDisplay && <Chip size='small' label={`☑ ${checklistTitleDisplay}`} sx={{ height: 22, fontSize: '0.7rem' }} />}
          {itemTitleDisplay && <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>›</Typography>}
          {itemTitleDisplay && <Chip size='small' label={`📌 ${itemTitleDisplay}`} sx={{ height: 22, fontSize: '0.7rem', bgcolor: 'rgba(0,82,204,0.12)' }} />}
          <Box sx={{ flex: 1 }} />
          <Button
            size='small'
            variant='text'
            startIcon={<EditRoundedIcon sx={{ fontSize: 15 }} />}
            onClick={() => setEditingAttach(true)}
            sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600, minWidth: 0, px: 0.75 }}
          >
            {t('schedule.changeTask')}
          </Button>
          <IconButton
            size='small'
            onClick={handleClear}
            title={t('schedule.clearTask') || 'Gỡ nhiệm vụ'}
            sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
          >
            <CloseRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      )}

      {/* Danh sách toàn bộ việc cần làm (Checklists) của thẻ */}
      {cascadeCollapsed && cardId && (
        <Box sx={{ mt: 1.25 }}>
          <CardChecklistPanel
            checklists={activeCardChecklists?.length > 0 ? activeCardChecklists : (selectedCardLocal?.checklists || [])}
            onToggleItemDone={onToggleChecklistItem || handleToggleItemDone}
            collapsible
            defaultExpanded
            maxHeight={240}
          />
        </Box>
      )}

      {loadingBoard && <LinearProgress sx={{ mt: 1 }} />}
    </Box>
  )
}

const RANK_MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }

/**
 * Chế độ TOÀN MÀN HÌNH: hiện khi timer đang chạy / đang nghỉ / tạm dừng giữa chừng.
 * Chỉ thoát khi bấm Dừng (hoặc chuỗi hoàn thành tự nhiên).
 */
function FocusFullscreen({
  timerState,
  plan,
  focusTask,
  remainingMs,
  modeConfig,
  progress,
  cardChecklists = [],
  onToggleChecklistItem
}) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const ringSize = 200
  const ringStroke = 10
  const ringRadius = (ringSize - ringStroke) / 2
  const ringCircumference = 2 * Math.PI * ringRadius

  const hasChecklists = (cardChecklists || []).length > 0
  const isBreak = timerState.mode !== 'focus'
  const phaseLabel = plan.active
    ? (isBreak
      ? t(`focusTimer.mode.${modeConfig.label}`)
      : t('focusPage.roundOf', { round: plan.round, repeats: plan.repeats }))
    : t(`focusTimer.mode.${modeConfig.label}`)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      style={{ position: 'fixed', inset: 0, zIndex: 1300 }}
    >
      <Box sx={{
        position: 'absolute', inset: 0,
        background: (themeBg) => themeBg.palette.mode === 'dark'
          ? 'radial-gradient(circle at 50% 25%, #1e3a8a 0%, #0f172a 60%)'
          : 'radial-gradient(circle at 50% 25%, #1e3a8a 0%, #0b1220 60%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: hasChecklists ? 1.5 : 2, overflow: 'hidden'
      }}>
        {/* Chip vòng lặp */}
        {plan.active && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', justifyContent: 'center', px: 2 }}>
            {Array.from({ length: plan.repeats }, (_, i) => {
              const roundNo = i + 1
              const done = plan.phase === 'focus' ? roundNo < plan.round : roundNo <= plan.round - 1
              const current = roundNo === plan.round
              return (
                <Chip
                  key={roundNo}
                  size='small'
                  label={t('focusPage.roundChip', { n: roundNo })}
                  sx={{
                    fontWeight: 700,
                    ...(done ? { bgcolor: 'rgba(0,135,90,0.85)', color: '#fff' } : {}),
                    ...(current && !isBreak ? { bgcolor: '#0052cc', color: '#fff' } : {}),
                    ...(current && isBreak ? { bgcolor: '#6554c0', color: '#fff' } : {}),
                    ...(done || current ? {} : { bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' })
                  }}
                />
              )
            })}
          </Box>
        )}

        {/* Nhịp thở + vòng đếm khổng lồ */}
        <motion.div
          animate={{ scale: [1, 1.025, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Box sx={{
            position: 'relative',
            width: hasChecklists ? 'min(42vmin, 260px)' : 'min(74vmin, 460px)',
            aspectRatio: '1/1'
          }}>
            <svg viewBox='0 0 200 200' style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle
                cx='100' cy='100' r={ringRadius}
                fill='none' stroke='rgba(255,255,255,0.10)' strokeWidth={ringStroke}
              />
              <circle
                cx='100' cy='100' r={ringRadius}
                fill='none' stroke={modeConfig.color}
                strokeWidth={ringStroke}
                strokeLinecap='round'
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringCircumference * (1 - progress)}
                style={{ transition: 'stroke-dashoffset 0.5s linear', filter: 'drop-shadow(0 0 14px rgba(0,82,204,0.55))' }}
              />
            </svg>
            <Box sx={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 0.5
            }}>
              <Typography sx={{
                fontSize: hasChecklists ? 'clamp(36px, 7.5vmin, 62px)' : 'clamp(56px, 11vmin, 120px)',
                fontWeight: 800, letterSpacing: 2,
                color: '#fff', textShadow: '0 4px 30px rgba(0,0,0,0.35)', lineHeight: 1
              }}>
                {formatCountdown(remainingMs)}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: { xs: '0.95rem', sm: '1.1rem' } }}>
                {phaseLabel}
              </Typography>
              {timerState.mode === 'focus' && timerState.pomodoroCount > 0 && (
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                  🍅 {timerState.pomodoroCount}
                </Typography>
              )}
            </Box>
          </Box>
        </motion.div>

        {/* Nhiệm vụ đang focus */}
        <AnimatePresence>
          {focusTask?.title && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Chip
                label={`🎯 ${t('focusTimer.focusingOn')}: ${focusTask.title}`}
                sx={{
                  maxWidth: '90vw', color: '#fff',
                  bgcolor: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontWeight: 600
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Danh sách việc cần làm (Checklists) của thẻ ngay trong chế độ toàn màn hình */}
        {hasChecklists && (
          <Box sx={{
            width: 'min(92vw, 460px)',
            zIndex: 2,
            maxHeight: 'min(36vh, 230px)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <CardChecklistPanel
              checklists={cardChecklists}
              onToggleItemDone={onToggleChecklistItem}
              isGlassmorphic
              collapsible
              defaultExpanded
              maxHeight={160}
            />
          </Box>
        )}

        {/* Điều khiển: chỉ Pause/Resume + Stop - thoát toàn màn hình bằng Dừng */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
          {timerState.isRunning ? (
            <Button
              variant='outlined'
              size='large'
              startIcon={<PauseRoundedIcon />}
              onClick={() => dispatch(pauseFocusTimer({ now: Date.now() }))}
              sx={{
                textTransform: 'none', fontWeight: 700, px: 4, py: 1.2,
                color: '#fff', borderColor: 'rgba(255,255,255,0.4)',
                '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)' }
              }}
            >
              {t('focusTimer.pause')}
            </Button>
          ) : (
            <Button
              variant='contained'
              size='large'
              startIcon={<PlayArrowRoundedIcon />}
              onClick={() => dispatch(startFocusTimer({ now: Date.now() }))}
              sx={{ textTransform: 'none', fontWeight: 700, px: 4, py: 1.2, bgcolor: modeConfig.color }}
            >
              {t('focusTimer.resume')}
            </Button>
          )}
          <Tooltip title={t('focusTimer.stopHint')}>
            <IconButton
              onClick={() => dispatch(stopFocusSession())}
              aria-label={t('focusTimer.stopHint')}
              size='large'
              sx={{
                color: '#fff', bgcolor: 'rgba(255,86,48,0.85)',
                '&:hover': { bgcolor: '#ff5630' },
                width: 52, height: 52
              }}
            >
              <StopRoundedIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.45)', mt: 1 }}>
          {t('focusPage.fullscreenHint')}
        </Typography>
      </Box>
    </motion.div>
  )
}

export default function Focus() {
  const { t } = useTranslation()
  const theme = useTheme()
  const dispatch = useDispatch()

  const timerState = useSelector(selectFocusTimerState)
  const plan = useSelector(selectFocusPlan)
  const focusTask = useSelector(selectFocusTask)
  const currentUser = useSelector(selectCurrentUser)

  // Quản lý dữ liệu Thẻ đang được chọn (để hiển thị và tương tác Checklist cả trong và ngoài Fullscreen)
  const [activeCardData, setActiveCardData] = useState(null)

  // Tự động tải dữ liệu thẻ khi focusTask có cardId & boardId (ví dụ khi từ ActiveCard nhảy sang hoặc hydrate lại)
  useEffect(() => {
    if (!focusTask?.cardId || !focusTask?.boardId) {
      if (!focusTask?.cardId) setActiveCardData(null)
      return
    }
    if (activeCardData?._id === focusTask.cardId) return

    let isMounted = true
    fetchBoardDetailsAPI(focusTask.boardId)
      .then((boardDetails) => {
        if (!isMounted) return
        const card = (boardDetails?.columns || []).flatMap((col) => col.cards || []).find((c) => c._id === focusTask.cardId)
        if (card) {
          setActiveCardData(card)
        }
      })
      .catch(() => {})

    return () => { isMounted = false }
  }, [focusTask?.cardId, focusTask?.boardId, activeCardData?._id])

  // Handler toggle checklist item: cập nhật optimistic, lưu DB qua API và đồng bộ Redux store
  const handleToggleChecklistItem = useCallback(async (checklistId, itemId, checked) => {
    const currentCard = activeCardData
    if (!currentCard?._id) return

    const updatedChecklists = (currentCard.checklists || []).map((cl) => {
      const matchCl = (cl._id || cl.title) === checklistId || cl.items?.some((it) => (it._id || it.title) === itemId)
      if (!matchCl) return cl
      return {
        ...cl,
        items: (cl.items || []).map((it) =>
          (it._id || it.title) === itemId
            ? { ...it, isDone: checked }
            : it
        )
      }
    })

    const totalItems = updatedChecklists.reduce((sum, cl) => sum + (cl.items?.length || 0), 0)
    const completedItems = updatedChecklists.reduce((sum, cl) => sum + (cl.items?.filter(i => i.isDone).length || 0), 0)
    let isDueDateComplete = currentCard.isDueDateComplete
    if (currentCard.dueDate && totalItems > 0) {
      isDueDateComplete = (completedItems === totalItems)
    }

    const optimisticCard = { ...currentCard, checklists: updatedChecklists, isDueDateComplete }
    setActiveCardData(optimisticCard)

    try {
      const updatePayload = { checklists: updatedChecklists }
      if (isDueDateComplete !== currentCard.isDueDateComplete) {
        updatePayload.isDueDateComplete = isDueDateComplete
      }
      const updatedCard = await updateCardDetailsAPI(currentCard._id, updatePayload)
      if (updatedCard) {
        setActiveCardData(updatedCard)
        dispatch(updateCardInBoard(updatedCard))
        dispatch(updateCurrentActiveCard(updatedCard))
      }
    } catch {
      setActiveCardData(currentCard)
    }
  }, [activeCardData, dispatch])

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!timerState.isRunning) return
    const interval = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(interval)
  }, [timerState.isRunning])

  // Cấu hình chuỗi (local state cho form) - chỉ init SAU khi đã hydrate đúng user
  const hydrated = timerState.hydrated === true
  const [focusMinutes, setFocusMinutes] = useState(plan.focusMinutes)
  const [repeats, setRepeats] = useState(plan.repeats)
  const [breakMode, setBreakMode] = useState(plan.breakMode)

  // Khi hydrate xong (hoặc đổi user): nạp cấu hình chuỗi đã lưu vào form
  useEffect(() => {
    if (!hydrated) return
    setFocusMinutes(plan.focusMinutes)
    setRepeats(plan.repeats)
    setBreakMode(plan.breakMode)
    // Chỉ chạy khi cờ hydrated đổi - giữ nguyên form khi user đang gõ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  const remainingMs = timerState.isRunning && timerState.endAt
    ? Math.max(0, timerState.endAt - now)
    : timerState.remainingMs

  // Khi idle ở mode Focus: vòng đếm luôn phản ánh đúng cấu hình chuỗi (plan form là nguồn chuẩn)
  useEffect(() => {
    if (!hydrated) return
    if (!plan.active && !timerState.isRunning && timerState.mode === 'focus') {
      dispatch(setCustomMinutes(plan.focusMinutes))
    }
  }, [hydrated, plan.focusMinutes, plan.active, timerState.isRunning, timerState.mode, dispatch])

  // Phiên đang diễn ra (đang chạy / nghỉ trong chuỗi / tạm dừng giữa chừng) -> toàn màn hình
  const sessionActive = timerState.isRunning || plan.active || remainingMs !== timerState.durationMs

  // ==================== Insights (stats + leaderboard) ====================
  const [stats, setStats] = useState(null)
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('week')
  const [leaderboardPage, setLeaderboardPage] = useState(1)
  const [leaderboard, setLeaderboard] = useState(null)

  const loadInsights = useCallback(async () => {
    if (!currentUser) return
    try {
      const nowDayjs = dayjs()
      const ranges = {
        day: [nowDayjs.startOf('day').valueOf(), nowDayjs.endOf('day').valueOf() + 1],
        week: [nowDayjs.startOf('week').valueOf(), nowDayjs.endOf('week').valueOf() + 1],
        month: [nowDayjs.startOf('month').valueOf(), nowDayjs.endOf('month').valueOf() + 1]
      }
      const [day, week, month] = await Promise.all([
        getFocusStatsAPI(ranges.day[0], ranges.day[1]),
        getFocusStatsAPI(ranges.week[0], ranges.week[1]),
        getFocusStatsAPI(ranges.month[0], ranges.month[1])
      ])
      setStats({ day, week, month })

      const [from, to] = leaderboardPeriod === 'month'
        ? [nowDayjs.startOf('month').valueOf(), nowDayjs.endOf('month').valueOf() + 1]
        : [nowDayjs.startOf('week').valueOf(), nowDayjs.endOf('week').valueOf() + 1]
      setLeaderboard(await getFocusLeaderboardAPI(from, to, leaderboardPage))
    } catch {
      // im lặng
    }
  }, [currentUser, leaderboardPeriod, leaderboardPage])

  useEffect(() => {
    loadInsights()
  }, [loadInsights, timerState.pomodoroCount])

  const modeConfig = TIMER_MODES[timerState.mode]
  const progress = timerState.durationMs > 0 ? 1 - remainingMs / timerState.durationMs : 0
  const ringSize = 230
  const ringStroke = 12
  const ringRadius = (ringSize - ringStroke) / 2
  const ringCircumference = 2 * Math.PI * ringRadius

  // Tổng thời gian chuỗi: focus × repeats + break × (repeats - 1)
  const planSummary = useMemo(() => {
    const focusMs = Math.max(1, Number(focusMinutes) || 1) * 60000
    const breakMs = (breakMode === 'long' ? 15 : 5) * 60000
    const reps = Math.max(1, Number(repeats) || 1)
    const total = focusMs * reps + breakMs * (reps - 1)
    return { total, reps }
  }, [focusMinutes, repeats, breakMode])

  const handleStartPlan = () => {
    dispatch(startFocusPlan({ focusMinutes: Math.max(1, Number(focusMinutes) || 1), repeats: Math.max(1, Number(repeats) || 1), breakMode }))
  }

  const renderStatRow = (label, data) => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75 }}>
      <Typography variant='body2' sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
          {stats ? formatDurationShort(data?.totalMs || 0) : '—'}
        </Typography>
        <Typography variant='caption' sx={{ color: 'text.secondary' }}>
          {stats ? `· ${data?.sessionCount || 0} ${t('focusTimer.sessionsUnit')}` : ''}
        </Typography>
      </Box>
    </Box>
  )

  return (
    <Box sx={{
      minHeight: '100vh',
      background: (themeBg) => themeBg.palette.mode === 'dark'
        ? 'linear-gradient(180deg, #0f172a 0%, #101828 100%)'
        : 'linear-gradient(180deg, #f4f5f7 0%, #eaf1fb 100%)',
      pb: { xs: 'calc(76px + env(safe-area-inset-bottom, 0px))', sm: 4 }
    }}>
      <AppBar />

      <Container maxWidth='xl' sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2.5, alignItems: 'stretch' }}>
          {/* TRÁI: vòng tròn tập trung */}
          <Paper elevation={0} sx={{
            flexShrink: 0, width: { xs: '100%', md: 420 },
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            p: { xs: 2.5, md: 3 }, borderRadius: 4,
            border: '1px solid', borderColor: 'divider',
            bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? '#101828' : '#fff',
            boxShadow: '0 8px 30px rgba(0, 82, 204, 0.10)'
          }}>
            {/* Vòng lặp đang chạy */}
            {plan.active && (
              <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                {Array.from({ length: plan.repeats }, (_, i) => {
                  const roundNo = i + 1
                  const done = plan.phase === 'focus' ? roundNo < plan.round : roundNo <= plan.round - 1
                  const current = roundNo === plan.round
                  return (
                    <Chip
                      key={roundNo}
                      size='small'
                      label={t('focusPage.roundChip', { n: roundNo })}
                      sx={{
                        fontWeight: 700,
                        ...(done ? { bgcolor: '#00875a', color: '#fff' } : {}),
                        ...(current ? { bgcolor: '#0052cc', color: '#fff' } : {}),
                        ...(done || current ? {} : { bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? '#1e293b' : '#f1f3f5' })
                      }}
                    />
                  )
                })}
              </Box>
            )}

            {/* Quầng sáng sau vòng tròn */}
            <Box sx={{ position: 'relative', mb: 1.5 }}>
              <Box sx={{
                position: 'absolute', inset: -30, borderRadius: '50%',
                background: `radial-gradient(circle, ${modeConfig.color}26 0%, transparent 70%)`,
                filter: 'blur(6px)'
              }} />
              <Box sx={{ position: 'relative' }}>
                <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
                  <circle
                    cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
                    fill='none'
                    stroke={theme.palette.mode === 'dark' ? '#1e293b' : '#e9ecef'}
                    strokeWidth={ringStroke}
                  />
                  <circle
                    cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
                    fill='none'
                    stroke={modeConfig.color}
                    strokeWidth={ringStroke}
                    strokeLinecap='round'
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringCircumference * (1 - progress)}
                    style={{ transition: 'stroke-dashoffset 0.5s linear' }}
                  />
                </svg>
                <Box sx={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center'
                }}>
                  <Typography sx={{ fontSize: 44, fontWeight: 800, letterSpacing: 1, color: (themeBg) => themeBg.palette.mode === 'dark' ? '#e2e8f0' : '#101828', lineHeight: 1.1 }}>
                    {formatCountdown(remainingMs)}
                  </Typography>
                  <Typography sx={{ color: 'text.secondary', fontWeight: 700 }}>
                    {plan.active
                      ? t('focusPage.roundOf', { round: plan.round, repeats: plan.repeats })
                      : t(`focusTimer.mode.${modeConfig.label}`)}
                  </Typography>
                  {timerState.mode === 'focus' && timerState.pomodoroCount > 0 && (
                    <Typography variant='caption' sx={{ color: 'text.secondary', fontWeight: 600, mt: 0.5 }}>
                      🍅 {timerState.pomodoroCount}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Nhiệm vụ đang focus */}
            {focusTask?.title && (
              <Chip
                label={`🎯 ${t('focusTimer.focusingOn')}: ${focusTask.title}`}
                sx={{ mb: 1.5, maxWidth: '100%', bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? '#1e293b' : '#f1f3f5', fontWeight: 600 }}
              />
            )}

            {/* Điều khiển */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 0.5 }}>
              {!timerState.isRunning && (
                <Button
                  variant='contained'
                  size='large'
                  startIcon={remainingMs < timerState.durationMs && remainingMs > 0 ? <PlayArrowRoundedIcon /> : <TimerRoundedIcon />}
                  onClick={() => {
                    if (remainingMs < timerState.durationMs && remainingMs > 0) {
                      dispatch(startFocusTimer({ now: Date.now() }))
                    } else {
                      handleStartPlan()
                    }
                  }}
                  sx={{ textTransform: 'none', fontWeight: 700, bgcolor: modeConfig.color, px: 4, py: 1.1, borderRadius: 2.5 }}
                >
                  {remainingMs < timerState.durationMs && remainingMs > 0 ? t('focusTimer.resume') : t('focusTimer.start')}
                </Button>
              )}
              {timerState.isRunning && (
                <>
                  <Button
                    variant='contained'
                    size='large'
                    startIcon={<PauseRoundedIcon />}
                    onClick={() => dispatch(pauseFocusTimer({ now: Date.now() }))}
                    sx={{ textTransform: 'none', fontWeight: 700, bgcolor: modeConfig.color, px: 3, py: 1.1, borderRadius: 2.5 }}
                  >
                    {t('focusTimer.pause')}
                  </Button>
                  <Tooltip title={t('focusTimer.stopHint')}>
                    <IconButton
                      onClick={() => dispatch(stopFocusSession())}
                      sx={{ color: '#fff', bgcolor: 'rgba(255,86,48,0.85)', '&:hover': { bgcolor: '#ff5630' }, width: 46, height: 46 }}
                      aria-label={t('focusTimer.stopHint')}
                    >
                      <StopRoundedIcon />
                    </IconButton>
                  </Tooltip>
                </>
              )}
              {!timerState.isRunning && remainingMs !== timerState.durationMs && (
                <Tooltip title={t('focusTimer.reset')}>
                  <IconButton onClick={() => dispatch(resetFocusTimer())} aria-label={t('focusTimer.reset')} size='large'>
                    <RestartAltRoundedIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {/* Tổng focus hôm nay - lấp khoảng trống dưới card */}
            {stats && (
              <Chip
                label={`${t('focusPage.todayFocus')}: ${formatDurationShort(stats.day?.totalMs || 0)}`}
                sx={{
                  mt: 2,
                  fontWeight: 700,
                  bgcolor: 'rgba(0,82,204,0.10)',
                  color: '#0052cc'
                }}
              />
            )}


            {/* Phần setup: nhiệm vụ + chế độ lặp - nằm cùng cột với vòng đếm */}
            <Divider sx={{ my: 1.5, alignSelf: 'stretch' }} />

            <Box sx={{ alignSelf: 'stretch', width: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <EventNoteRoundedIcon sx={{ color: '#0052cc', fontSize: 20 }} />
                <Typography sx={{ fontWeight: 700 }}>
                  {t('focusPage.taskSection')}
                </Typography>
              </Box>
              <TaskCascade
                initialTask={focusTask}
                activeCardChecklists={activeCardData?.checklists || []}
                onActiveCardChange={(card) => setActiveCardData(card)}
                onToggleChecklistItem={handleToggleChecklistItem}
                onChainChange={(chain) => {
                  dispatch(setFocusTask({
                    cardId: chain.cardId || null,
                    boardId: chain.boardId || null,
                    title: chain.itemTitle || chain.cardTitle || null,
                    cardTitle: chain.cardTitle || null,
                    boardTitle: chain.boardTitle || null,
                    checklistId: chain.checklistId || null,
                    checklistTitle: chain.checklistTitle || null,
                    checklistItemId: chain.checklistItemId || null,
                    itemTitle: chain.itemTitle || null
                  }))
                }}
                onClearTask={() => {
                  setActiveCardData(null)
                  dispatch(setFocusTask(null))
                }}
              />
              <Typography variant='caption' sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                {t('focusPage.taskHint')}
              </Typography>
            </Box>

            <Divider sx={{ my: 1.5, alignSelf: 'stretch' }} />

            <Box sx={{ alignSelf: 'stretch', width: '100%' }}>
              <Typography sx={{ fontWeight: 700, mb: 1.5 }}>
                {t('focusPage.planSection')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-end', mb: 1.5 }}>
                <TextField
                  type='number'
                  size='small'
                  label={t('focusPage.focusMinutes')}
                  value={focusMinutes}
                  disabled={plan.active}
                  onChange={(e) => {
                    setFocusMinutes(e.target.value)
                    // Đồng bộ ngay vào timer state để vòng đếm bên trái đổi theo
                    dispatch(setCustomMinutes(e.target.value))
                    // Đang idle ở mode nghỉ mà sửa số phút tập trung -> quay về mode Focus
                    if (!timerState.isRunning && timerState.mode !== 'focus') {
                      dispatch(switchTimerMode('focus'))
                    }
                  }}
                  InputProps={{ inputProps: { min: 1, max: 180 } }}
                  sx={{ width: 140, '& input': { textAlign: 'center' } }}
                />
                <TextField
                  type='number'
                  size='small'
                  label={t('focusPage.repeats')}
                  value={repeats}
                  disabled={plan.active}
                  onChange={(e) => setRepeats(e.target.value)}
                  InputProps={{ inputProps: { min: 1, max: 12 } }}
                  sx={{ width: 130, '& input': { textAlign: 'center' } }}
                />
                <Box>
                  <Typography variant='caption' sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    {t('focusPage.breakMode')}
                  </Typography>
                  <ToggleButtonGroup
                    value={breakMode}
                    exclusive
                    onChange={(e, v) => v && setBreakMode(v)}
                    size='small'
                    disabled={plan.active}
                    sx={{
                      gap: 0.75,
                      // Mỗi nút là pill riêng (gap làm hỏng bo góc grouped mặc định của MUI)
                      '& .MuiToggleButtonGroup-grouped': {
                        borderRadius: '10px !important',
                        border: '1px solid',
                        borderColor: 'divider',
                        textTransform: 'none',
                        fontWeight: 600,
                        '&.Mui-selected': {
                          bgcolor: 'rgba(0, 82, 204, 0.12)',
                          color: '#0052cc',
                          borderColor: 'rgba(0, 82, 204, 0.45)',
                          '&:hover': { bgcolor: 'rgba(0, 82, 204, 0.18)' }
                        }
                      }
                    }}
                  >
                    <ToggleButton value='short'>{t('focusPage.breakShort')}</ToggleButton>
                    <ToggleButton value='long'>{t('focusPage.breakLong')}</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              </Box>

              <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                {t('focusPage.summary', {
                  focus: Math.max(1, Number(focusMinutes) || 1),
                  repeats: planSummary.reps,
                  breakMode: breakMode === 'long' ? t('focusPage.breakModeLongText') : t('focusPage.breakModeShortText'),
                  breakMinutes: breakMode === 'long' ? 15 : 5,
                  total: formatDurationShort(planSummary.total)
                })}
              </Typography>
            </Box>
          </Paper>

          {/* PHẢI: nhiệm vụ + chế độ lặp + thống kê */}
          <Box sx={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Thống kê + bảng xếp hạng */}
            <Paper elevation={0} sx={{
              p: { xs: 2, md: 2.5 }, borderRadius: 4,
              border: '1px solid', borderColor: 'divider',
              bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? '#101828' : '#fff',
              boxShadow: '0 4px 18px rgba(0, 82, 204, 0.07)'
            }}>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>
                {t('focusTimer.myStats')}
              </Typography>
              <Box sx={{ px: 0.5 }}>
                {renderStatRow(t('focusTimer.period.today'), stats?.day)}
                <Divider />
                {renderStatRow(t('focusTimer.period.thisWeek'), stats?.week)}
                <Divider />
                {renderStatRow(t('focusTimer.period.thisMonth'), stats?.month)}
              </Box>
            </Paper>

            {/* Bảng xếp hạng - card riêng */}
            <Paper elevation={0} sx={{
              p: { xs: 2, md: 2.5 }, borderRadius: 4,
              border: '1px solid', borderColor: 'divider',
              bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? '#101828' : '#fff',
              boxShadow: '0 4px 18px rgba(0, 82, 204, 0.07)'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <EmojiEventsRoundedIcon sx={{ fontSize: 20, color: '#ffab00' }} />
                  <Typography sx={{ fontWeight: 700 }}>
                    {t('focusTimer.leaderboard')}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {['week', 'month'].map((period) => (
                    <Chip
                      key={period}
                      label={t(`focusTimer.period.${period === 'week' ? 'thisWeekShort' : 'thisMonthShort'}`)}
                      size='small'
                      onClick={() => setLeaderboardPeriod(period)}
                      sx={{
                        fontWeight: 600,
                        ...(leaderboardPeriod === period
                          ? { bgcolor: '#0052cc', color: '#fff' }
                          : { bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? '#1e293b' : '#f1f3f5' })
                      }}
                    />
                  ))}
                </Box>
              </Box>

              <Paper variant='outlined' sx={{ overflow: 'hidden', bgcolor: (themeBg) => themeBg.palette.mode === 'dark' ? '#0b1220' : '#fafbfc' }}>
                {(leaderboard?.top || []).length === 0 && (
                  <Typography sx={{ px: 1.5, py: 2, color: 'text.secondary', textAlign: 'center', fontSize: '0.85rem' }}>
                    {t('focusTimer.leaderboardEmpty')}
                  </Typography>
                )}
                {(leaderboard?.top || []).map((row) => {
                  const isMe = row.userId === currentUser._id
                  return (
                    <Box
                      key={row.userId}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        ...(isMe ? { bgcolor: 'rgba(0, 82, 204, 0.10)' } : {})
                      }}
                    >
                      <Typography sx={{ width: 26, textAlign: 'center', fontWeight: 700, fontSize: '0.95rem' }}>
                        {RANK_MEDALS[row.rank] || row.rank}
                      </Typography>
                      <Avatar src={row.avatar || undefined} sx={{ width: 26, height: 26, fontSize: '0.8rem' }}>
                        {row.displayName?.charAt(0)?.toUpperCase()}
                      </Avatar>
                      <Typography sx={{ flex: 1, fontSize: '0.9rem', fontWeight: isMe ? 700 : 500, noWrap: true, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.displayName}{isMe ? ` (${t('focusTimer.you')})` : ''}
                      </Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#0052cc' }}>
                        {formatDurationShort(row.totalMs)}
                      </Typography>
                    </Box>
                  )
                })}

                {leaderboard?.me && leaderboard.me.rank > (leaderboard?.top?.length || 0) && (
                  <>
                    <Divider />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, bgcolor: 'rgba(0, 82, 204, 0.10)' }}>
                      <Typography sx={{ width: 26, textAlign: 'center', fontWeight: 700, fontSize: '0.95rem' }}>
                        {leaderboard.me.rank}
                      </Typography>
                      <Avatar src={leaderboard.me.avatar || undefined} sx={{ width: 26, height: 26, fontSize: '0.8rem' }}>
                        {leaderboard.me.displayName?.charAt(0)?.toUpperCase()}
                      </Avatar>
                      <Typography sx={{ flex: 1, fontSize: '0.9rem', fontWeight: 700, noWrap: true, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {leaderboard.me.displayName} ({t('focusTimer.you')})
                      </Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#0052cc' }}>
                        {formatDurationShort(leaderboard.me.totalMs)}
                      </Typography>
                    </Box>
                  </>
                )}
              </Paper>

              {/* Phân trang khi nhiều user */}
              {(leaderboard?.totalPages || 1) > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                  <Pagination
                    count={leaderboard.totalPages}
                    page={leaderboard?.page || 1}
                    onChange={(e, newPage) => setLeaderboardPage(newPage)}
                    size='small'
                    color='primary'
                  />
                </Box>
              )}
            </Paper>
          </Box>
        </Box>
      </Container>

      {/* TOÀN MÀN HÌNH khi phiên đang chạy - chỉ thoát bằng Dừng / hoàn thành */}
      <AnimatePresence>
        {sessionActive && (
          <FocusFullscreen
            key='focus-fullscreen'
            timerState={timerState}
            plan={plan}
            focusTask={focusTask}
            remainingMs={remainingMs}
            modeConfig={modeConfig}
            progress={progress}
            cardChecklists={activeCardData?.checklists || []}
            onToggleChecklistItem={handleToggleChecklistItem}
          />
        )}
      </AnimatePresence>
    </Box>
  )
}
