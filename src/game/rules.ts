// 게임 규칙 모듈의 공개 진입점. 실제 구현은 아래 모듈에 나뉘어 있고, 이 파일은
// 기존 import 경로(`from './rules'`)를 유지하기 위한 barrel이다.
export {
  getHexDistance,
  getHexNeighbors,
  isPositionOnBoard,
  positionKey,
  positionsEqual,
} from './hex'
export * from './gameCatalog'
export * from './queries'
export * from './economy'
export * from './movement'
export * from './combat'
export * from './victory'
