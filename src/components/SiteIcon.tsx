import type { SiteType } from '../game/types'
import farmIcon from '../assets/farm-icon.svg'
import mineIcon from '../assets/mine-icon.svg'
import strongholdIcon from '../assets/stronghold-icon.svg'
import villageIcon from '../assets/village-icon.svg'

const SITE_ICONS: Record<SiteType, string> = {
  stronghold: strongholdIcon,
  city: villageIcon,
  village: farmIcon,
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
