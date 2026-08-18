import type { SiteType } from '../game/types'
import farmIcon from '../assets/sites/farm.png'
import mineIcon from '../assets/sites/mine.png'
import strongholdIcon from '../assets/sites/stronghold.png'
import villageIcon from '../assets/sites/village.png'

const SITE_ICONS: Record<SiteType, string> = {
  stronghold: strongholdIcon,
  village: villageIcon,
  farm: farmIcon,
  mine: mineIcon,
  // Temporary placeholder for the reserved city type.
  city: villageIcon,
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
