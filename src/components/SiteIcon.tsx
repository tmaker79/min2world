import type { SiteOwnerId, SiteType } from '../game/types'
import westernCityIcon from '../assets/sites/city.png'
import easternCityIcon from '../assets/sites/city-eastern.png'
import westernFarmIcon from '../assets/sites/farm.png'
import westernFarmLevel2Icon from '../assets/sites/farm-level-2.png'
import westernFarmLevel3Icon from '../assets/sites/farm-level-3.png'
import westernMineIcon from '../assets/sites/mine.png'
import westernMineLevel2Icon from '../assets/sites/mine-level-2.png'
import westernMineLevel3Icon from '../assets/sites/mine-level-3.png'
import outpostIcon from '../assets/sites/outpost.png'
import keepIcon from '../assets/sites/keep.png'
import smithyIcon from '../assets/sites/smithy.png'
import smithyLevel2Icon from '../assets/sites/smithy-level-2.png'
import smithyLevel3Icon from '../assets/sites/smithy-level-3.png'
import westernStrongholdIcon from '../assets/sites/stronghold.png'
import westernTownIcon from '../assets/sites/town.png'
import easternTownIcon from '../assets/sites/town-eastern-3tile-roofmatch.png'
import westernVillageIcon from '../assets/sites/village.png'
import easternVillageIcon from '../assets/sites/village-eastern.png'

const EASTERN_SITE_ICONS: Record<SiteType, string> = {
  outpost: outpostIcon,
  keep: keepIcon,
  stronghold: westernStrongholdIcon,
  village: easternVillageIcon,
  town: easternTownIcon,
  farm: westernFarmIcon,
  mine: westernMineIcon,
  city: easternCityIcon,
  blacksmith: smithyIcon,
}

const WESTERN_SITE_ICONS: Record<SiteType, string> = {
  outpost: outpostIcon,
  keep: keepIcon,
  stronghold: westernStrongholdIcon,
  village: westernVillageIcon,
  town: westernTownIcon,
  farm: westernFarmIcon,
  mine: westernMineIcon,
  city: westernCityIcon,
  blacksmith: smithyIcon,
}

type SiteIconProps = {
  kind: SiteType
  ownerId?: SiteOwnerId
  level?: 1 | 2 | 3
  className?: string
}

export function SiteIcon({ kind, ownerId, level = 1, className }: SiteIconProps) {
  const usesWesternAsset =
    ownerId === 'neutral' ||
    ownerId === 'f2' ||
    ownerId === 'enemy' ||
    kind === 'stronghold' ||
    kind === 'farm' ||
    kind === 'mine'
  const variant = usesWesternAsset ? 'western' : 'eastern'
  const icons = usesWesternAsset ? WESTERN_SITE_ICONS : EASTERN_SITE_ICONS
  const leveledIcon =
    kind === 'farm'
      ? [westernFarmIcon, westernFarmLevel2Icon, westernFarmLevel3Icon][level - 1]
      : kind === 'mine'
        ? [westernMineIcon, westernMineLevel2Icon, westernMineLevel3Icon][level - 1]
        : kind === 'blacksmith'
          ? [smithyIcon, smithyLevel2Icon, smithyLevel3Icon][level - 1]
          : icons[kind]

  return (
    <img
      src={leveledIcon}
      alt=""
      className={className}
      aria-hidden="true"
      data-site-icon={kind}
      data-site-level={level}
      data-site-icon-variant={variant}
    />
  )
}
