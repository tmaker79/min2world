import type { UnitType } from '../game/types'

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
        <path d="M5.8 11.2C4.2 9.4 3.8 6.8 5 5.3" />
        <ellipse cx="11.3" cy="12.2" rx="5.5" ry="3.15" />
        <path d="M15.8 10.2C16.6 8.6 17.6 7.4 18.8 6.6" />
        <ellipse
          cx="20.1"
          cy="7.15"
          rx="3.05"
          ry="1.8"
          transform="rotate(-24 20.1 7.15)"
        />
        <path d="M18.7 5.55 18.15 3.55" />
        <path d="M8.35 15.2 7.55 20.8M14.35 15.25 15.2 20.8" />
        <circle cx="21.15" cy="6.55" r="0.5" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  if (type === 'archer') {
    return (
      <svg {...commonProps}>
        <path d="M7.1 3.2c4.3 4.8 4.3 12.8 0 17.6M7.1 3.2c8 2.8 8 14.8 0 17.6" />
        <path d="M3.2 12h17.6M17.7 8.9l3.1 3.1-3.1 3.1" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <path
        d="m14.9 9.1 7.4-7.4-2.2 8-5.2-.6Z"
        fill="currentColor"
      />
      <path d="M18.2 5.8 4.1 19.9M2.8 21.2l3-3" />
    </svg>
  )
}
