import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
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
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import dayjs from 'dayjs'

import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import TimerRoundedIcon from '@mui/icons-material/TimerRounded'

import ResponsivePopover from '~/components/Common/ResponsivePopover'
import { fetchBoardsAPI, fetchBoardDetailsAPI } from '~/apis'
import { setFocusTask } from '~/redux/focusTimer/focusTimerSlice'
import { SCHEDULE_COLOR_PALETTE } from './constants'

/** Màu entry lịch - map với SCHEDULE_ENTRY_COLORS của backend */
const COLOR_KEYS = Object.keys(SCHEDULE_COLOR_PALETTE)

export default function ScheduleEntryPopover({ state, onClose, onSave, onDelete }) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const isOpen = Boolean(state)
  const isEditMode = state?.mode === 'edit'

  // ==================== Form state ====================
  const [title, setTitle] = useState('')
  const [dateStr, setDateStr] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [colorKey, setColorKey] = useState('blue')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  // false = đã chọn xong nhiệm vụ (thu gọn chỉ hiện nhiệm vụ); true = đang mở lại các ô chọn
  const [editingAttach, setEditingAttach] = useState(false)

  // ==================== Gắn sâu: board → card → checklist → item ====================
  const [boards, setBoards] = useState([])
  const [selectedBoardId, setSelectedBoardId] = useState('')
  const [selectedCardId, setSelectedCardId] = useState('')
  const [selectedChecklistId, setSelectedChecklistId] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [cardOptions, setCardOptions] = useState([])
  const [boardDetailsLoading, setBoardDetailsLoading] = useState(false)
  // Chuỗi gắn (denormalize để render nhanh, BE lưu kèm entry)
  const [attachChain, setAttachChain] = useState(null)
  // { boardId, boardTitle, cardId, cardTitle, checklistId, checklistTitle, checklistItemId, itemTitle }

  // Reset form mỗi lần mở popover
  useEffect(() => {
    if (!isOpen) return

    if (state.mode === 'edit' && state.entry) {
      const entry = state.entry
      setTitle(entry.title || '')
      setDateStr(dayjs(entry.startAt).format('YYYY-MM-DD'))
      setStartTime(dayjs(entry.startAt).format('HH:mm'))
      setEndTime(dayjs(entry.endAt).format('HH:mm'))
      setColorKey(entry.colorKey || 'blue')
      if (entry.cardId) {
        setAttachChain({
          boardId: entry.boardId,
          boardTitle: entry.boardTitle,
          cardId: entry.cardId,
          cardTitle: entry.cardTitle,
          checklistId: entry.checklistId || null,
          checklistTitle: entry.checklistTitle || null,
          checklistItemId: entry.checklistItemId || null,
          itemTitle: entry.itemTitle || null
        })
        setSelectedBoardId(entry.boardId || '')
        setSelectedCardId(entry.cardId)
        setSelectedChecklistId(entry.checklistId || '')
        setSelectedItemId(entry.checklistItemId || '')
        setEditingAttach(false)
      } else {
        setAttachChain(null)
        setSelectedBoardId('')
        setSelectedCardId('')
        setSelectedChecklistId('')
        setSelectedItemId('')
      }
    } else if (state.mode === 'create' && state.draft) {
      setTitle(state.draft.title || '')
      setDateStr(dayjs(state.draft.startAt).format('YYYY-MM-DD'))
      setStartTime(dayjs(state.draft.startAt).format('HH:mm'))
      setEndTime(dayjs(state.draft.endAt).format('HH:mm'))
      setColorKey(state.draft.colorKey || 'blue')
      if (state.draft.cardId && state.draft.boardId) {
        setAttachChain({
          boardId: state.draft.boardId,
          boardTitle: state.draft.boardTitle || null,
          cardId: state.draft.cardId,
          cardTitle: state.draft.cardTitle || null,
          checklistId: state.draft.checklistId || null,
          checklistTitle: state.draft.checklistTitle || null,
          checklistItemId: state.draft.checklistItemId || null,
          itemTitle: state.draft.itemTitle || null
        })
        setSelectedBoardId(state.draft.boardId)
        setSelectedCardId(state.draft.cardId)
        setSelectedChecklistId(state.draft.checklistId || '')
        setSelectedItemId(state.draft.checklistItemId || '')
        setEditingAttach(false)
      } else {
        setAttachChain(null)
        setSelectedBoardId('')
        setSelectedCardId('')
        setSelectedChecklistId('')
        setSelectedItemId('')
        setEditingAttach(false)
      }
    }
  }, [isOpen, state])

  // Fetch danh sách board khi mở popover lần đầu
  useEffect(() => {
    if (!isOpen || boards.length > 0) return
    fetchBoardsAPI('?page=1&itemsPerPage=100')
      .then((data) => setBoards(data.boards || []))
      .catch(() => { /* lỗi đã toast ở interceptor */ })
  }, [isOpen, boards.length])

  // Khi chọn board: fetch chi tiết board để lấy danh sách card
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
        // Cập nhật boardTitle cho chuỗi gắn khi edit
        setAttachChain((prev) => (prev && prev.boardId === selectedBoardId ? { ...prev, boardTitle: boardDetails.title } : prev))
      })
      .catch(() => {
        if (!cancelled) setCardOptions([])
      })
      .finally(() => {
        if (!cancelled) setBoardDetailsLoading(false)
      })

    return () => { cancelled = true }
  }, [isOpen, selectedBoardId])

  const handleSelectCard = (cardId) => {
    setSelectedCardId(cardId)
    setSelectedChecklistId('')
    setSelectedItemId('')
    if (!cardId) {
      setAttachChain(null)
      return
    }
    const card = cardOptions.find((c) => c._id === cardId)
    if (card) {
      setAttachChain((prev) => ({
        ...(prev || {}),
        boardId: selectedBoardId,
        cardId: card._id,
        cardTitle: card.title,
        checklistId: null,
        checklistTitle: null,
        checklistItemId: null,
        itemTitle: null
      }))
    }
  }

  const handleSelectChecklist = (checklistId) => {
    setSelectedChecklistId(checklistId)
    setSelectedItemId('')
    const card = cardOptions.find((c) => c._id === selectedCardId)
    const checklist = card?.checklists?.find((cl) => (cl._id || cl.title) === checklistId)
    if (!checklistId || !checklist) {
      setAttachChain((prev) => (prev ? { ...prev, checklistId: null, checklistTitle: null, checklistItemId: null, itemTitle: null } : prev))
      return
    }
    setAttachChain((prev) => ({
      ...(prev || {}),
      checklistId: checklist._id || checklist.title,
      checklistTitle: checklist.title,
      checklistItemId: null,
      itemTitle: null
    }))
  }

  const handleSelectItem = (itemId) => {
    setSelectedItemId(itemId)
    const card = cardOptions.find((c) => c._id === selectedCardId)
    const checklist = card?.checklists?.find((cl) => (cl._id || cl.title) === selectedChecklistId)
    const item = checklist?.items?.find((it) => (it._id || it.title) === itemId)
    if (!itemId || !item) {
      setAttachChain((prev) => (prev ? { ...prev, checklistItemId: null, itemTitle: null } : prev))
      return
    }
    // Chọn item: tự điền tiêu đề nếu chưa nhập (tiện tạo nhanh)
    setTitle((prevTitle) => prevTitle || item.title)
    setAttachChain((prev) => ({
      ...(prev || {}),
      checklistItemId: item._id || item.title,
      itemTitle: item.title
    }))
    // Chọn xong nhiệm vụ -> thu gọn các ô chọn, chỉ hiện nhiệm vụ đã chọn
    setEditingAttach(false)
  }

  const handleDetachCard = () => {
    setSelectedCardId('')
    setSelectedChecklistId('')
    setSelectedItemId('')
    setAttachChain(null)
  }

  const selectedCard = cardOptions.find((c) => c._id === selectedCardId)
  const selectedChecklist = selectedCard?.checklists?.find((cl) => (cl._id || cl.title) === selectedChecklistId)

  const handleOpenAttachedCard = () => {
    if (!attachChain?.boardId) return
    const path = attachChain.cardId
      ? `/boards/${attachChain.boardId}?cardId=${attachChain.cardId}`
      : `/boards/${attachChain.boardId}`
    navigate(path)
    onClose()
  }

  const handleStartFocus = () => {
    dispatch(setFocusTask({
      cardId: attachChain?.cardId || null,
      boardId: attachChain?.boardId || null,
      title: title.trim() || attachChain?.cardTitle || attachChain?.itemTitle || 'Scheduled Task'
    }))
    navigate('/focus')
    onClose()
  }

  const buildPayload = () => {
    const startAt = dayjs(`${dateStr}T${startTime}`).valueOf()
    let endAt = dayjs(`${dateStr}T${endTime}`).valueOf()
    // Nếu giờ kết thúc nhỏ hơn hoặc bằng giờ bắt đầu, tự động tính là sang ngày tiếp theo (qua đêm)
    if (endAt <= startAt) {
      endAt = dayjs(`${dateStr}T${endTime}`).add(1, 'day').valueOf()
    }

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
      startAt,
      endAt,
      colorKey,
      cardId: attachChain?.cardId || null,
      boardId: attachChain?.boardId || null,
      cardTitle: attachChain?.cardTitle || null,
      boardTitle: attachChain?.boardTitle || null,
      checklistId: attachChain?.checklistId || null,
      checklistItemId: attachChain?.checklistItemId || null,
      checklistTitle: attachChain?.checklistTitle || null,
      itemTitle: attachChain?.itemTitle || null
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
        <Box sx={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
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
          {endTime <= startTime && (
            <Tooltip title={t('schedule.nextDayHint')}>
              <Chip
                size='small'
                label='+1d'
                color='primary'
                variant='outlined'
                sx={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  height: 20, fontSize: '0.62rem', fontWeight: 700, pointerEvents: 'none'
                }}
              />
            </Tooltip>
          )}
        </Box>
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

      {/* Gắn sâu vào card / checklist / item */}
      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 1 }}>
        {t('schedule.attachCard')}
      </Typography>

      {(editingAttach || !attachChain) && (
        <Select
          fullWidth
          size='small'
          displayEmpty
          value={selectedBoardId}
          onChange={(e) => {
            setSelectedBoardId(e.target.value)
            setSelectedCardId('')
            setSelectedChecklistId('')
            setSelectedItemId('')
            setAttachChain(null)
          }}
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

      {(editingAttach || !attachChain) && selectedBoardId && (
        <Select
          fullWidth
          size='small'
          displayEmpty
          value={selectedCardId}
          onChange={(e) => handleSelectCard(e.target.value)}
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
              <Typography sx={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>
                {card.title}
              </Typography>
            </MenuItem>
          ))}
        </Select>
      )}

      {/* Cascade checklist (chỉ hiện khi đã chọn card có checklist) */}
      {editingAttach && selectedCardId && (selectedCard?.checklists?.length > 0) && (
        <Select
          fullWidth
          size='small'
          displayEmpty
          value={selectedChecklistId}
          onChange={(e) => handleSelectChecklist(e.target.value)}
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

      {/* Cascade item checklist (chỉ hiện khi đã chọn checklist có items) */}
      {editingAttach && selectedChecklistId && (selectedChecklist?.items?.length > 0) && (
        <Select
          fullWidth
          size='small'
          displayEmpty
          value={selectedItemId}
          onChange={(e) => handleSelectItem(e.target.value)}
          sx={{ mb: 1 }}
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

      {boardDetailsLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      {/* Breadcrumb chuỗi gắn */}
      {attachChain && (
        <Box sx={{
          bgcolor: (theme) => theme.palette.mode === 'dark' ? '#0b1220' : '#f8fafc',
          borderRadius: 1.5, p: 1, mb: 1.5
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            {attachChain.boardTitle && <Chip size='small' label={`🗂 ${attachChain.boardTitle}`} sx={{ height: 22, fontSize: '0.7rem' }} />}
            {attachChain.cardTitle && <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>›</Typography>}
            {attachChain.cardTitle && <Chip size='small' label={`🎯 ${attachChain.cardTitle}`} sx={{ height: 22, fontSize: '0.7rem' }} />}
            {attachChain.checklistTitle && <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>›</Typography>}
            {attachChain.checklistTitle && <Chip size='small' label={`☑ ${attachChain.checklistTitle}`} sx={{ height: 22, fontSize: '0.7rem' }} />}
            {attachChain.itemTitle && <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>›</Typography>}
            {attachChain.itemTitle && <Chip size='small' label={`📌 ${attachChain.itemTitle}`} sx={{ height: 22, fontSize: '0.7rem', bgcolor: 'rgba(0,82,204,0.12)' }} />}
            {attachChain.boardId && (
              <Tooltip title={attachChain.cardId ? t('schedule.openCard') : t('schedule.openBoard')}>
                <IconButton
                  size='small'
                  onClick={handleOpenAttachedCard}
                  sx={{ color: '#0052cc', p: 0.5 }}
                  aria-label={attachChain.cardId ? t('schedule.openCard') : t('schedule.openBoard')}
                >
                  <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            <Box sx={{ flex: 1 }} />
            <Button
              size='small'
              variant='text'
              onClick={() => setEditingAttach(true)}
              sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600, minWidth: 0, px: 0.75 }}
            >
              {t('schedule.changeTask')}
            </Button>
            <IconButton size='small' onClick={handleDetachCard} aria-label={t('schedule.detachCard')}>
              <CloseRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Actions: Save + Focus */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          fullWidth
          variant='contained'
          onClick={handleSave}
          disabled={isSaving}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {isSaving ? <CircularProgress size={20} color='inherit' /> : (isEditMode ? t('common.save') : t('schedule.createButton'))}
        </Button>
        <Tooltip title={t('schedule.startFocusHint')}>
          <Button
            variant='outlined'
            onClick={handleStartFocus}
            startIcon={<TimerRoundedIcon sx={{ fontSize: 18 }} />}
            sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap', px: 1.5 }}
          >
            {t('schedule.startFocus')}
          </Button>
        </Tooltip>
      </Box>
    </ResponsivePopover>
  )
}
