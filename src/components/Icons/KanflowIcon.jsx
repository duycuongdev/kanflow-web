import SvgIcon from '@mui/material/SvgIcon'

export default function KanflowIcon(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="kanflow-icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#kanflow-icon-grad)" />
      <rect x="3.8" y="4.5" width="4.4" height="15" rx="1.8" fill="#ffffff" />
      <rect x="9.8" y="4.5" width="4.4" height="9.5" rx="1.8" fill="#ffffff" fillOpacity="0.9" />
      <rect x="15.8" y="4.5" width="4.4" height="12.5" rx="1.8" fill="#ffffff" fillOpacity="0.8" />
    </SvgIcon>
  )
}
