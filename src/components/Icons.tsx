import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 18, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function CalendarIcon(props: IconProps) {
  return <Svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></Svg>
}

export function MonthCalendarIcon(props: IconProps) {
  return <Svg {...props}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M7 2v4M17 2v4M3 9h18" /><path d="M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2M15 17h2" /></Svg>
}

export function ChartIcon(props: IconProps) {
  return <Svg {...props}><path d="M4 20V11M10 20V5M16 20v-8M22 20V9" /></Svg>
}

export function SettingsIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 15.3a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6Z" /><path d="m19.4 15.1 1.2 1.2-2.3 4-1.7-.5a8.9 8.9 0 0 1-2.4 1.4L13.8 23h-4l-.4-1.8A8.9 8.9 0 0 1 7 19.8l-1.7.5-2.3-4 1.2-1.2a9.3 9.3 0 0 1 0-2.8L3 11.1l2.3-4 1.7.5a8.9 8.9 0 0 1 2.4-1.4L9.8 4h4l.4 2.2A8.9 8.9 0 0 1 16.6 7.6l1.7-.5 2.3 4-1.2 1.2a9.3 9.3 0 0 1 0 2.8Z" transform="translate(0 -2) scale(1 .92)" /></Svg>
}

export function PlusIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 5v14M5 12h14" /></Svg>
}

export function CopyIcon(props: IconProps) {
  return <Svg {...props}><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></Svg>
}

export function ClockIcon(props: IconProps) {
  return <Svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></Svg>
}

export function CheckIcon(props: IconProps) {
  return <Svg {...props}><path d="m5 12 4.5 4.5L19 7" /></Svg>
}

export function EditIcon(props: IconProps) {
  return <Svg {...props}><path d="m16 4 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z" /></Svg>
}

export function TrashIcon(props: IconProps) {
  return <Svg {...props}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" /></Svg>
}

export function CloseIcon(props: IconProps) {
  return <Svg {...props}><path d="M5 5l14 14M19 5 5 19" /></Svg>
}

export function RestoreIcon(props: IconProps) {
  return <Svg {...props}><path d="M3 4v7h7M3 11a9 9 0 1 1 2.5 6.2" /></Svg>
}

export function ArrowIcon(props: IconProps) {
  return <Svg {...props}><path d="m9 6 6 6-6 6" /></Svg>
}
