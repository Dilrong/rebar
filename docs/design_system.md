# Rebar Design System: Industrial Brutalism

이 문서는 현재 Rebar 앱에 적용된 **'Industrial Brutalism (산업적 브루탈리즘)'** 디자인 시스템의 핵심 원칙과 스타일 가이드를 정의합니다. Rebar(철근)라는 이름에 걸맞게, 데이터를 제련하고 보관하는 **'단단한 인프라(Infrastructure)'**의 느낌을 줍니다.

---

## 🏗️ 1. Core Principles (핵심 원칙)

1. **내구성(Durability)**: 얇고 연약한 선 대신, 두껍고 견고한 선과 면을 사용해 깨지지 않을 것 같은 단단함을 시각화합니다.
2. **시스템 터미널(System Terminal)**: 이모지나 아기자기한 아이콘을 배제하고, 대문자와 모노스페이스 폰트를 사용해 개발자의 터미널이나 서버 관리 콘솔을 연상시키도록 설계합니다.
3. **가식 없는 UI (Raw UI)**: 그림자의 번짐(Blur) 효과나 둥근 모서리(Border-radius) 같은 꾸밈 요소를 제거하고, 날카로운 직각 형태만 사용합니다.

---

## 🎨 2. Color Palette (컬러 팔레트)

무채색(대비가 강한 블랙&화이트) 기반에 아날로그 장비의 경고등 같은 쨍한 포인트 컬러 하나만을 사용합니다.

### Base Colors (기본 색상)
- **Background (배경)**: 
  - Light: 아주 밝은 콘크리트 회색 (`#F2F2F2`) 
  - Dark: 순수한 스크린 블랙 (`#000000`)
- **Foreground (글씨 및 주조색)**: 
  - Light: 완전한 실루엣 블랙 (`#111111`)
  - Dark: 밝은 콘크리트 회색 (`#F2F2F2`)
- **Border / Outline (가장자리/구분선)**: 
  - 요소와 요소를 나누는 굵은 선으로, 주로 Foreground와 동일하게 사용하여 대비를 극대화합니다.

### Accent Color (강조 색상)
- **Construction Orange (`#FF5A00`)**: 
  - 공사 현장, 혹은 산업용 시스템의 `Execute`, `Warning`, `Active` 상태를 나타내는 데 씁니다. 버튼 오버나 활성화된 데이터 태그(`.accent`)에 쓰입니다.

---

## 📐 3. Typography (타이포그래피)

부드러운 Serif(명조)나 유려한 곡선 폰트를 버리고, 오직 **가독성(Inter)과 시스템화(Roboto Mono)**에 집중합니다.

- **헤드라인 (Headers)**: `Inter` (Black / 900 weight)
  - 가장 육중한(Heavy) 두께를 사용해 제목이 하나의 콘크리트 벽처럼 느껴지게 합니다 (예: `DATA INFRASTRUCTURE`). 
  - 모두 **대문자(UPPERCASE)**를 기본으로 합니다.
- **메타데이터 및 UI 텍스트 (Terminal/System Text)**: `Roboto Mono`
  - 고유 ID, 종류(Kind), 상태(State), 시스템 알림 메시지 등은 코딩 폰트를 사용하여 터미널 데이터처럼 보이게 합니다. (예: `>> DATA.PAYLOAD`, `[INBOX]`).
- **본문 데이터 (Body Text)**: `Inter` (Medium / Semi-bold)
  - 사용자가 입력한 실제 콘텐츠 라인은 단단하고 읽기 쉬운 기본 폰트를 사용하되, 두께감을 유지합니다.

---

## 🧊 4. Geometry & Composition (형태와 구성)

- **Sharp Corners (직각 모서리)**: 
  - `border-radius: 0` (또는 Tailwind의 `rounded-none`). 버튼, 카드, 폼 요소 등 모든 객체는 날카로운 각을 가집니다.
- **Heavy Borders (두꺼운 선)**: 
  - 요소 간의 경계를 짓기 위해 `border-4`(또는 최소 `border-2`)의 굵고 시커먼(또는 완전한 흰색) 선을 사용합니다. 부드러운 회색 선(`<hr/>`) 대신 펜 가이드라인처럼 명확한 구획을 줍니다.
- **Block Shadows (입체 블록 그림자)**:
  - 붕 떠 있는 듯한 블러 그림자(Drop-shadow) 대신, 우측 하단으로 쏠린 100% 불투명도의 단색 그림자를 씁니다 (예: `shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]`). 버튼을 누르면 이 그림자가 사라지며 요소가 눌린(눌려 들어간) 듯한 물리적인 피드백(`active:translate-x-2`, `active:translate-y-2`)을 줍니다.
