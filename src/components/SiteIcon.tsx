import type { SiteOwnerId, SiteType } from '../game/types'
import westernCityIcon from '../assets/sites/city.png'
import easternCityIcon from '../assets/sites/city-eastern-3tile-roofmatch.png'
import westernFarmIcon from '../assets/sites/farm.png'
import westernMineIcon from '../assets/sites/mine.png'
import westernStrongholdIcon from '../assets/sites/stronghold.png'
import westernVillageIcon from '../assets/sites/village.png'
import easternVillageIcon from '../assets/sites/village-eastern.png'

const EASTERN_SITE_ICONS: Record<SiteType, string> = {
  stronghold: westernStrongholdIcon,
  village: easternVillageIcon,
  farm: westernFarmIcon,
  mine: westernMineIcon,
  city: easternCityIcon,
}

const WESTERN_SITE_ICONS: Record<SiteType, string> = {
  stronghold: westernStrongholdIcon,
  village: westernVillageIcon,
  farm: westernFarmIcon,
  mine: westernMineIcon,
  city: westernCityIcon,
}

type SiteIconProps = {
  kind: SiteType
  ownerId?: SiteOwnerId
  className?: string
}

export function SiteIcon({ kind, ownerId, className }: SiteIconProps) {
  const usesWesternAsset =
    ownerId === 'f2' ||
    ownerId === 'enemy' ||
    kind === 'stronghold' ||
    kind === 'farm' ||
    kind === 'mine'
  const variant = usesWesternAsset ? 'western' : 'eastern'
  const icons = usesWesternAsset ? WESTERN_SITE_ICONS : EASTERN_SITE_ICONS

  return (
    <img
      src={icons[kind]}
      alt=""
      className={className}
      aria-hidden="true"
      data-site-icon={kind}
      data-site-icon-variant={variant}
    />
  )
}
