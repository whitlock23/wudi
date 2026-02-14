
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

function saveDB(db: any) {
    if (!isBrowser) {
        memoryDB = db;
        return;
    }
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    notifySubscribers();
}

// --- Realtime Logic ---

const channel = isBrowser ? new BroadcastChannel('mock_supa_realtime') : null;

if (channel) {
    channel.onmessage = () => {
        // When other tab updates DB, trigger subscribers
        notifySubscribers();
    };
}

// Subscribers: callbacks that need to run when DB changes
const subscribers: Set<(payload: any) => void> = new Set();

function notifySubscribers() {
    // Notify local subscribers
    const payload = { eventType: 'UPDATE', new: {}, old: {} }; // Dummy payload
    subscribers.forEach(cb => cb(payload));
    
    // Notify other tabs
    if (channel) {
        channel.postMessage('ping');
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
    saveDB(db);
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
    saveDB(db);
    return { success: true, room_id: p_room_id };
  },

  toggle_ready: ({ p_room_id, p_user_id, p_is_ready }: any) => {
    const db = getDB();
    const player = db.room_players.find((rp: any) => rp.room_id === p_room_id && rp.user_id === p_user_id);
    if (player) {
      player.is_ready = p_is_ready;
      saveDB(db);
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
    saveDB(db);
  },

  play_cards: ({ p_game_id, p_player_id, p_cards, p_move_type }: any) => {
    const db = getDB();
    const game = db.games.find((g: any) => g.id === p_game_id);
    if (!game) throw new Error('Game not found');
    if (game.status !== 'playing') throw new Error('Game not playing');
    if (game.current_player_id !== p_player_id) throw new Error('Not your turn');

    const player = db.game_players.find((gp: any) => gp.game_id === p_game_id && gp.user_id === p_player_id);
    if (!player) throw new Error('Player not found');

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

    // Check Win
    if (player.cards_count === 0) {
        game.status = 'finished';
        game.winner_id = p_player_id;
        
        // --- Scoring Logic ---
        const allGamePlayers = db.game_players.filter((gp: any) => gp.game_id === p_game_id);
        const winner = player;
        
        // Spring Check
        let isSpring = false;
        
        // Determine Teams
        // Invincible Mode (1 vs 3)
        const invinciblePlayer = allGamePlayers.find((gp: any) => gp.is_invincible);
        
        // Case 1: Invincible Exists
        if (invinciblePlayer) {
            const isWinnerInvincible = (winner.user_id === invinciblePlayer.user_id);
            const peasants = allGamePlayers.filter((gp: any) => gp.user_id !== invinciblePlayer.user_id);
            
            if (isWinnerInvincible) {
                // Invincible Wins. Spring if ALL peasants played 0 times.
                if (peasants.every((p: any) => (p.played_times || 0) === 0)) {
                    isSpring = true;
                }
            } else {
                // Peasants Win. Spring (Reverse Spring) if Invincible played only 1 time.
                if ((invinciblePlayer.played_times || 0) === 1) {
                    isSpring = true;
                }
            }
            
            if (isSpring) game.game_state.multiplier *= 2;
            
            const score = (game.game_state.base_score || 1) * (game.game_state.multiplier || 1);
            
            if (isWinnerInvincible) {
                // Invincible wins: +3*score, Peasants: -score
                invinciblePlayer.score_change = 3 * score;
                peasants.forEach((p: any) => p.score_change = -score);
            } else {
                // Peasants win: Invincible: -3*score, Peasants: +score
                invinciblePlayer.score_change = -3 * score;
                peasants.forEach((p: any) => p.score_change = score);
            }
        } 
        // Case 2: No Invincible (2 vs 2 Team Mode)
        else {
            // Find Teams: H2 and D2 holders are teammates.
            const h2Owner = allGamePlayers.find((gp: any) => gp.is_h2_owner);
            const d2Owner = allGamePlayers.find((gp: any) => gp.is_d2_owner);
            
            // Should always exist unless deck is partial? Assuming full deck.
            if (h2Owner && d2Owner) {
                const team1Ids = [h2Owner.user_id, d2Owner.user_id]; // Note: if same person, should be Invincible case
                // Determine winner's team
                const isWinnerTeam1 = team1Ids.includes(winner.user_id);
                
                // Spring Logic for 2v2
                // Definition: Winning team wins, Losing team has 0 played_times total?
                // Or losing team each player has 0 played_times?
                // Strict Spring: Losing team never played a card.
                const losingTeam = allGamePlayers.filter((gp: any) => 
                    isWinnerTeam1 ? !team1Ids.includes(gp.user_id) : team1Ids.includes(gp.user_id)
                );
                
                if (losingTeam.every((p: any) => (p.played_times || 0) === 0)) {
                    isSpring = true;
                }
                
                if (isSpring) game.game_state.multiplier *= 2;
                const score = (game.game_state.base_score || 1) * (game.game_state.multiplier || 1);
                
                allGamePlayers.forEach((gp: any) => {
                    if (isWinnerTeam1) {
                        // Winner Team +score, Loser Team -score
                        if (team1Ids.includes(gp.user_id)) gp.score_change = score;
                        else gp.score_change = -score;
                    } else {
                        // Winner Team (Team 2) +score, Team 1 -score
                        if (!team1Ids.includes(gp.user_id)) gp.score_change = score;
                        else gp.score_change = -score;
                    }
                });
            } else {
                 // Fallback if H2/D2 not found (should not happen in full deck)
                 // Winner takes all? Just give +score to winner, -score to others?
                 allGamePlayers.forEach((gp: any) => {
                     if (gp.user_id === winner.user_id) gp.score_change = 3 * (game.game_state.base_score || 1);
                     else gp.score_change = -(game.game_state.base_score || 1);
                 });
            }
        }

        // Apply Scores to Total
        allGamePlayers.forEach((gp: any) => {
            const u = db.users.find((user: any) => user.id === gp.user_id);
            if (u) {
                u.total_score = (u.total_score || 0) + (gp.score_change || 0);
            }
        });

        const room = db.rooms.find((r: any) => r.id === game.room_id);
        if (room) room.status = 'finished';
        saveDB(db);
        return { success: true, winner_id: p_player_id };
    }

    const roomPlayers = db.room_players.filter((rp: any) => rp.room_id === game.room_id).sort((a: any, b: any) => a.seat_position - b.seat_position);
    const currentIndex = roomPlayers.findIndex((rp: any) => rp.user_id === p_player_id);
    const nextIndex = (currentIndex + 1) % roomPlayers.length;
    game.current_player_id = roomPlayers[nextIndex].user_id;

    saveDB(db);
    return { success: true };
  },

  pass_turn: ({ p_game_id, p_player_id }: any) => {
    const db = getDB();
    const game = db.games.find((g: any) => g.id === p_game_id);
    if (!game) throw new Error('Game not found');
    if (game.current_player_id !== p_player_id) throw new Error('Not your turn');

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

    saveDB(db);
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
      saveDB(db);
      return { success: true, message: 'Room deleted' };
    }

    if (room.owner_id === p_user_id) {
        const nextOwner = db.room_players.find((rp: any) => rp.room_id === p_room_id);
        if (nextOwner) {
            room.owner_id = nextOwner.user_id;
        }
    }
    
    saveDB(db);
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
         subscribers.add(callback);
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
