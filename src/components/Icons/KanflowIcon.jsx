import SvgIcon from '@mui/material/SvgIcon'

export default function KanflowIcon(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Outer squircle frame */}
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill="currentColor" fillOpacity="0.16" />
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {/* 3 Flowing Kanban Columns */}
      <rect x="5.5" y="6" width="3.5" height="12" rx="1.5" fill="currentColor" />
      <rect x="10.25" y="6" width="3.5" height="7.5" rx="1.5" fill="currentColor" />
      <rect x="15" y="6" width="3.5" height="10" rx="1.5" fill="currentColor" />
    </SvgIcon>
  )
}
