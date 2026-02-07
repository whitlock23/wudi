import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Room, RoomPlayer, Game, GamePlayer, GameMove, Card } from '../types';
import { createDeck, shuffleDeck, sortCards } from '../utils/gameLogic';

interface GameStoreState {
  room: Room | null;
  players: RoomPlayer[];
  game: Game | null;
  gamePlayers: GamePlayer[];
  myHand: Card[];
  lastMove: GameMove | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchRoomData: (roomId: string) => Promise<void>;
  subscribeToRoom: (roomId: string) => void;
  unsubscribeFromRoom: () => void;
  
  toggleReady: (roomId: string, isReady: boolean) => Promise<void>;
  startGame: (roomId: string) => Promise<void>;
  playCards: (cards: Card[]) => Promise<void>;
  passTurn: () => Promise<void>;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  room: null,
  players: [],
  game: null,
  gamePlayers: [],
  myHand: [],
  lastMove: null,
  loading: false,
  error: null,

  fetchRoomData: async (roomId: string) => {
    set({ loading: true, error: null });
    try {
      // 1. Fetch Room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
      if (roomError) throw roomError;
      
      // 2. Fetch Players
      const { data: players, error: playersError } = await supabase
        .from('room_players')
        .select('*, user:users(username)') // Join to get usernames
        .eq('room_id', roomId)
        .order('seat_position');
      if (playersError) throw playersError;

      set({ room: room as Room, players: players as any });

      // 3. If playing, fetch game data
      if (room.status === 'playing') {
        const { data: game, error: gameError } = await supabase
          .from('games')
          .select('*')
          .eq('room_id', roomId)
          .eq('status', 'playing')
          .single();
        
        if (game && !gameError) {
          set({ game: game as Game });
          
          // Fetch Game Players
          const { data: gPlayers } = await supabase
            .from('game_players')
            .select('*, user:users(username)')
            .eq('game_id', game.id);
            
          if (gPlayers) {
             set({ gamePlayers: gPlayers as any });
             // Extract my hand
             const myUserId = (await supabase.auth.getUser()).data.user?.id;
             const myPlayer = gPlayers.find(p => p.user_id === myUserId);
             if (myPlayer) {
               set({ myHand: myPlayer.hand_cards as Card[] });
             }
          }

          // Fetch Last Move
          const { data: moves } = await supabase
             .from('game_moves')
             .select('*')
             .eq('game_id', game.id)
             .order('played_at', { ascending: false })
             .limit(1);
          
          if (moves && moves.length > 0) {
            set({ lastMove: moves[0] as GameMove });
          }
        }
      }

    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  subscribeToRoom: (roomId: string) => {
    // Subscription Logic
    // 1. Room updates
    supabase.channel(`room:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, 
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            set({ room: payload.new as Room });
            // If status changed to playing, re-fetch everything
            if ((payload.old as Room).status === 'waiting' && (payload.new as Room).status === 'playing') {
              get().fetchRoomData(roomId);
            }
          }
        }
      )
      .subscribe();

    // 2. Room Players updates
    supabase.channel(`room_players:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
        async () => {
          // Re-fetch players to get joined user data easily
          const { data: players } = await supabase
            .from('room_players')
            .select('*, user:users(username)')
            .eq('room_id', roomId)
            .order('seat_position');
          if (players) set({ players: players as any });
        }
      )
      .subscribe();
      
    // 3. Game updates (if playing)
    // We can subscribe to 'games', 'game_players', 'game_moves'
    // For simplicity, let's just listen to everything related to this room's active game
    // Ideally we need the gameId, but we might not have it yet.
    // So we listen when game is set.
    // ... For now, rely on fetchRoomData handling the transition.
  },

  unsubscribeFromRoom: () => {
    supabase.removeAllChannels();
  },

  toggleReady: async (roomId: string, isReady: boolean) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    await supabase
      .from('room_players')
      .update({ is_ready: isReady })
      .eq('room_id', roomId)
      .eq('user_id', user.id);
  },

  startGame: async (roomId: string) => {
    const { players } = get();
    if (players.length !== 4) throw new Error('需要4名玩家才能开始');
    
    // Logic:
    // 1. Create Deck
    let deck = shuffleDeck(createDeck());
    
    // 2. Deal 16 cards to each of 4 players
    // Remaining 4 cards? No, 52 cards / 4 players = 13 cards?
    // User rule: "52 cards... each person 16 cards" -> 16*4 = 64 cards? Impossible with 52 cards.
    // User rule: "3 bottom cards". 52 - 3 = 49. 49 / 4 = 12.25?
    // Wait, let me check the user input again.
    // "52张，没有大小王... 每人16张牌" -> 16 * 4 = 64. 
    // Is it possible the user means "including 2 decks?" No, "一副牌(52张)".
    // Maybe my math is wrong or the rule description has conflict.
    // "无敌通常由4人使用一副牌（52张...）"
    // If 4 people, 52 cards. 52 / 4 = 13 cards each.
    // User says "每人16张牌". 
    // I must clarify or assume.
    // Standard Dou Dizhu (3 people) is 54 cards (with jokers), 17 * 3 = 51, + 3 bottom.
    // If 4 people, 52 cards. 
    // Maybe user means "remove some cards" or "2 decks"?
    // "4人使用一副牌" is explicit.
    // If I give 12 cards to each (48), 4 left? Or 13 cards to each (52), 0 left?
    // User says "3张底牌". 52 - 3 = 49. 49 is not divisible by 4.
    // Maybe user made a mistake in description.
    // "每人16张牌" -> 64 cards.
    
    // I will assume standard 4-player rules often use 2 decks (108 cards).
    // But user explicitly said "一副牌 (52张)".
    // Let's assume 12 cards each (48) + 4 bottom? Or 13 each?
    // If I follow "52 cards" and "4 players", I CANNOT give 16 cards.
    // I will give 12 cards to each player (48 total), and 4 bottom cards?
    // Or 13 cards to 3 players, 10 to 1?
    // Let's assume 12 cards each, and 4 bottom cards (or 3 as user said, 1 left?).
    
    // WAIT. "无敌通常由4人使用一副牌... 每人16张牌".
    // 16 * 4 = 64. 52 < 64.
    // Maybe user implies "remove 3, 4, 5"? No "52张" is explicit.
    
    // Decision: I will stick to "52 cards" and distribute them as evenly as possible.
    // 52 cards - 3 bottom = 49.
    // 49 / 4 = 12 cards each, plus 1 extra for someone?
    // Or maybe "16张" is a typo for "12张"?
    // I'll assume 12 cards for now, and 3 bottom cards (total 51), burn 1?
    // Or just 13 cards each, no bottom?
    // But user says "3张底牌".
    
    // Let's re-read carefully: "无敌通常由4人使用一副牌（52张，没有大小王）... 每人16张牌"
    // This is mathematically impossible.
    // I will implement 12 cards per person (48 total) + 3 bottom = 51 cards. 1 card removed (e.g. Spade A?).
    // OR, I will use 2 decks if the user insists on 16 cards? No, user said "一副牌".
    // I'll assume it's a typo and distribute 52-3 = 49 cards.
    // 3 players get 12, 1 player gets 13?
    // Or everyone gets 12, bottom is 4?
    // Let's do: Everyone 12 cards (48), 4 bottom cards. (User said 3 bottom).
    // Let's do: Everyone 12 cards, 4 bottom.
    
    // Actually, let's distribute all 52 cards. 13 each.
    // And "Bottom cards" might be just taken from the deck?
    // "3张底牌发给地主" -> So someone gets 3 more.
    // If everyone starts with 12, +3 = 15.
    // If everyone starts with 13, no cards left for bottom.
    
    // Best Guess: 4 players, 1 deck.
    // Deal 49 cards? (12, 12, 12, 13) + 3 bottom? No.
    // Deal 48 cards (12 each). 4 bottom.
    // Landlord gets 4 bottom -> 16 cards. (Matches user's "16 cards" for landlord?)
    // User said "每人16张牌". This implies EVERYONE has 16.
    // That requires 64 cards.
    // Maybe user meant 2 decks?
    // "无敌通常由4人使用一副牌" is very specific.
    
    // I will try to support the user's "16 cards" requirement by using **2 decks** (104 cards) or just ignore the "52 cards" constraint if "16 cards" is more important.
    // But "红桃2和方片2是最大的牌... 1v3". If 2 decks, there are 2 Heart 2s and 2 Diamond 2s.
    // The rule "如果红桃2和方片2是在一个人手中" implies there is only ONE of each.
    // So it MUST be 1 deck.
    
    // Conclusion: "每人16张牌" is likely a typo for "12张" or "13张".
    // I will implement: 52 cards.
    // Reserve 4 cards as bottom (or 3?). User said 3.
    // 52 - 3 = 49.
    // 49 cards distributed to 4 players.
    // P1: 13, P2: 12, P3: 12, P4: 12.
    // Landlord gets +3 = 15 or 16.
    
    // I will just distribute 12 cards to each (48), and keep 4 as bottom.
    // Landlord gets 4 -> 16 cards. This matches "16 cards" for at least the winner!
    // And others have 12.
    // This seems the most logical interpretation of conflicting constraints.
    
    // Implementation:
    // Deck: 52 cards.
    // Deal: 12 * 4 = 48.
    // Bottom: 4 cards.
    // Random start player.
    
    const hands: Record<string, Card[]> = {};
    const bottomCards = deck.slice(0, 4); // 4 cards for bottom
    const playDeck = deck.slice(4); // 48 cards
    
    players.forEach((p, index) => {
      // Give 12 cards
      hands[p.user_id] = sortCards(playDeck.slice(index * 12, (index + 1) * 12));
    });

    // Call RPC
    // We need to determine who is landlord later? Or now?
    // User rule: "发完牌后，拿到红桃2和方片2的人为队友... 如果...在一个人手中... 1v3"
    // So dealing is fully random.
    // And the "Bottom cards" rule: "3张底牌发给地主".
    // Wait, if team is determined by H2/D2, who is "Landlord"?
    // "地主" usually means the 1 in 1v3.
    // If 2v2, is there a landlord?
    // User says: "3张底牌发给地主".
    // This implies there is a bidding phase OR the H2/D2 holder gets them?
    // User rule: "发牌后确认阵营".
    // "地主首先出牌".
    
    // Simplified Logic for MVP:
    // 1. Deal all cards? No, need bottom.
    // Let's stick to: 48 cards dealt, 4 bottom.
    // Randomly assign one player as "Landlord" (or first player) to take bottom cards?
    // OR, better:
    // Deal 12 to everyone.
    // Reveal bottom 4.
    // Who gets them?
    // Maybe the one with H2?
    // User logic is a bit mixed with Dou Dizhu.
    
    // Let's try:
    // Deal 13 to everyone (52 total). No bottom cards.
    // If user insists on bottom cards, I'll take 4 out.
    // But "3张底牌". 
    // I will implement:
    // Deal 12 to everyone (48).
    // 3 Bottom cards (51).
    // 1 removed card (Spade 3?).
    // Give 3 bottom to Player 1 (Random). He becomes "Landlord" candidate.
    
    // Let's refine based on "Invincible" rule:
    // The "Invincible" player is the one with H2 and D2.
    // If split, it's 2v2.
    // If together, it's 1v3.
    
    // Revised Plan:
    // 1. Shuffle 52 cards.
    // 2. Deal 12 cards to each of 4 players (48).
    // 3. Remaining 4 cards are "Bottom".
    // 4. Reveal Bottom.
    // 5. Ask players to "Call Landlord"? Or just give to the one with H2?
    // User: "3张底牌发给地主".
    // I'll assume a bidding phase or random assignment for now.
    // Randomly pick a "Start Player". Give him the 4 cards. He is "Landlord".
    // Then check H2/D2 for teams.
    
    const handsJson: Record<string, Card[]> = {};
    players.forEach((p, idx) => {
       handsJson[p.user_id] = hands[p.user_id];
    });
    
    // Assign bottom to first player (randomly picked or owner)
    // Actually, let's just give bottom to the owner for simplicity of this turn.
    // Or better, random.
    const landlordIdx = Math.floor(Math.random() * 4);
    const landlordId = players[landlordIdx].user_id;
    
    handsJson[landlordId] = sortCards([...handsJson[landlordId], ...bottomCards]);
    
    const { error } = await supabase.rpc('start_game', {
      p_room_id: roomId,
      p_hands: handsJson,
      p_landlord_cards: bottomCards,
      p_first_player_id: landlordId
    });
    
    if (error) throw error;
  },

  playCards: async (cards: Card[]) => {
    // Implement play logic
  },

  passTurn: async () => {
    // Implement pass logic
  }
}));
