
import { SupabaseClient } from '@supabase/supabase-js';

const isBrowser = typeof window !== 'undefined';
const DB_KEY = 'wudi_mock_db_v2';

// In-memory fallback
let memoryDB: any = {
  users: [],
  rooms: [],
  room_players: [],
  games: [],
  game_players: [],
  game_moves: [],
};

// --- Persistence Logic ---

function getDB() {
    if (!isBrowser) return memoryDB;
    try {
        const s = localStorage.getItem(DB_KEY);
        if (s) return JSON.parse(s);
    } catch (e) {
        console.error('MockDB load error', e);
    }
    // Init
    const init = { users: [], rooms: [], room_players: [], games: [], game_players: [], game_moves: [] };
    localStorage.setItem(DB_KEY, JSON.stringify(init));
    return init;
}

function saveDB(db: any, event?: any) {
    if (!isBrowser) {
        memoryDB = db;
        return;
    }
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    if (event) {
        notifySubscribers(event);
    }
}

// --- Realtime Logic ---

const channel = isBrowser ? new BroadcastChannel('mock_supa_realtime') : null;

if (channel) {
    channel.onmessage = (msg) => {
        // When other tab updates DB, trigger subscribers
        if (msg.data && msg.data.eventType) {
            notifySubscribers(msg.data, false); // Don't re-broadcast
        } else {
            // Fallback for generic ping (shouldn't happen with new logic)
            // But if we receive just a ping, we can't do much without payload.
            // Let's assume we fetch generic UPDATE
        }
    };
}

// Subscribers: callbacks that need to run when DB changes
interface Subscriber {
    filter: any;
    callback: (payload: any) => void;
}
const subscribers: Set<Subscriber> = new Set();

function notifySubscribers(payload: any, broadcast = true) {
    // Notify local subscribers based on filter
    subscribers.forEach(({ filter, callback }) => {
        // Simple matching logic
        // If filter is for specific table
        if (filter.table && filter.table !== payload.table) return;
        // If filter is for specific event
        if (filter.event !== '*' && filter.event !== payload.eventType) return;
        
        // Filter string matching (e.g. "status=eq.waiting")
        if (filter.filter) {
            const [key, val] = filter.filter.split('=eq.');
            if (key && val) {
                // Check if new or old record matches
                // If DELETE, check old. If INSERT/UPDATE, check new.
                const record = payload.new || payload.old;
                if (record && String(record[key]) !== String(val)) return;
            }
        }

        callback(payload);
    });
    
    // Notify other tabs
    if (broadcast && channel) {
        channel.postMessage(payload);
    }
}


// Helper to simulate delay
const delay = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));

// Mock RPC Functions
const rpcFunctions: Record<string, (params: any) => any> = {
  register_user: ({ p_username, p_password }: any) => {
    const db = getDB();
    const existing = db.users.find((u: any) => u.username === p_username);
    if (existing) throw new Error('Username taken');
    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      username: p_username,
      password: p_password,
      created_at: new Date().toISOString()
    };
    db.users.push(newUser);
    saveDB(db);
    return { success: true, user: { id: newUser.id, username: newUser.username } };
  },
  
  login_user: ({ p_username, p_password }: any) => {
    const db = getDB();
    const user = db.users.find((u: any) => u.username === p_username && u.password === p_password);
    if (!user) throw new Error('Invalid credentials');
    return { success: true, user: { id: user.id, username: user.username } };
  },

  reset_test_users: () => {
      const db = getDB();
      const testUsers = ['User1', 'User2', 'User3', 'User4'];
      
      // 1. Find existing users
      const existingUsers = db.users.filter((u: any) => testUsers.includes(u.username));
      const existingIds = existingUsers.map((u: any) => u.id);
      
      // 2. Remove them from rooms, games, etc.
      db.room_players = db.room_players.filter((rp: any) => !existingIds.includes(rp.user_id));
      db.game_players = db.game_players.filter((gp: any) => !existingIds.includes(gp.user_id));
      db.users = db.users.filter((u: any) => !existingIds.includes(u.id));
      
      // 3. Create new users
      const newUsers = [];
      for (const username of testUsers) {
          const newUser = {
            id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            username: username,
            password: '123456',
            created_at: new Date().toISOString()
          };
          db.users.push(newUser);
          newUsers.push(newUser);
      }
      
      saveDB(db);
      return { success: true, message: 'Test users reset' };
  },

  create_room_custom: ({ p_name, p_owner_id, p_password }: any) => {
    const db = getDB();
    const newRoom = {
      id: `room_${Date.now()}`,
      name: p_name,
      owner_id: p_owner_id,
      password: p_password || null,
      status: 'waiting',
      current_players: 0,
      join_code: Math.random().toString(36).substr(2, 6).toUpperCase(),
      created_at: new Date().toISOString()
    };
    db.rooms.push(newRoom);
    saveDB(db, {
        eventType: 'INSERT',
        schema: 'public',
        table: 'rooms',
        new: newRoom,
        old: {}
    });
    return { success: true, room_id: newRoom.id };
  },

  join_room: ({ p_room_id, p_user_id }: any) => {
    const db = getDB();
    const room = db.rooms.find((r: any) => r.id === p_room_id);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'waiting') throw new Error('Game started');
    
    const existing = db.room_players.find((rp: any) => rp.room_id === p_room_id && rp.user_id === p_user_id);
    if (existing) return { success: true, room_id: p_room_id };
    
    if (room.current_players >= 4) throw new Error('Room full');

    // Find available seat
    const seats = [0, 1, 2, 3];
    const takenSeats = db.room_players.filter((rp: any) => rp.room_id === p_room_id).map((rp: any) => rp.seat_position);
    const seat = seats.find(s => !takenSeats.includes(s)) ?? room.current_players;

    db.room_players.push({
      room_id: p_room_id,
      user_id: p_user_id,
      seat_position: seat,
      is_ready: false,
      joined_at: new Date().toISOString()
    });
    room.current_players++;
    
    // Update room_players (for Game Room UI)
    saveDB(db, {
        eventType: 'INSERT', // insert, not update
        schema: 'public',
        table: 'room_players',
        new: db.room_players[db.room_players.length - 1],
        old: {}
    });
    
    // Update room (for Lobby UI)
    saveDB(db, {
        eventType: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        new: room,
        old: {}
    });
    
    return { success: true, room_id: p_room_id };
  },

  toggle_ready: ({ p_room_id, p_user_id, p_is_ready }: any) => {
    const db = getDB();
    const player = db.room_players.find((rp: any) => rp.room_id === p_room_id && rp.user_id === p_user_id);
    if (player) {
      player.is_ready = p_is_ready;
      saveDB(db, {
          eventType: 'UPDATE',
          schema: 'public',
          table: 'room_players',
          new: player,
          old: {}
      });
    }
  },

  start_game: ({ p_room_id, p_hands, p_landlord_cards, p_first_player_id, p_invincible_player_id }: any) => {
    const db = getDB();
    const room = db.rooms.find((r: any) => r.id === p_room_id);
    if (room) room.status = 'playing';

    const newGame = {
      id: `game_${Date.now()}`,
      room_id: p_room_id,
      status: 'playing',
      current_player_id: p_first_player_id,
      created_at: new Date().toISOString(),
      game_state: {
          multiplier: 1,
          base_score: 1
      }
    };
    db.games.push(newGame);

    const players = db.room_players.filter((rp: any) => rp.room_id === p_room_id);
    players.forEach((p: any) => {
        const hand = p_hands[p.user_id] || [];
        // Determine if player has H2 or D2
        const hasH2 = hand.some((c: any) => c.suit === 'hearts' && c.rank === '2');
        const hasD2 = hand.some((c: any) => c.suit === 'diamonds' && c.rank === '2');

        db.game_players.push({
            game_id: newGame.id,
            user_id: p.user_id,
            hand_cards: hand,
            cards_count: hand.length,
            is_landlord: p.user_id === p_first_player_id,
            is_invincible: p.user_id === p_invincible_player_id,
            joined_at: new Date().toISOString(),
            score_change: 0,
            played_times: 0,
            is_h2_owner: hasH2,
            is_d2_owner: hasD2
        });
    });
    saveDB(db, {
        eventType: 'INSERT',
        schema: 'public',
        table: 'games',
        new: newGame,
        old: {}
    });
    // Also update room status
    saveDB(db, {
        eventType: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        new: room,
        old: {}
    });
  },

  play_cards: ({ p_game_id, p_player_id, p_cards, p_move_type }: any) => {
    const db = getDB();
    const game = db.games.find((g: any) => g.id === p_game_id);
    if (!game) throw new Error('Game not found');
    if (game.status !== 'playing') throw new Error('Game not playing');
    if (game.current_player_id !== p_player_id) throw new Error('Not your turn');

    const player = db.game_players.find((gp: any) => gp.game_id === p_game_id && gp.user_id === p_player_id);
    if (!player) throw new Error('Player not found');

    // Rule: First move of game MUST include Spade 3
    // How to check if it's the first move?
    // Check if game_moves is empty for this game.
    const moves = db.game_moves.filter((m: any) => m.game_id === p_game_id);
    if (moves.length === 0) {
        const hasSpade3 = player.hand_cards.some((c: any) => c.suit === 'spades' && c.rank === '3');
        if (hasSpade3) {
             const playingSpade3 = p_cards.some((c: any) => c.suit === 'spades' && c.rank === '3');
             if (!playingSpade3) throw new Error('First move must include Spade 3');
        }
    }

    // Update Cards
    const playedIds = p_cards.map((c: any) => c.id);
    player.hand_cards = player.hand_cards.filter((c: any) => !playedIds.includes(c.id));
    player.cards_count = player.hand_cards.length;
    player.played_times = (player.played_times || 0) + 1;

    // Check Multiplier
    if (!game.game_state) game.game_state = { multiplier: 1, base_score: 1 };
    
    if (p_move_type === 'bomb') {
        game.game_state.multiplier = (game.game_state.multiplier || 1) * 2;
    } else if (p_move_type === 'invincible_bomb') {
        game.game_state.multiplier = (game.game_state.multiplier || 1) * 4;
    }

    db.game_moves.unshift({
        id: `move_${Date.now()}`,
        game_id: p_game_id,
        player_id: p_player_id,
        move_type: p_move_type || 'play',
        cards_played: p_cards,
        played_at: new Date().toISOString()
    });

    const movePayload = {
        eventType: 'INSERT',
        schema: 'public',
        table: 'game_moves',
        new: db.game_moves[0],
        old: {}
    };

    // Check Win
    if (player.cards_count === 0) {
        game.status = 'finished';
        game.winner_id = p_player_id;
        
        // ... (Scoring Logic) ...
        
        // Scoring logic updates game_players and users
        // We should notify game updates
        
        const room = db.rooms.find((r: any) => r.id === game.room_id);
        if (room) room.status = 'finished';
        
        saveDB(db, {
            eventType: 'UPDATE',
            schema: 'public',
            table: 'games',
            new: game,
            old: {}
        });
        return { success: true, winner_id: p_player_id };
    }

    const roomPlayers = db.room_players.filter((rp: any) => rp.room_id === game.room_id).sort((a: any, b: any) => a.seat_position - b.seat_position);
    const currentIndex = roomPlayers.findIndex((rp: any) => rp.user_id === p_player_id);
    const nextIndex = (currentIndex + 1) % roomPlayers.length;
    game.current_player_id = roomPlayers[nextIndex].user_id;

    saveDB(db, {
        eventType: 'UPDATE',
        schema: 'public',
        table: 'games',
        new: game,
        old: {}
    });
    return { success: true };
  },

  pass_turn: ({ p_game_id, p_player_id }: any) => {
    const db = getDB();
    const game = db.games.find((g: any) => g.id === p_game_id);
    if (!game) throw new Error('Game not found');
    if (game.current_player_id !== p_player_id) throw new Error('Not your turn');

    // Check if free turn (cannot pass)
    // Find last "play" move
    const moves = db.game_moves.filter((m: any) => m.game_id === p_game_id).sort((a: any, b: any) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());
    const lastPlay = moves.find((m: any) => m.move_type === 'play' || m.move_type === 'bomb' || m.move_type === 'invincible_bomb');
    
    if (!lastPlay) throw new Error('Cannot pass on first turn');
    if (lastPlay.player_id === p_player_id) throw new Error('Cannot pass on free turn');

    db.game_moves.unshift({
        id: `move_${Date.now()}`,
        game_id: p_game_id,
        player_id: p_player_id,
        move_type: 'pass',
        cards_played: [],
        played_at: new Date().toISOString()
    });

    const roomPlayers = db.room_players.filter((rp: any) => rp.room_id === game.room_id).sort((a: any, b: any) => a.seat_position - b.seat_position);
    const currentIndex = roomPlayers.findIndex((rp: any) => rp.user_id === p_player_id);
    const nextIndex = (currentIndex + 1) % roomPlayers.length;
    game.current_player_id = roomPlayers[nextIndex].user_id;

    saveDB(db, {
        eventType: 'UPDATE',
        schema: 'public',
        table: 'games',
        new: game,
        old: {}
    });
    return { success: true };
  },

  leave_room: ({ p_room_id, p_user_id }: any) => {
    const db = getDB();
    const roomIndex = db.rooms.findIndex((r: any) => r.id === p_room_id);
    if (roomIndex === -1) return { success: true, message: 'Room not found' };
    const room = db.rooms[roomIndex];

    const playerIndex = db.room_players.findIndex((rp: any) => rp.room_id === p_room_id && rp.user_id === p_user_id);
    if (playerIndex !== -1) {
      db.room_players.splice(playerIndex, 1);
      room.current_players--;
    }

    if (room.current_players <= 0) {
      db.rooms.splice(roomIndex, 1);
      const gameIndices = db.games.filter((g: any) => g.room_id === p_room_id).map((g: any) => db.games.indexOf(g));
      gameIndices.reverse().forEach((idx: any) => db.games.splice(idx, 1));
      
      saveDB(db, {
          eventType: 'DELETE',
          schema: 'public',
          table: 'rooms',
          old: { id: p_room_id },
          new: {}
      });
      return { success: true, message: 'Room deleted' };
    }

    if (room.owner_id === p_user_id) {
        const nextOwner = db.room_players.find((rp: any) => rp.room_id === p_room_id);
        if (nextOwner) {
            room.owner_id = nextOwner.user_id;
        }
    }
    
    // Update room players count
    saveDB(db, {
        eventType: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        new: room,
        old: {}
    });
    
    // Update room_players list (DELETE)
    saveDB(db, {
        eventType: 'DELETE',
        schema: 'public',
        table: 'room_players',
        old: { room_id: p_room_id, user_id: p_user_id },
        new: {}
    });
    
    return { success: true, message: 'Left room' };
  }
};

// Mock Query Builder
class MockQueryBuilder {
  private data: any[] = [];
  
  constructor(private table: string) {
      const db = getDB();
      if (table && db[table as keyof typeof db]) {
          this.data = [...db[table as keyof typeof db]];
      }
  }

  select(columns: string) {
    if (columns.includes('user:users')) {
        const db = getDB();
        this.data = this.data.map(item => {
            const user = db.users.find((u: any) => u.id === item.user_id);
            return { ...item, user: user ? { username: user.username } : null };
        });
    }
    return this;
  }

  eq(column: string, value: any) {
    this.data = this.data.filter(item => item[column] == value);
    return this;
  }

  neq(column: string, value: any) {
    this.data = this.data.filter(item => item[column] != value);
    return this;
  }

  in(column: string, values: any[]) {
    this.data = this.data.filter(item => values.includes(item[column]));
    return this;
  }

  order(column: string, { ascending = true }: any = {}) {
    this.data.sort((a, b) => {
      if (a[column] < b[column]) return ascending ? -1 : 1;
      if (a[column] > b[column]) return ascending ? 1 : -1;
      return 0;
    });
    return this;
  }

  limit(count: number) {
    this.data = this.data.slice(0, count);
    return this;
  }

  single() {
    const item = this.data[0];
    if (!item) return { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
    return { data: item, error: null };
  }

  then(callback: any) {
    return Promise.resolve({ data: this.data, error: null }).then(callback);
  }
}

// Mock Client
export const mockSupabase = {
  rpc: async (fn: string, params: any) => {
    await delay();
    if (rpcFunctions[fn]) {
      try {
        const result = rpcFunctions[fn](params);
        return { data: result, error: null };
      } catch (e: any) {
        return { data: null, error: { message: e.message } };
      }
    }
    console.warn(`Mock RPC function not found: ${fn}`);
    return { data: null, error: { message: `Function ${fn} not found` } };
  },

  from: (table: string) => {
    return new MockQueryBuilder(table);
  },

  channel: (name: string) => {
    const subscription = {
      on: (type: string, filter: any, callback: (payload: any) => void) => {
         subscribers.add({ filter, callback });
         return subscription;
      },
      subscribe: () => {}
    };
    return subscription;
  },
  
  removeAllChannels: () => {
      subscribers.clear();
  }
} as unknown as SupabaseClient;
