# 에셋

지형·거점·유닛 이미지는 각 컴포넌트에서 직접 `import`하며, 문자열 경로로 동적 로딩하지 않습니다. 따라서 아래 표에 없는 파일이 어느 컴포넌트에서도 `import`되지 않으면 사용되지 않는 에셋입니다.

| 폴더 | 사용처 |
| --- | --- |
| `terrain/cmartins/` | `components/TerrainIcon.tsx`의 `TERRAIN_VARIANTS` |
| `terrain/` 루트 | 별도 제작한 다리·물 지형 타일 |
| `sites/` | `components/SiteIcon.tsx`, `components/GameMap.tsx` |
| 루트 | `App.css` |

## 라이선스

`terrain/cmartins/`의 모든 파일은 cmartins.art의
[Hex Tiles: Fantasy](https://cmartins.itch.io/hex-tiles-fantasy)를 기반으로
편집·변형했으며 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)으로
제공됩니다. 자세한 적용 범위와 변경 사항은
[제3자 에셋 고지](../../THIRD_PARTY_NOTICES.md)를 참고하세요.

`terrain/bridge-tile.png`와 `terrain/water-tile.png`는 이 라이선스의 적용
대상이 아닙니다.

## 아직 연결하지 않은 에셋

다음 파일은 현재 코드에서 사용하지 않지만 예정된 기능이나 향후 선택지를 위해 남겨 둡니다.

| 파일 | 용도 |
| --- | --- |
| `sites/farm-field-1.png` ~ `farm-field-4.png` | Milestone 16의 농지 확장 타일 |
| `terrain/cmartins/tundra-tile-frost-scrub.png`, `terrain/cmartins/tundra-tile-ice-crystals.png` | 툰드라 지형 변형 후보. 현재 `TERRAIN_VARIANTS.tundra`에는 `tundra-tile-windswept.png`만 등록되어 있습니다 |
| `sites/farm-eastern.png`, `sites/mine-eastern.png`, `sites/stronghold-eastern.png` | 동양풍 변형 후보. `SiteIcon`은 farm·mine·stronghold를 소유 세력과 무관하게 서양풍으로 고정하고 있어 현재 선택되지 않습니다 |
| `archer-icon.png`, `cavalry-icon.png`, `spearman-icon.png` | 벡터 전환 이전 유닛 아이콘 참고용 래스터 자산. 코드에서 import하지 않아 프로덕션 번들에는 포함되지 않습니다 |

기능을 구현할 때 해당 파일을 컴포넌트에 연결하고 이 목록에서 제거합니다.
