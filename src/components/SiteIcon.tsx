import type { SiteType } from '../game/types'
import settlementIcon from '../assets/sites/city.png'
import farmIcon from '../assets/sites/village.png'
import mineIcon from '../assets/sites/mine.png'
import strongholdIcon from '../assets/sites/stronghold.png'

const SITE_ICONS: Record<SiteType, string> = {
  stronghold: strongholdIcon,
  village: settlementIcon,
  farm: farmIcon,
  mine: mineIcon,
  // Temporary placeholder for the reserved city type.
  city: settlementIcon,
}

type SiteIconProps = {
  kind: SiteType
  className?: string
}

export function SiteIcon({ kind, className }: SiteIconProps) {
  return (
    <img
      src={SITE_ICONS[kind]}
      alt=""
      className={className}
      aria-hidden="true"
      data-site-icon={kind}
    />
  )
}
