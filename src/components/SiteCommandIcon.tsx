type SiteCommandIconProps = {
  className?: string
}

export function SiteCommandIcon({ className }: SiteCommandIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      data-site-command-icon="production"
    >
      <circle cx="8.5" cy="6.3" r="3.3" />
      <path d="M1.8 20.8c0-4.6 2.9-7.7 6.7-7.7s6.7 3.1 6.7 7.7H1.8Z" />
      <path d="M17 3h3v3h3v3h-3v3h-3V9h-3V6h3V3Z" />
    </svg>
  )
}
