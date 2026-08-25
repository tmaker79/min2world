import type { UnitType } from '../game/types'
import archerIcon from '../assets/archer-icon.png'
import cavalryIcon from '../assets/cavalry-icon.png'
import spearmanIcon from '../assets/spearman-icon.png'

type UnitIconProps = {
  type: UnitType
  className?: string
}

export function UnitIcon({ type, className }: UnitIconProps) {
  const commonProps = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    'data-unit-icon': type,
  }

  if (type === 'infantry') {
    return (
      <svg {...commonProps}>
        <path d="m17.5 2.8 3.8-1.1-1.1 3.8L8.4 17.3l-2.2-2.2L17.5 2.8Z" />
        <path d="m4.5 13.5 6 6M3 21l3.8-3.8" />
      </svg>
    )
  }

  if (type === 'cavalry') {
    return (
      <svg {...commonProps}>
        <image
          href={cavalryIcon}
          x="-0.6"
          y="0.6"
          width="24"
          height="24"
          preserveAspectRatio="xMidYMid slice"
        />
      </svg>
    )
  }

  if (type === 'archer') {
    return (
      <svg {...commonProps}>
        <image
          href={archerIcon}
          x="-0.8"
          width="24"
          height="24"
          preserveAspectRatio="xMidYMid slice"
        />
      </svg>
    )
  }

  if (type === 'settler') {
    return (
      <svg {...commonProps}>
        <path d="M6 21V3" />
        <path d="M7 4h10l-2.5 3L17 10H7" />
        <path d="M3.5 21h6" />
      </svg>
    )
  }

  if (type === 'builder') {
    return (
      <svg {...commonProps}>
        <path d="m5 19 9.5-9.5" />
        <path d="m12.5 5.5 2-2 5 5-2 2" />
        <path d="m3.5 17.5 3 3" />
        <path d="m14.5 3.5 5 5" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <image
        href={spearmanIcon}
        y="0.3"
        width="24"
        height="24"
        preserveAspectRatio="xMidYMid slice"
      />
    </svg>
  )
}
