<p align="center">
  <img src="public/icons/main-game-icon.png" alt="min2world 메인 아이콘" width="240">
</p>

<h1 align="center">min2world</h1>

min2world는 데스크톱 애플리케이션 개발자가 AI와 협업해 만들고 있는 웹 턴제 전략 시뮬레이션 게임입니다.

현재는 **2인용 빠른대전**이 메인 모드입니다. 육각 지도에서 부대를 이동하고 전투하며 상대 수도를 점령하는 핵심 경험을 중심으로 게임성·사용성·안정성을 다듬고 있습니다. 빠른대전의 완성도를 충분히 높인 다음 새로운 기능과 콘텐츠를 단계적으로 확장할 계획입니다.

**[빠른대전 플레이](https://min2world.dev)** · [전체모드(beta)](https://beta.min2world.dev)

## 프로젝트 목적

- AI를 활용한 소프트웨어 개발 방법과 협업 과정을 탐구합니다.
- 멀티플랫폼 애플리케이션 개발을 위한 웹 기술을 익힙니다.
- React와 TypeScript를 실제 게임 개발에 적용하며 학습합니다.

## 빠른대전 조작 방법

1. 빠른대전에 접속하면 무작위 2인용 지도로 게임이 즉시 시작됩니다.
2. 내 부대를 좌클릭해 선택합니다. 선택 중인 대상이 없을 때 타일에 마우스를 올리면 사이드바에서 유닛·거점·지형 정보를 확인할 수 있습니다.
3. 금색 칸을 **우클릭**해 이동하고 붉은 적 유닛이나 수도를 좌클릭해 공격합니다. 적 통제 구역에 진입하면 추가 이동이 멈춥니다.
4. 내 도시에서 군사 유닛을 생산하고, 중립 농장·광산·대장간을 점령해 턴 수입을 늘립니다.
5. 상태바에서 수입·유지비를 확인합니다. 선택한 부대는 `해산`할 수 있지만 자원은 환불되지 않습니다.
6. 행동을 마치면 `턴 종료`를 선택하거나 `Enter`를 누릅니다. 이동·공격·생산 선택은 `Esc`로 취소합니다.
7. 상대 수도를 점령하면 승리하고 내 수도를 잃으면 패배합니다.

지도는 드래그로 이동하고 마우스 휠이나 핀치로 확대·축소할 수 있습니다. 상단 메뉴에서 재시작·저장·도움말·언어 전환 기능을 제공합니다.

게임 모드와 세부 규칙은 [게임 가이드](docs/game-guide.md)를 참고하세요.

## 개발 환경

- Node.js 22.12 이상
- npm

## 실행

```bash
npm install
npm run dev
```

개발 서버가 출력한 로컬 주소를 브라우저에서 엽니다.

로컬·미리보기 환경에서는 주소에 다음 쿼리를 붙여 모드를 선택할 수 있습니다.

- `?mode=quick`: 2인용 빠른대전을 즉시 시작
- `?mode=standard`: 시작 설정 화면이 있는 전체모드를 실행

## 검증

```bash
npm test
npm run lint
npm run build
npm run verify
```

테스트를 수정하면서 계속 실행하려면 `npm run test:watch`를 사용합니다.

## 배포

Cloudflare 로그인과 권한 설정을 마친 환경에서 다음 명령을 사용합니다.

```bash
npm run deploy:preview
npm run deploy
```

두 명령 모두 프로덕션 빌드를 먼저 만들며, 각각 새 버전 업로드와 실제 배포를 수행합니다.

하나의 Worker가 `min2world.dev`의 빠른대전과 `beta.min2world.dev`의 전체모드를 함께 제공합니다. Cloudflare Builds는 GitHub 저장소와 연결해 production branch를 `main`, build command를 `npm run verify`, deploy command를 `npx wrangler deploy`, non-production deploy command를 `npx wrangler versions upload`로 설정합니다.

## 에셋과 라이선스

`src/assets/terrain/cmartins/`의 지형 타일은 cmartins.art의 [Hex Tiles: Fantasy](https://cmartins.itch.io/hex-tiles-fantasy)를 기반으로 편집·변형했으며 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)으로 제공합니다. 다리·물 지형과 거점 래스터 이미지는 프로젝트용으로 별도 제작한 자산입니다.

자세한 적용 범위와 변경 사항은 [제3자 에셋 고지](THIRD_PARTY_NOTICES.md), 아직 코드에 연결하지 않은 에셋은 [에셋 안내](src/assets/README.md)를 참고하세요.

## 문서

- [게임 가이드](docs/game-guide.md): 게임 모드, 맵, 전체모드 기능, 규칙과 저장 데이터
- [개발 계획](docs/development-plan.md): 프로젝트 목표, 개발 방향, 설계와 기술 선택
- [개발 마일스톤](docs/milestones/README.md): 단계별 진행 상황과 상세 명세
