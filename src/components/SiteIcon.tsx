import type { SiteOwnerId, SiteType } from '../game/types'
import westernCityIcon from '../assets/sites/city.png'
import easternCityIcon from '../assets/sites/city-eastern-3tile-roofmatch.png'
import westernFarmIcon from '../assets/sites/farm.png'
import easternFarmIcon from '../assets/sites/farm-eastern.png'
import westernMineIcon from '../assets/sites/mine.png'
import easternMineIcon from '../assets/sites/mine-eastern.png'
import westernStrongholdIcon from '../assets/sites/stronghold.png'
import easternStrongholdIcon from '../assets/sites/stronghold-eastern.png'
import westernVillageIcon from '../assets/sites/village.png'
import easternVillageIcon from '../assets/sites/village-eastern.png'

const EASTERN_SITE_ICONS: Record<SiteType, string> = {
  stronghold: easternStrongholdIcon,
  village: easternVillageIcon,
  farm: easternFarmIcon,
  mine: easternMineIcon,
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
  const isWestern = ownerId === 'f2' || ownerId === 'enemy'
  const variant = isWestern ? 'western' : 'eastern'
  const icons = isWestern ? WESTERN_SITE_ICONS : EASTERN_SITE_ICONS

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
