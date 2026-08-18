import type { SiteType } from '../game/types'
import cityIcon from '../assets/sites/city.png'
import mineIcon from '../assets/sites/mine.png'
import strongholdIcon from '../assets/sites/stronghold.png'
import villageIcon from '../assets/sites/village.png'

const SITE_ICONS: Record<SiteType, string> = {
  stronghold: strongholdIcon,
  city: cityIcon,
  village: villageIcon,
  mine: mineIcon,
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
