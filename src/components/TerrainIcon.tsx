import type { Position, Terrain } from '../game/types'
import forestTile from '../assets/terrain/forest-tile.png'
import hillTile from '../assets/terrain/hill-tile.png'
import hillTileFew from '../assets/terrain/hill-tile-few.png'
import mountainTileFull from '../assets/terrain/mountain-tile-full.png'
import mountainTilePeak from '../assets/terrain/mountain-tile-peak.png'
import plainTile from '../assets/terrain/plain-tile.png'
import plainTileGrass1 from '../assets/terrain/plain-tile-grass-1.png'
import plainTileGrass2 from '../assets/terrain/plain-tile-grass-2.png'
import plainTileGrass3 from '../assets/terrain/plain-tile-grass-3.png'
import plainTileGrass4 from '../assets/terrain/plain-tile-grass-4.png'
import plainTileGround from '../assets/terrain/plain-tile-ground.png'
import waterTile from '../assets/terrain/water-tile.png'

const TERRAIN_VARIANTS: Partial<Record<Terrain, readonly string[]>> = {
  plain: [
    plainTileGround,
    plainTileGrass1,
    plainTileGrass2,
    plainTileGrass3,
    plainTileGrass4,
    plainTile,
  ],
  forest: [forestTile],
  hill: [hillTileFew, hillTile],
  mountain: [mountainTileFull, mountainTilePeak],
  water: [waterTile],
}

export function hasTerrainImage(terrain: Terrain): boolean {
  return Boolean(TERRAIN_VARIANTS[terrain]?.length)
}

export function getTerrainVariantIndex(
  position: Position,
  count: number,
  seed = '',
) {
  let hash = ((position.q * 73856093) ^ (position.r * 19349663)) >>> 0

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0) % count
}

type TerrainIconProps = {
  terrain: Terrain
  position?: Position
  seed?: string
  className?: string
}

export function TerrainIcon({
  terrain,
  position,
  seed,
  className,
}: TerrainIconProps) {
  const variants = TERRAIN_VARIANTS[terrain]
  if (variants?.length) {
    const index = position
      ? getTerrainVariantIndex(position, variants.length, seed)
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
