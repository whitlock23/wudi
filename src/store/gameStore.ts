import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { Room, RoomPlayer, Game, GamePlayer, GameMove, Card } from '../types';
import { createDeck, shuffleDeck, sortCards, getPattern } from '../utils/gameLogic';

interface GameStoreState {
  room: Room | null;
  players: RoomPlayer[];
  game: Game | null;
  gamePlayers: GamePlayer[];
  myHand: Card[];
  lastMove: GameMove | null;
  tableMoves: Record<string, GameMove | null>; // Current visible move for each player
  currentWinnerId: string | null; // The player who played the current winning card
  loading: boolean;
  error: string | null;
  pollingInterval: any | null;
  
  // Actions
  fetchRoomData: (roomId: string) => Promise<void>;
  subscribeToRoom: (roomId: string) => void;
  unsubscribeFromRoom: () => void;
  startPolling: (roomId: string) => void;
  stopPolling: () => void;
  
  toggleReady: (roomId: string, isReady: boolean) => Promise<void>;
  startGame: (roomId: string) => Promise<void>;
  playCards: (cards: Card[]) => Promise<void>;
  passTurn: () => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  room: null,
  players: [],
  game: null,
  gamePlayers: [],
  myHand: [],
  lastMove: null,
  tableMoves: {},
  currentWinnerId: null,
  loading: false,
  error: null,
  pollingInterval: null,

  fetchRoomData: async (roomId: string) => {
    set({ loading: true, error: null });
    try {
      console.log('Fetching room data for:', roomId);
      
      // 1. Fetch Room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
      if (roomError) throw roomError;
      
      // 2. Fetch Players
      // Explicitly fetching room_players first
      const { data: rawPlayers, error: playersError } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', roomId)
        .order('seat_position');
        
      if (playersError) throw playersError;

      // Manually fetch user details to avoid PostgREST embedding issues
      let playersWithUser = [];
      if (rawPlayers && rawPlayers.length > 0) {
        const userIds = rawPlayers.map(p => p.user_id);
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, username')
          .in('id', userIds);
          
        if (usersError) throw usersError;
        
        const userMap = new Map(users?.map(u => [u.id, u]) || []);
        playersWithUser = rawPlayers.map(p => ({
          ...p,
          user: userMap.get(p.user_id) || { username: 'Unknown' }
        }));
      }

      // console.log('Players fetched:', JSON.stringify(playersWithUser.map(p => ({ id: p.user_id, ready: p.is_ready })), null, 2));
      set({ room: room as Room, players: playersWithUser as any });

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
             const myUserId = useAuthStore.getState().user?.id;
             const myPlayer = gPlayers.find(p => p.user_id === myUserId);
             if (myPlayer) {
               set({ myHand: myPlayer.hand_cards as Card[] });
             }
          }

          // Fetch Recent Moves to populate table
          // Logic: Fetch enough moves to reconstruct the current round context.
          const { data: moves } = await supabase
             .from('game_moves')
             .select('*')
             .eq('game_id', game.id)
              .order('played_at', { ascending: false })
              .limit(50);
           
           if (moves && moves.length > 0) {
            set({ lastMove: moves[0] as GameMove });
            
            // Reconstruct tableMoves from history (Oldest -> Newest)
            const sortedMoves = [...moves].reverse();
            
            let currentTable: Record<string, GameMove> = {};
            let currentWinnerId: string | null = null;
            
            sortedMoves.forEach((m: GameMove) => {
                if (m.move_type === 'play') {
                    // If it's the first move of the game OR the player is the current winner (starting new round)
                    // Then clear the table
                    if (currentWinnerId === null || m.player_id === currentWinnerId) {
                        currentTable = {};
                    }
                    // Update winner to this player (since they just played a valid hand)
                    currentWinnerId = m.player_id;
                }
                // Update the table for this player
                currentTable[m.player_id] = m;
            });
            
            set({ tableMoves: currentTable, currentWinnerId });
          } else {
            // No moves yet
            set({ tableMoves: {}, currentWinnerId: null });
          }
        }
      }

    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  startPolling: (roomId: string) => {
    // Clear existing interval if any
    const { pollingInterval } = get();
    if (pollingInterval) clearInterval(pollingInterval);

    // Start new interval
    const interval = setInterval(() => {
        // Only fetch if tab is visible? (Optional optimization)
        if (!document.hidden) {
            get().fetchRoomData(roomId);
        }
    }, 2000); // Poll every 2 seconds

    set({ pollingInterval: interval });
  },

  stopPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) {
        clearInterval(pollingInterval);
        set({ pollingInterval: null });
    }
  },

  subscribeToRoom: (roomId: string) => {
    // Start polling as backup for Realtime
    get().startPolling(roomId);

    // Subscription Logic
    // 1. Room updates
    supabase.channel(`room_updates:${roomId}`)
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
        async () => {
          console.log('Room players updated, refetching...');
          const { data: rawPlayers } = await supabase
            .from('room_players')
            .select('*')
            .eq('room_id', roomId)
            .order('seat_position');
            
          if (rawPlayers && rawPlayers.length > 0) {
             const userIds = rawPlayers.map(p => p.user_id);
             const { data: users } = await supabase.from('users').select('id, username').in('id', userIds);
             const userMap = new Map(users?.map(u => [u.id, u]) || []);
             const playersWithUser = rawPlayers.map(p => ({
               ...p,
               user: userMap.get(p.user_id) || { username: 'Unknown' }
             }));
             set({ players: playersWithUser as any });
          } else {
             set({ players: [] });
          }
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `room_id=eq.${roomId}` },
        (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                set({ game: payload.new as Game });
                // Refresh game data (moves, players, etc) when game state changes
                get().fetchRoomData(roomId);
            }
        }
      )
      .subscribe();
      
    // Separate channel for game updates if needed, or merge?
    // Let's keep it simple.
  },

  unsubscribeFromRoom: () => {
    get().stopPolling();
    supabase.removeAllChannels();
  },

  toggleReady: async (roomId: string, isReady: boolean) => {
    const user = useAuthStore.getState().user;
    if (!user) {
        console.error('Toggle ready failed: No user');
        return;
    }
    console.log(`Toggling ready for ${user.id} to ${isReady}`);
    try {
      const { error } = await supabase.rpc('toggle_ready', {
        p_room_id: roomId,
        p_user_id: user.id,
        p_is_ready: isReady
      });
        
      if (error) throw error;
      console.log('Toggle ready success');
      
      // Optimistic update? No, let polling handle it to be safe.
      // But we can trigger a fetch immediately.
      get().fetchRoomData(roomId);
    } catch (err: any) {
      console.error('Failed to toggle ready:', err);
      set({ error: '准备失败，请重试' });
    }
  },

  startGame: async (roomId: string) => {
    const { players } = get();
    if (players.length !== 4) throw new Error('需要4名玩家才能开始');
    
    // Logic:
    // 1. Create Deck (52 cards)
    let deck = shuffleDeck(createDeck());
    
    // 2. Deal logic for 4 players with 1 deck:
    // 52 cards total. 
    // No Landlord, everyone gets 13 cards.
    
    // const bottomCards = deck.slice(0, 4); // No bottom cards
    const playDeck = deck; // All 52 cards
    
    const hands: Record<string, Card[]> = {};
    
    // Distribute 13 cards to each player
    players.forEach((p, index) => {
      hands[p.user_id] = sortCards(playDeck.slice(index * 13, (index + 1) * 13));
    });

    // 3. Determine Teams & Start Player
    // Find who has H2 and D2
    let h2Owner = null;
    let d2Owner = null;
    let s3Owner = null;
    
    Object.entries(hands).forEach(([uid, cards]) => {
        if (cards.some(c => c.suit === 'hearts' && c.rank === '2')) h2Owner = uid;
        if (cards.some(c => c.suit === 'diamonds' && c.rank === '2')) d2Owner = uid;
        if (cards.some(c => c.suit === 'spades' && c.rank === '3')) s3Owner = uid;
    });

    let invincibleId = null;
    if (h2Owner && h2Owner === d2Owner) {
        invincibleId = h2Owner; // One person has both -> Invincible (1v3)
    }
    
    // Start Player: Spade 3 Owner -> H2 -> D2 -> Random
    const startPlayerId = s3Owner || h2Owner || d2Owner || players[Math.floor(Math.random() * 4)].user_id;
    
    const handsJson: Record<string, Card[]> = {};
    players.forEach((p) => {
       handsJson[p.user_id] = hands[p.user_id];
    });

    const { error } = await supabase.rpc('start_game', {
      p_room_id: roomId,
      p_hands: handsJson,
      p_landlord_cards: [], // No bottom cards
      p_first_player_id: startPlayerId,
      p_invincible_player_id: invincibleId
    });
    
    if (error) throw error;
  },

  playCards: async (cards: Card[]) => {
      const { game, room, myHand } = get();
      if (!game || !room) return;
      
      const user = useAuthStore.getState().user;
      if (!user) return;
      
      // Determine pattern
      const pattern = getPattern(cards);
      if (!pattern) throw new Error('Invalid card pattern');
      
      const hasSpade3 = myHand.some(c => c.suit === 'spades' && c.rank === '3');
      if (hasSpade3) {
           const playingSpade3 = cards.some(c => c.suit === 'spades' && c.rank === '3');
           if (!playingSpade3) {
              throw new Error('第一手牌必须包含黑桃3');
           }
      }
      
      const { error } = await supabase.rpc('play_cards', {
          p_game_id: game.id,
          p_player_id: user.id,
          p_cards: cards,
          p_move_type: pattern.type
      });
      
      if (error) throw error;
      get().fetchRoomData(room.id);
  },

  passTurn: async () => {
      const { game, room, currentWinnerId, tableMoves } = get();
      if (!game || !room) return;
      
      const user = useAuthStore.getState().user;
      if (!user) return;

      console.log('[passTurn] Check:', { 
          currentWinnerId, 
          userId: user.id, 
          tableMoves: Object.values(tableMoves).map(m => m ? `${m.player_id}:${m.move_type}` : 'null') 
      });

      // Check if free turn
      // Logic: If I am the winner, or no one is winner (start of game), I must play.
      let isFreeTurn = (currentWinnerId === user.id || currentWinnerId === null);

      // Fallback/Safety Check:
      // If logic thinks it's a free turn (e.g. currentWinnerId is null),
      // but there are actual PLAY moves from others on the table,
      // then it's NOT a free turn. State might be out of sync, but we should allow pass.
      if (isFreeTurn) {
          const hasOtherPlayMoves = Object.values(tableMoves).some(
              m => m && m.move_type === 'play' && m.player_id !== user.id
          );
          if (hasOtherPlayMoves) {
              console.warn('[passTurn] Override: Found other players moves on table, allowing pass despite currentWinnerId check.');
              isFreeTurn = false;
          }
      }

      if (isFreeTurn) {
          alert('当前是你的自由出牌轮，不能跳过！');
          return;
      }

      const { error } = await supabase.rpc('pass_turn', {
          p_game_id: game.id,
          p_player_id: user.id
      });
      
      if (error) throw error;
      get().fetchRoomData(room.id);
  },

  leaveRoom: async (roomId: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    
    // Stop polling immediately
    get().stopPolling();
    
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('leave_room', {
        p_room_id: roomId,
        p_user_id: user.id
      });
        
      if (error) throw error;
      if (!data.success) throw new Error(data.message);
      
      // Clear local state
      get().unsubscribeFromRoom();
      set({
        room: null,
        players: [],
        game: null,
        gamePlayers: [],
        myHand: [],
        lastMove: null,
        tableMoves: {}
      });
      
    } catch (err: any) {
      console.error('Leave room failed:', err);
      // If error says "Room already deleted", we should still clean up local state
      if (err.message && (err.message.includes('Room already deleted') || err.message.includes('not found'))) {
          get().unsubscribeFromRoom();
          set({
            room: null,
            players: [],
            game: null,
            gamePlayers: [],
            myHand: [],
            lastMove: null,
            tableMoves: {}
          });
          return;
      }

      set({ error: err.message });
      throw err;
    } finally {
      set({ loading: false });
    }
  }
}));
