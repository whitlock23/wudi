import { test, expect, BrowserContext, Page } from '@playwright/test';

const createPlayer = async (context: BrowserContext, username: string) => {
  const page = await context.newPage();
  await page.goto('/');
  
  // Register
  await page.fill('input[placeholder="请输入用户名"]', username);
  await page.fill('input[placeholder="请输入密码"]', '123456');
  // Toggle to register if needed, but default is Login. 
  // Wait, Auth.tsx defaults to Login.
  // Click "No account? Register immediately"
  await page.click('text=没有账号？立即注册');
  await page.fill('input[placeholder="请输入用户名"]', username);
  await page.fill('input[placeholder="请输入密码"]', '123456');
  await page.click('button[type="submit"]');
  
  // Expect to be in lobby
  await expect(page).toHaveURL(/\/lobby/);
  return page;
};

test('Room synchronization and Game Start', async ({ browser }) => {
  test.setTimeout(60000); // Increase timeout to 60s
  // Create 4 contexts for 4 players
  const p1Context = await browser.newContext();
  const p2Context = await browser.newContext();
  const p3Context = await browser.newContext();
  const p4Context = await browser.newContext();

  const timestamp = Date.now();
  const p1Name = `UserA_${timestamp}`;
  const p2Name = `UserB_${timestamp}`;
  const p3Name = `UserC_${timestamp}`;
  const p4Name = `UserD_${timestamp}`;

  console.log('Creating players...');
  const p1Page = await createPlayer(p1Context, p1Name);
  p1Page.on('console', msg => console.log(`[P1 Console]: ${msg.text()}`)); // Add console logging for P1
  
  const p2Page = await createPlayer(p2Context, p2Name);
  p2Page.on('console', msg => console.log(`[P2 Console]: ${msg.text()}`)); // Add console logging for P2
  const p3Page = await createPlayer(p3Context, p3Name);
  const p4Page = await createPlayer(p4Context, p4Name);

  // 1. P1 Creates Room
  console.log('P1 creating room...');
  await p1Page.click('text=创建房间');
  // Fill modal
  await p1Page.fill('input[placeholder="例如：欢乐斗地主"]', 'Test Room');
  // Click the submit button in modal
  await p1Page.click('form button[type="submit"]');
  
  await expect(p1Page).toHaveURL(/\/game\//);
  
  // Get Room Code
  const roomCodeElement = await p1Page.locator('.bg-blue-100.text-blue-700');
  const roomCodeWithHash = await roomCodeElement.innerText();
  const roomCode = roomCodeWithHash.replace('#', '');
  console.log('Room Code:', roomCode);

  // 2. P2 Joins Room
  console.log('P2 joining room...');
  p2Page.on('dialog', async dialog => {
      console.log(`[P2 Alert]: ${dialog.message()}`);
      await dialog.accept();
  });
  // Open Join Modal
  await p2Page.click('button:has-text("加入房间")'); 
  await p2Page.fill('input[placeholder="请输入6位房间号"]', roomCode);
  await p2Page.click('form button:has-text("加入")');
  
  await expect(p2Page).toHaveURL(/\/game\//);

  // Verify P1 sees P2
  await expect(p1Page.locator(`text=${p2Name}`)).toBeVisible();
  // Verify P2 sees P1
  await expect(p2Page.locator(`text=${p1Name}`)).toBeVisible();

  // 3. P2 Toggles Ready
  console.log('P2 toggling ready...');
  await p2Page.click('text=准备');
  // Verify P2 sees Ready state (Green check or "Cancel Ready")
  await expect(p2Page.locator('text=取消准备')).toBeVisible();
  // Verify P1 sees P2 Ready
  // The UI shows a green checkmark.
  // We can check for the checkmark icon existence within P2's user card.
  // The user card contains the username.
  const p2CardInP1 = p1Page.locator(`div:has-text("${p2Name}")`).first(); 
  // Need to be specific because "UserB" text is in the card.
  // The structure is: div > span(username). Sibling div has Check icon.
  // Let's just check if there is a green badge nearby.
  // Actually, look at the code:
  // <div className="absolute -bottom-1 -right-1 bg-green-500 ..."> <Check ... /> </div>
  // It is inside the avatar div.
  await expect(p1Page.locator(`text=${p2Name}`).locator('..').locator('.bg-green-500')).toBeVisible();

  // 4. P2 Cancels Ready
  console.log('P2 canceling ready...');
  await p2Page.click('text=取消准备');
  await expect(p2Page.locator('text=准备')).toBeVisible();
  await expect(p1Page.locator(`text=${p2Name}`).locator('..').locator('.bg-green-500')).not.toBeVisible();

  // 5. P2 Leaves and Re-joins
  console.log('P2 leaving...');
  // Handle confirm dialog - register BEFORE action
  p2Page.on('dialog', dialog => dialog.accept());
  await p2Page.click('text=离开');
  // Wait for navigation
  await expect(p2Page).toHaveURL(/\/lobby/);
  
  // P1 should not see P2
  await expect(p1Page.locator(`text=${p2Name}`)).not.toBeVisible();

  console.log('P2 re-joining...');
  await p2Page.click('button:has-text("加入房间")'); 
  await p2Page.fill('input[placeholder="请输入6位房间号"]', roomCode);
  await p2Page.click('form button:has-text("加入")');
  await expect(p2Page).toHaveURL(/\/game\//);
  await expect(p1Page.locator(`text=${p2Name}`)).toBeVisible();

  // 6. Everyone Join and Ready
  console.log('Everyone joining...');
  // P3 Join
  await p3Page.click('button:has-text("加入房间")'); 
  await p3Page.fill('input[placeholder="请输入6位房间号"]', roomCode);
  await p3Page.click('form button:has-text("加入")');
  // P4 Join
  await p4Page.click('button:has-text("加入房间")'); 
  await p4Page.fill('input[placeholder="请输入6位房间号"]', roomCode);
  await p4Page.click('form button:has-text("加入")');

  // Verify all present
  await expect(p1Page.locator(`text=${p3Name}`)).toBeVisible();
  await expect(p1Page.locator(`text=${p4Name}`)).toBeVisible();

  // All Ready
  console.log('Everyone getting ready...');
  // P1 (Owner) also needs to ready? 
  // In `WaitingRoom.tsx`: `myPlayer.is_ready` check is for button text.
  // `allReady` = `players.every(p => p.is_ready)`.
  // So Owner MUST ready too.
  await p1Page.click('text=准备');
  await p2Page.click('text=准备');
  await p3Page.click('text=准备');
  await p4Page.click('text=准备');

  // Verify all ready from P1's perspective
  // Wait for all 4 green checkmarks
  await expect(p1Page.locator('.bg-green-500')).toHaveCount(4, { timeout: 10000 });

  // Verify Start Button Enabled for P1
  const startBtn = p1Page.locator('button:has-text("开始游戏")');
  await expect(startBtn).toBeEnabled();

  // 7. Start Game
  console.log('Starting game...');
  await startBtn.click();

  // Verify everyone goes to Game page (PlayingRoom)
  // The URL might stay same or change?
  // `gameStore` fetches game data. If `room.status` is 'playing', it renders `PlayingRoom`.
  // Wait for "playing" status.
  // We can check for game specific elements, e.g., "Hand Cards".
  
  // Check if we are in game view.
  // `PlayingRoom` likely has elements like cards.
  await expect(p1Page.locator('.text-2xl.font-bold')).not.toHaveText('等待玩家...');
  // Check for deck/hand.
  
  console.log('Game started successfully!');
});
