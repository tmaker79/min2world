import type { Position, Terrain } from '../game/types'
import { FOREST_TERRAIN_VARIANT_COUNT } from '../game/types'
import desertTileCactus from '../assets/terrain/desert-tile-cactus.png'
import desertTileDunes from '../assets/terrain/desert-tile-dunes.png'
import desertTileScrub from '../assets/terrain/desert-tile-scrub.png'
import desertHillTile from '../assets/terrain/desert-hill-tile.png'
import forestTile from '../assets/terrain/forest-tile.png'
import forestTileFull from '../assets/terrain/forest-tile-full.png'
import hillTile from '../assets/terrain/hill-tile.png'
import hillTileFew from '../assets/terrain/hill-tile-few.png'
import mountainTileFull from '../assets/terrain/mountain-tile-full.png'
import mountainTilePeak from '../assets/terrain/mountain-tile-peak.png'
import oasisTile from '../assets/terrain/oasis-tile.png'
import plainTile from '../assets/terrain/plain-tile.png'
import plainTileBush from '../assets/terrain/plain-tile-bush.png'
import plainTileGrass1 from '../assets/terrain/plain-tile-grass-1.png'
import plainTileGrass2 from '../assets/terrain/plain-tile-grass-2.png'
import plainTileGrass3 from '../assets/terrain/plain-tile-grass-3.png'
import plainTileGrass4 from '../assets/terrain/plain-tile-grass-4.png'
import plainTileGround from '../assets/terrain/plain-tile-ground.png'
import plainTileTrees from '../assets/terrain/plain-tile-trees.png'
import tundraForestTile from '../assets/terrain/tundra-forest-tile.png'
import tundraMountainTileSummit from '../assets/terrain/tundra-mountain-tile-summit.png'
import tundraMountainTile from '../assets/terrain/tundra-mountain-tile.png'
import tundraTileWindswept from '../assets/terrain/tundra-tile-windswept.png'
import waterTile from '../assets/terrain/water-tile.png'

const TERRAIN_VARIANTS: Partial<Record<Terrain, readonly string[]>> = {
  plain: [
    plainTileGround,
    plainTileGrass1,
    plainTileGrass2,
    plainTileGrass3,
    plainTileGrass4,
    plainTile,
    plainTileBush,
    plainTileTrees,
  ],
  forest: [forestTileFull, forestTile],
  hill: [hillTileFew, hillTile],
  mountain: [mountainTileFull, mountainTilePeak],
  water: [waterTile],
  desert: [desertTileCactus, desertTileDunes, desertTileScrub],
  desertHill: [desertHillTile],
  oasis: [oasisTile],
  tundra: [tundraTileWindswept],
  tundraForest: [tundraForestTile],
  tundraMountain: [tundraMountainTile, tundraMountainTileSummit],
}

if (TERRAIN_VARIANTS.forest?.length !== FOREST_TERRAIN_VARIANT_COUNT) {
  throw new Error(
    'Forest terrain variant assets must match FOREST_TERRAIN_VARIANT_COUNT',
  )
}

// Kept with the component because both helpers share its private asset table.
// eslint-disable-next-line react-refresh/only-export-components
export function hasTerrainImage(terrain: Terrain): boolean {
  return Boolean(TERRAIN_VARIANTS[terrain]?.length)
}

// eslint-disable-next-line react-refresh/only-export-components
export function getTerrainVariantIndex(
  position: Position,
  count: number,
  seed = '',
) {
  let hash = 0x811c9dc5

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  hash ^= Math.imul(position.q, 0x9e3779b1)
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b)
  hash ^= Math.imul(position.r, 0xc2b2ae35)
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
  hash ^= hash >>> 16

  return (hash >>> 0) % count
}

type TerrainIconProps = {
  terrain: Terrain
  position?: Position
  seed?: string
  variantIndex?: number
  className?: string
}

export function TerrainIcon({
  terrain,
  position,
  seed,
  variantIndex,
  className,
}: TerrainIconProps) {
  const variants = TERRAIN_VARIANTS[terrain]
  if (variants?.length) {
    const index =
      variantIndex !== undefined
        ? ((variantIndex % variants.length) + variants.length) % variants.length
        : position
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
