import type { Position, Terrain } from '../game/types'
import forestTile from '../assets/terrain/forest-tile.png'
import hillTile from '../assets/terrain/hill-tile.png'
import hillTileFew from '../assets/terrain/hill-tile-few.png'
import mountainTileFull from '../assets/terrain/mountain-tile-full.png'
import mountainTilePeak from '../assets/terrain/mountain-tile-peak.png'
import waterTile from '../assets/terrain/water-tile.png'

const TERRAIN_VARIANTS: Partial<Record<Terrain, readonly string[]>> = {
  forest: [forestTile],
  hill: [hillTileFew, hillTile],
  mountain: [mountainTileFull, mountainTilePeak],
  water: [waterTile],
}

export function hasTerrainImage(terrain: Terrain): boolean {
  return Boolean(TERRAIN_VARIANTS[terrain]?.length)
}

export function getTerrainVariantIndex(position: Position, count: number) {
  const hash = ((position.q * 73856093) ^ (position.r * 19349663)) >>> 0
  return hash % count
}

type TerrainIconProps = {
  terrain: Terrain
  position?: Position
  className?: string
}

export function TerrainIcon({ terrain, position, className }: TerrainIconProps) {
  const variants = TERRAIN_VARIANTS[terrain]
  if (variants?.length) {
    const index = position
      ? getTerrainVariantIndex(position, variants.length)
      : 0
    return (
      <img
        src={variants[index]}
        alt=""
        className={className}
        aria-hidden="true"
        data-terrain-icon={terrain}
        data-terrain-variant={index}
      />
    )
  }

  return null
}
