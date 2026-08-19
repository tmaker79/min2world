import type { SiteOwnerId, SiteType } from '../game/types'
import easternFarmIcon from '../assets/sites/farm-eastern.png'
import easternMineIcon from '../assets/sites/mine-eastern.png'
import easternStrongholdIcon from '../assets/sites/stronghold-eastern.png'
import easternVillageIcon from '../assets/sites/village-eastern.png'

const SITE_ICONS: Record<SiteType, string> = {
  stronghold: easternStrongholdIcon,
  village: easternVillageIcon,
  farm: easternFarmIcon,
  mine: easternMineIcon,
  // Temporary placeholder for the reserved city type.
  city: easternVillageIcon,
}

type SiteIconProps = {
  kind: SiteType
  ownerId?: SiteOwnerId
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
      data-site-icon-variant="eastern"
    />
  )
}
