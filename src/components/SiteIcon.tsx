import type { SiteOwnerId, SiteType } from '../game/types'
import farmIcon from '../assets/sites/farm.png'
import mineIcon from '../assets/sites/mine.png'
import easternStrongholdIcon from '../assets/sites/stronghold-eastern.png'
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
  ownerId?: SiteOwnerId
  className?: string
}

function isBlueFaction(ownerId: SiteOwnerId | undefined): boolean {
  return ownerId === 'f1' || ownerId === 'player'
}

export function SiteIcon({ kind, ownerId, className }: SiteIconProps) {
  const usesEasternStronghold = kind === 'stronghold' && isBlueFaction(ownerId)
  const icon = usesEasternStronghold ? easternStrongholdIcon : SITE_ICONS[kind]

  return (
    <img
      src={icon}
      alt=""
      className={className}
      aria-hidden="true"
      data-site-icon={kind}
      data-site-icon-variant={usesEasternStronghold ? 'eastern' : undefined}
    />
  )
}
