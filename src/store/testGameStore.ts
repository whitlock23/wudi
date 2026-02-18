
import { create } from 'zustand';
import { Room, RoomPlayer, Game, GamePlayer, GameMove, Card } from '../types';
import { createDeck, shuffleDeck, sortCards, findValidMove } from '../utils/gameLogic';

export interface RoomPlayerWithUser extends RoomPlayer {
    user: { username: string };
}

export interface GamePlayerWithUser extends GamePlayer {
    user?: { username: string };
    seat_position?: number; // Added to fix rendering issue
}

interface TestGameStoreState {
  room: Room | null;
  players: RoomPlayerWithUser[];
  game: Game | null;
  gamePlayers: GamePlayerWithUser[];
  myHand: Card[];
  lastMove: GameMove | null; // The very last action (play or pass)
  currentWinningMove: GameMove | null; // The cards currently on table to beat
  currentPlayerId: string | null;
  tableMoves: Record<string, GameMove | null>; // Current visible move for each player
  scores: Record<string, { lastGame: number, total: number }>;
  
  // Actions
  initTestGame: () => void;
  playCards: (cards: Card[]) => void;
  passTurn: () => void;
}

const HUMAN_ID = 'human-player';
const BOTS = [
    { id: 'bot-1', username: 'Bot 1' },
    { id: 'bot-2', username: 'Bot 2' },
    { id: 'bot-3', username: 'Bot 3' }
];

const SEAT_ORDER = [HUMAN_ID, BOTS[0].id, BOTS[1].id, BOTS[2].id];

function getNextPlayerId(currentId: string) {
    const idx = SEAT_ORDER.indexOf(currentId);
    return SEAT_ORDER[(idx + 1) % 4];
}

export const useTestGameStore = create<TestGameStoreState>((set, get) => ({
  room: null,
  players: [],
  game: null,
  gamePlayers: [],
  myHand: [],
  lastMove: null,
  currentWinningMove: null,
  currentPlayerId: null,
  tableMoves: {},
  scores: {
      [HUMAN_ID]: { lastGame: 0, total: 0 },
      [BOTS[0].id]: { lastGame: 0, total: 0 },
      [BOTS[1].id]: { lastGame: 0, total: 0 },
      [BOTS[2].id]: { lastGame: 0, total: 0 }
  },

  initTestGame: () => {
      const room: Room = {
          id: 'test-room',
          name: 'Test Room',
          join_code: 'TEST',
          owner_id: HUMAN_ID,
          status: 'playing',
          current_players: 4,
          created_at: new Date().toISOString()
      };
      
      const players: RoomPlayerWithUser[] = [
          { id: '1', room_id: 'test-room', user_id: HUMAN_ID, seat_position: 0, is_ready: true, joined_at: '', user: { username: 'You' } },
          { id: '2', room_id: 'test-room', user_id: BOTS[0].id, seat_position: 1, is_ready: true, joined_at: '', user: { username: BOTS[0].username } },
          { id: '3', room_id: 'test-room', user_id: BOTS[1].id, seat_position: 2, is_ready: true, joined_at: '', user: { username: BOTS[1].username } },
          { id: '4', room_id: 'test-room', user_id: BOTS[2].id, seat_position: 3, is_ready: true, joined_at: '', user: { username: BOTS[2].username } }
      ];
      
      const deck = shuffleDeck(createDeck());
      const hands: Record<string, Card[]> = {};
      const bottomCards: Card[] = []; // No bottom cards for 13-card deal (52 cards / 4 players)
      const playDeck = deck;
      
      players.forEach((p, idx) => {
          hands[p.user_id] = sortCards(playDeck.slice(idx * 13, (idx + 1) * 13));
      });
      
      // Random landlord (just for status, no extra cards if deck is 52)
      const landlordIdx = Math.floor(Math.random() * 4);
      const landlordId = players[landlordIdx].user_id;
      // hands[landlordId] = sortCards([...hands[landlordId], ...bottomCards]); // No extra cards
      
      // Find Spade 3 Owner to start
      let s3Owner = null;
      Object.entries(hands).forEach(([uid, cards]) => {
          if (cards.some(c => c.suit === 'spades' && c.rank === '3')) s3Owner = uid;
      });
      
      const startPlayerId = s3Owner || landlordId;

      const game: Game = {
          id: 'test-game',
          room_id: 'test-room',
          status: 'playing',
          current_player_id: startPlayerId,
          winner_id: undefined,
          created_at: new Date().toISOString(),
          game_state: { multiplier: 1 }
      };
      
      const gamePlayers: GamePlayerWithUser[] = players.map(p => ({
          id: `gp-${p.id}`,
          game_id: 'test-game',
          user_id: p.user_id,
          hand_cards: hands[p.user_id],
          cards_count: hands[p.user_id].length,
          is_landlord: p.user_id === landlordId,
          is_invincible: false,
          score_change: 0,
          joined_at: new Date().toISOString(),
          user: p.user,
          seat_position: p.seat_position // Copy seat position
      }));
      
      set({
          room,
          players,
          game,
          gamePlayers,
          myHand: hands[HUMAN_ID],
          currentPlayerId: startPlayerId,
          lastMove: null,
          currentWinningMove: null,
          tableMoves: {} // Reset table moves
      });
      
      if (startPlayerId !== HUMAN_ID) {
          setTimeout(() => runBots(), 1000);
      }
  },

  playCards: (cards: Card[]) => {
      const { game, currentPlayerId, gamePlayers, currentWinningMove, tableMoves, lastMove, myHand } = get();
      if (!game || currentPlayerId !== HUMAN_ID) return;
      
      // Enforce Spade 3 rule for Human
      const isFirstMoveOfGame = !lastMove;
      if (isFirstMoveOfGame) {
          const hasSpade3 = myHand.some(c => c.suit === 'spades' && c.rank === '3');
          if (hasSpade3) {
              const playingSpade3 = cards.some(c => c.suit === 'spades' && c.rank === '3');
              if (!playingSpade3) {
                  alert('第一手牌必须包含黑桃3');
                  return;
              }
          }
      }

      const move: GameMove = {
          id: `move-${Date.now()}`,
          game_id: game.id,
          player_id: HUMAN_ID,
          cards_played: cards,
          move_type: 'play',
          played_at: new Date().toISOString()
      };
      
      const newHand = sortCards(get().myHand.filter(c => !cards.some(played => played.id === c.id)));
      
      // Check if it was a free turn (meaning new round starts), clear table if needed
      let newTableMoves = { ...tableMoves };
      
      // If I am starting a new round (currentWinningMove is null OR mine), 
      // I should clear others' moves from table? 
      // Usually in UI: 
      // Round 1: A plays -> B plays -> C passes -> D passes -> A wins round.
      // Round 2: A plays... 
      // When A plays for Round 2, the old cards from Round 1 should be gone.
      // So if (isFreeTurn), clear tableMoves.
      
      let isFreeTurn = false;
      if (!currentWinningMove || currentWinningMove.player_id === HUMAN_ID) isFreeTurn = true;
      
      if (isFreeTurn) {
          newTableMoves = {};
      }
      
      newTableMoves[HUMAN_ID] = move;

      set({
          myHand: newHand,
          lastMove: move,
          currentWinningMove: move,
          currentPlayerId: getNextPlayerId(HUMAN_ID),
          tableMoves: newTableMoves
      });
      
      const newGPs = gamePlayers.map(gp => gp.user_id === HUMAN_ID ? { ...gp, hand_cards: newHand, cards_count: newHand.length } : gp);
      set({ gamePlayers: newGPs });
      
      if (newHand.length === 0) {
          alert('You Win!');
          set({ game: { ...game, winner_id: HUMAN_ID, status: 'finished' } });
          return;
      }
      
      setTimeout(() => runBots(), 1000);
  },

  passTurn: () => {
      const { currentPlayerId, currentWinningMove, tableMoves } = get();
      if (currentPlayerId !== HUMAN_ID) return;
      
      console.log('[passTurn] Check:', { 
          currentWinningMove, 
          winnerId: currentWinningMove?.player_id, 
          myId: HUMAN_ID 
      });

      // Can only pass if not free turn
      let effectiveWinningMove = currentWinningMove;
      
      // Fallback: If currentWinningMove is missing but table has moves from others, allow pass
      if (!effectiveWinningMove) {
          const otherPlayMoves = Object.values(tableMoves)
              .filter((m): m is GameMove => !!m && m.move_type === 'play' && m.player_id !== HUMAN_ID)
              .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());
              
          if (otherPlayMoves.length > 0) {
              effectiveWinningMove = otherPlayMoves[0];
              console.warn('[passTurn] Recovered winning move from table:', effectiveWinningMove);
          }
      }

      if (!effectiveWinningMove || effectiveWinningMove.player_id === HUMAN_ID) {
          console.warn('Cannot pass on free turn. State:', { currentWinningMove, effectiveWinningMove, currentPlayerId });
          alert(`Cannot pass on free turn! (Winner: ${effectiveWinningMove?.player_id ?? 'None'})`);
          return;
      }

      const move: GameMove = {
          id: `move-${Date.now()}`,
          game_id: 'test-game',
          player_id: HUMAN_ID,
          cards_played: [],
          move_type: 'pass',
          played_at: new Date().toISOString()
      };
      
      const newTableMoves = { ...tableMoves };
      newTableMoves[HUMAN_ID] = move;
      
      set({
          lastMove: move,
          currentPlayerId: getNextPlayerId(HUMAN_ID),
          tableMoves: newTableMoves
      });
      
      setTimeout(() => runBots(), 1000);
  }
}));

function runBots() {
    const state = useTestGameStore.getState();
    const { currentPlayerId, gamePlayers, currentWinningMove, game, tableMoves } = state;
    
    if (game?.status !== 'playing') return;
    if (currentPlayerId === HUMAN_ID) return;
    if (!currentPlayerId) return;

    const botGP = gamePlayers.find(p => p.user_id === currentPlayerId);
    if (!botGP) return;

    const hand = botGP.hand_cards as Card[];
    
    // Check if free turn
    let isFreeTurn = false;
    if (!currentWinningMove) isFreeTurn = true;
    else if (currentWinningMove.player_id === currentPlayerId) isFreeTurn = true;
    
    // Check if it's the very first move of the game (Spade 3 rule)
    const isFirstMoveOfGame = !state.lastMove;
    
    // Find move
    const moveCards = findValidMove(
        hand, 
        isFreeTurn ? undefined : currentWinningMove, 
        hand.length,
        isFirstMoveOfGame
    );
    
    let move: GameMove;
    let newHand = hand;
    let newWinningMove = currentWinningMove;
    let newTableMoves = { ...tableMoves };
    
    if (isFreeTurn) {
        newTableMoves = {};
    }
    
    if (moveCards) {
        // Play
        move = {
            id: `move-${Date.now()}`,
            game_id: game.id,
            player_id: currentPlayerId,
            cards_played: moveCards,
            move_type: 'play',
            played_at: new Date().toISOString()
        };
        newHand = sortCards(hand.filter(c => !moveCards.some(mc => mc.id === c.id)));
        newWinningMove = move;
        console.log(`[Bot ${currentPlayerId}] Played`, moveCards.map(c => `${c.rank}${c.suit}`), 'New Winner:', currentPlayerId);
    } else {
        // Pass
        move = {
             id: `move-${Date.now()}`,
             game_id: game.id,
             player_id: currentPlayerId,
             cards_played: [],
             move_type: 'pass',
             played_at: new Date().toISOString()
        };
        console.log(`[Bot ${currentPlayerId}] Passed. Winner remains:`, newWinningMove?.player_id);
    }
    
    newTableMoves[currentPlayerId] = move;
    
    // Update State
    useTestGameStore.setState(prev => {
        const nextGPs = prev.gamePlayers.map(gp => 
            gp.user_id === currentPlayerId ? { ...gp, hand_cards: newHand, cards_count: newHand.length } : gp
        );
        
        return {
            gamePlayers: nextGPs,
            lastMove: move,
            currentWinningMove: newWinningMove,
            currentPlayerId: getNextPlayerId(currentPlayerId),
            tableMoves: newTableMoves
        };
    });
    
    // Check Win
    if (newHand.length === 0) {
        alert(`Bot ${currentPlayerId} Wins!`);
        useTestGameStore.setState({ game: { ...game, winner_id: currentPlayerId, status: 'finished' } });
        return;
    }
    
    // Next Turn
    const nextPlayer = getNextPlayerId(currentPlayerId);
    if (nextPlayer !== HUMAN_ID) {
        setTimeout(() => runBots(), 1000);
    }
}
