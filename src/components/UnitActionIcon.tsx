type UnitAction = 'move' | 'attack'

type UnitActionIconProps = {
  action: UnitAction
  className?: string
}

export function UnitActionIcon({ action, className }: UnitActionIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-unit-action-icon={action}
    >
      {action === 'move' ? (
        <>
          <circle cx="12" cy="12" r="9.2" strokeWidth="2.2" />
          <path
            d="M4.7 10.5h8.2V6.8l6.4 5.2-6.4 5.2v-3.7H4.7v-3Z"
            fill="currentColor"
            stroke="none"
          />
        </>
      ) : (
        <>
          <path
            d="M2.5 2.5h7v3H5.5v4h-3v-7Zm12 0h7v7h-3v-4h-4v-3Zm-12 12h3v4h4v3h-7v-7Zm16 0h3v7h-7v-3h4v-4Z"
            fill="currentColor"
            stroke="none"
          />
          <path
            d="M10.3 7.2h3.4v3.1h3.1v3.4h-3.1v3.1h-3.4v-3.1H7.2v-3.4h3.1V7.2Z"
            fill="currentColor"
            stroke="none"
          />
        </>
      )}
    </svg>
  )
}
