# Wudi Poker (无敌扑克)

Wudi Poker represents a strategic 4-player card game, blending team cooperation with competitive "Invincible" mechanics.

## 🎮 Game Rules (游戏规则)

### 1. Basic Setup (基础设置)
- **Players**: 4 players.
- **Deck**: Standard 52-card deck (No Jokers).
- **Dealing**: Each player receives 13 cards. There are no "bottom cards" reserved.

### 2. Team & Roles (队伍与身份)
The game features a dynamic team system determined by two key cards: **Heart 2 (♥2)** and **Diamond 2 (♦2)**.

- **Invincible Mode (1 vs 3)**:
  - If **one player** holds *both* **♥2** and **♦2**, they become the "Invincible Player" (Wudi).
  - The other 3 players form a team to defeat the Invincible Player.
  
- **Team Mode (2 vs 2)**:
  - If two different players hold **♥2** and **♦2** respectively, they become teammates.
  - The other two players form the opposing team.
  - *Note: Teammates are revealed naturally during gameplay as cards are played.*

### 3. The Start (开局)
- **Starting Player**: The player holding the **Spade 3 (♠3)** goes first.
- **First Move Rule**: The very first hand played in the game **MUST include the Spade 3**.

### 4. Gameplay (出牌流程)
- The game follows a counter-clockwise turn order.
- Players must play a hand that beats the previous player's hand (higher rank or stronger pattern).
- **Pass**: If you cannot or choose not to beat the current hand, you pass.
- **New Round**: If all other players pass, the last player to play cards wins the round and starts a new one with any valid hand.

### 5. Winning Condition (胜利条件)
- The first player to empty their hand (play all 13 cards) wins the game.
- If playing in teams, the team of the first player to finish wins.

---

## 🕹️ How to Join & Play (加入游戏说明)

### Prerequisites
- A modern web browser.
- Network connection to the game server (or localhost for dev).

### Step-by-Step Guide

1.  **Access the Game**:
    - Open the game URL (e.g., `http://localhost:5173` for local dev).

2.  **Login / Register**:
    - **Quick Start (Dev Mode)**: Click the **"Dev: 重置/创建 4个测试账号"** link at the bottom of the login page. This will automatically create 4 test accounts (`User1` to `User4`) with password `123456`.
    - **Manual**: Enter any username and password to register/login.

3.  **Lobby (大厅)**:
    - **Create Room**: Click "Create Room" to start a new game table.
    - **Join Room**: Enter a Room ID provided by a friend to join their table.
    - *Tip: In Dev Mode, you can open 4 browser tabs/windows to simulate 4 players.*

4.  **Waiting Room**:
    - Once 4 players are in the room, everyone must click the **"Ready"** button.
    - The room owner can then click **"Start Game"**.

5.  **Playing**:
    - Select cards by clicking on them.
    - Click "Play" to submit your hand.
    - Click "Pass" to skip your turn.
    - Watch for the "Your Turn" indicator!

---

## 🛠️ Development & Testing

This project uses a **Mock Backend** by default for local development, allowing you to play without a real database.

- **Stack**: React, TypeScript, Tailwind CSS, Zustand (State), Vite.
- **Mock DB**: Stored in `localStorage` (`wudi_mock_db_v2`).
- **Multi-tab Sync**: Supported via `BroadcastChannel`, allowing you to test multiplayer scenarios in a single browser.

### Commands
- `npm run dev`: Start the development server.
- `npm run build`: Build for production.
- `npx playwright test`: Run end-to-end tests.
