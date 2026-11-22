import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfirm } from 'material-ui-confirm'
import { toast } from 'react-toastify'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import CircularProgress from '@mui/material/CircularProgress'
import dayjs from 'dayjs'

import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'

import ResponsivePopover from '~/components/Common/ResponsivePopover'
import { fetchBoardsAPI, fetchBoardDetailsAPI } from '~/apis'
import { SCHEDULE_COLOR_PALETTE } from './constants'

/** Màu entry lịch - map với SCHEDULE_ENTRY_COLORS của backend */
const COLOR_KEYS = Object.keys(SCHEDULE_COLOR_PALETTE)

export default function ScheduleEntryPopover({ state, onClose, onSave, onDelete }) {
  const { t } = useTranslation()
  const confirm = useConfirm()

  const isOpen = Boolean(state)
  const isEditMode = state?.mode === 'edit'

  // ==================== Form state ====================
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dateStr, setDateStr] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [colorKey, setColorKey] = useState('blue')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // ==================== Gắn card ====================
  const [boards, setBoards] = useState([])
  const [selectedBoardId, setSelectedBoardId] = useState('')
  const [selectedCardId, setSelectedCardId] = useState('')
  const [cardOptions, setCardOptions] = useState([])
  const [boardDetailsLoading, setBoardDetailsLoading] = useState(false)
  const [attachedCard, setAttachedCard] = useState(null) // { cardId, boardId, cardTitle, boardTitle }
  const [attachedBoardTitle, setAttachedBoardTitle] = useState(null)
  const [cardChecklists, setCardChecklists] = useState(null) // checklist của card khi edit (read-only)

  // Reset form mỗi lần mở popover
  useEffect(() => {
    if (!isOpen) return

    if (state.mode === 'edit' && state.entry) {
      const entry = state.entry
      setTitle(entry.title || '')
      setDescription(entry.description || '')
      setDateStr(dayjs(entry.startAt).format('YYYY-MM-DD'))
      setStartTime(dayjs(entry.startAt).format('HH:mm'))
      setEndTime(dayjs(entry.endAt).format('HH:mm'))
      setColorKey(entry.colorKey || 'blue')
      if (entry.cardId) {
        setAttachedCard({
          cardId: entry.cardId,
          boardId: entry.boardId,
          cardTitle: entry.cardTitle,
          boardTitle: entry.boardTitle
        })
        setSelectedBoardId(entry.boardId || '')
        setSelectedCardId(entry.cardId)
        setAttachedBoardTitle(entry.boardTitle || null)
      } else {
        setAttachedCard(null)
        setSelectedBoardId('')
        setSelectedCardId('')
        setAttachedBoardTitle(null)
      }
      setCardChecklists(null)
    } else if (state.mode === 'create' && state.draft) {
      setTitle('')
      setDescription('')
      setDateStr(dayjs(state.draft.startAt).format('YYYY-MM-DD'))
      setStartTime(dayjs(state.draft.startAt).format('HH:mm'))
      setEndTime(dayjs(state.draft.endAt).format('HH:mm'))
      setColorKey('blue')
      setAttachedCard(null)
      setSelectedBoardId('')
      setSelectedCardId('')
      setAttachedBoardTitle(null)
      setCardChecklists(null)
    }
  }, [isOpen, state])

  // Fetch danh sách board khi mở popover lần đầu
  useEffect(() => {
    if (!isOpen || boards.length > 0) return
    fetchBoardsAPI('?page=1&itemsPerPage=100')
      .then((data) => setBoards(data.boards || []))
      .catch(() => { /* lỗi đã toast ở interceptor */ })
  }, [isOpen, boards.length])

  // Khi chọn board: fetch chi tiết board để lấy danh sách card (và checklist của card đang gắn)
  useEffect(() => {
    if (!isOpen || !selectedBoardId) {
      setCardOptions([])
      return
    }

    let cancelled = false
    setBoardDetailsLoading(true)
    fetchBoardDetailsAPI(selectedBoardId)
      .then((boardDetails) => {
        if (cancelled) return
        // Flatten toàn bộ card trong mọi column
        const cards = (boardDetails.columns || []).flatMap((column) => (column.cards || []))
        setCardOptions(cards)
        setAttachedBoardTitle(boardDetails.title || null)

        // Nếu đang edit và card gắn thuộc board này: lấy checklist hiển thị read-only
        const cardIdToInspect = isEditMode ? state?.entry?.cardId : null
        if (cardIdToInspect) {
          const card = cards.find((c) => c._id === cardIdToInspect)
          if (card) {
            setCardChecklists(card.checklists || [])
            setAttachedCard({
              cardId: card._id,
              boardId: boardDetails._id,
              cardTitle: card.title,
              boardTitle: boardDetails.title
            })
          }
        }
      })
      .catch(() => {
        if (!cancelled) setCardOptions([])
      })
      .finally(() => {
        if (!cancelled) setBoardDetailsLoading(false)
      })

    return () => { cancelled = true }
  }, [isOpen, selectedBoardId, isEditMode, state?.entry?.cardId])

  const handleSelectCard = (cardId) => {
    setSelectedCardId(cardId)
    if (!cardId) {
      setAttachedCard(null)
      setCardChecklists(null)
      return
    }
    const card = cardOptions.find((c) => c._id === cardId)
    if (card) {
      setAttachedCard({
        cardId: card._id,
        boardId: selectedBoardId,
        cardTitle: card.title,
        boardTitle: attachedBoardTitle
      })
      setCardChecklists(card.checklists || [])
    }
  }

  const handleDetachCard = () => {
    setSelectedCardId('')
    setAttachedCard(null)
    setCardChecklists(null)
  }

  const buildPayload = () => {
    const startAt = dayjs(`${dateStr}T${startTime}`).valueOf()
    const endAt = dayjs(`${dateStr}T${endTime}`).valueOf()

    if (!title.trim()) {
      toast.error(t('schedule.titleRequired'))
      return null
    }
    if (!dateStr) {
      toast.error(t('schedule.dateRequired'))
      return null
    }
    if (endAt <= startAt) {
      toast.error(t('schedule.invalidTimeRange'))
      return null
    }
    if (endAt - startAt > 24 * 60 * 60 * 1000) {
      toast.error(t('schedule.spanTooLong'))
      return null
    }

    return {
      title: title.trim(),
      description: description.trim(),
      startAt,
      endAt,
      colorKey,
      cardId: attachedCard?.cardId || null,
      boardId: attachedCard?.boardId || null,
      cardTitle: attachedCard?.cardTitle || null,
      boardTitle: attachedCard?.boardTitle || null
    }
  }

  const handleSave = async () => {
    const payload = buildPayload()
    if (!payload) return

    setIsSaving(true)
    try {
      await onSave(isEditMode ? state.entry._id : null, payload)
      onClose()
    } catch {
      // lỗi đã toast ở interceptor
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    confirm({
      title: t('schedule.deleteConfirmTitle'),
      description: t('schedule.deleteConfirmDescription'),
      confirmationText: t('common.confirm'),
      cancellationText: t('common.cancel')
    }).then(async () => {
      setIsDeleting(true)
      try {
        await onDelete(state.entry._id)
        onClose()
      } catch {
        // lỗi đã toast ở interceptor
      } finally {
        setIsDeleting(false)
      }
    }).catch(() => { /* hủy confirm */ })
  }

  const checklistStats = (() => {
    if (!cardChecklists) return null
    const allItems = cardChecklists.flatMap((cl) => cl.items || [])
    if (allItems.length === 0) return null
    const doneCount = allItems.filter((item) => item.isDone).length
    return { done: doneCount, total: allItems.length }
  })()

  return (
    <ResponsivePopover
      open={isOpen}
      anchorEl={state?.anchorEl || null}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: { width: 380, maxWidth: '100%', p: 2, overflowY: 'auto' }
        }
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, flex: 1 }}>
          {isEditMode ? t('schedule.editEntry') : t('schedule.createEntry')}
        </Typography>
        {isEditMode && (
          <IconButton
            size='small'
            onClick={handleDelete}
            disabled={isDeleting}
            sx={{ color: '#ff5630' }}
            aria-label={t('schedule.deleteEntry')}
          >
            <DeleteRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        )}
        <IconButton size='small' onClick={onClose} aria-label={t('common.close')}>
          <CloseRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Tiêu đề */}
      <TextField
        autoFocus
        fullWidth
        size='small'
        label={t('schedule.titleLabel')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        sx={{ mb: 1.5 }}
      />

      {/* Mô tả */}
      <TextField
        fullWidth
        size='small'
        multiline
        minRows={2}
        maxRows={4}
        label={t('schedule.descriptionLabel')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        sx={{ mb: 1.5 }}
      />

      {/* Ngày + giờ */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
        <TextField
          fullWidth
          size='small'
          type='date'
          label={t('schedule.dateLabel')}
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center' }}>
        <TextField
          fullWidth
          size='small'
          type='time'
          label={t('schedule.startTimeLabel')}
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ step: 900 }}
        />
        <Typography sx={{ color: 'text.secondary' }}>→</Typography>
        <TextField
          fullWidth
          size='small'
          type='time'
          label={t('schedule.endTimeLabel')}
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ step: 900 }}
        />
      </Box>

      {/* Chọn màu */}
      <Typography variant='caption' sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
        {t('schedule.colorLabel')}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
        {COLOR_KEYS.map((key) => (
          <Box
            key={key}
            onClick={() => setColorKey(key)}
            sx={{
              width: 28, height: 28, borderRadius: '50%',
              bgcolor: SCHEDULE_COLOR_PALETTE[key],
              cursor: 'pointer',
              border: colorKey === key ? '2px solid' : '2px solid transparent',
              borderColor: colorKey === key ? (theme) => theme.palette.text.primary : 'transparent',
              transition: 'transform 0.1s ease',
              '&:hover': { transform: 'scale(1.15)' }
            }}
          />
        ))}
      </Box>

      <Divider sx={{ mb: 1.5 }} />

      {/* Gắn card */}
      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 1 }}>
        {t('schedule.attachCard')}
      </Typography>

      <Select
        fullWidth
        size='small'
        displayEmpty
        value={selectedBoardId}
        onChange={(e) => {
          setSelectedBoardId(e.target.value)
          setSelectedCardId('')
          setAttachedCard(null)
          setCardChecklists(null)
        }}
        sx={{ mb: 1 }}
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

      {selectedBoardId && (
        <Select
          fullWidth
          size='small'
          displayEmpty
          value={selectedCardId}
          onChange={(e) => handleSelectCard(e.target.value)}
          sx={{ mb: 1 }}
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
              <Typography sx={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>
                {card.title}
              </Typography>
            </MenuItem>
          ))}
        </Select>
      )}

      {boardDetailsLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      {/* Preview card đã gắn + checklist read-only */}
      {attachedCard && (
        <Box sx={{
          bgcolor: (theme) => theme.palette.mode === 'dark' ? '#0b1220' : '#f8fafc',
          borderRadius: 1.5, p: 1, mb: 1.5
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              size='small'
              label={`🎯 ${attachedCard.cardTitle}`}
              sx={{ fontWeight: 600, maxWidth: 'calc(100% - 44px)' }}
            />
            <Box sx={{ flex: 1 }} />
            <IconButton size='small' onClick={handleDetachCard} aria-label={t('schedule.detachCard')}>
              <CloseRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
          {attachedBoardTitle && (
            <Typography variant='caption' sx={{ color: 'text.secondary', display: 'block', mt: 0.5, px: 0.5 }}>
              {t('schedule.inBoard')}: {attachedBoardTitle}
            </Typography>
          )}

          {checklistStats && (
            <Box sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <TaskAltRoundedIcon sx={{ fontSize: 16, color: '#00875a' }} />
                <Typography variant='caption' sx={{ fontWeight: 700 }}>
                  {t('schedule.cardChecklist')}: {checklistStats.done}/{checklistStats.total}
                </Typography>
              </Box>
              {cardChecklists.map((checklist) => (
                <Box key={checklist._id || checklist.title} sx={{ mb: 0.5 }}>
                  <Typography variant='caption' sx={{ fontWeight: 700, display: 'block' }}>
                    {checklist.title}
                  </Typography>
                  {(checklist.items || []).map((item, index) => (
                    <FormControlLabel
                      key={item._id || index}
                      disabled
                      control={<Checkbox checked={Boolean(item.isDone)} size='small' sx={{ py: 0 }} />}
                      label={
                        <Typography variant='caption' sx={{
                          textDecoration: item.isDone ? 'line-through' : 'none',
                          color: item.isDone ? 'text.disabled' : 'text.primary'
                        }}>
                          {item.title}
                        </Typography>
                      }
                      sx={{ display: 'flex', m: 0, alignItems: 'center' }}
                    />
                  ))}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Save */}
      <Button
        fullWidth
        variant='contained'
        onClick={handleSave}
        disabled={isSaving}
        sx={{ textTransform: 'none', fontWeight: 700 }}
      >
        {isSaving ? <CircularProgress size={20} color='inherit' /> : (isEditMode ? t('common.save') : t('schedule.createButton'))}
      </Button>
    </ResponsivePopover>
  )
}
