export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface User {
  id: string;
  email: string;
  username: string;
  total_score: number;
  games_played: number;
  games_won: number;
  created_at: string;
}

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Room {
  id: string;
  name: string;
  password?: string;
  join_code: string;
  owner_id: string;
  status: RoomStatus;
  current_players: number;
  created_at: string;
}

export interface RoomPlayer {
  id: string;
  room_id: string;
  user_id: string;
  is_ready: boolean;
  seat_position: number;
  joined_at: string;
}

export type GameStatus = 'preparing' | 'playing' | 'finished';

export interface Game {
  id: string;
  room_id: string;
  status: GameStatus;
  game_state: GameState;
  current_player_id?: string;
  winner_id?: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

export interface GamePlayer {
  id: string;
  game_id: string;
  user_id: string;
  hand_cards: Card[];
  cards_count: number;
  is_landlord: boolean;
  is_invincible: boolean;
  score_change: number;
  joined_at: string;
  user?: { username: string };
}

export type MoveType = 'play' | 'pass';

export interface GameMove {
  id: string;
  game_id: string;
  player_id: string;
  cards_played: Card[];
  move_type: MoveType;
  played_at: string;
}

// --- Game Logic Types ---

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2';

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // For comparing size: 3=3...A=14, 2=15
  id: string; // Unique ID for React keys
}

export interface GameState {
  deck?: Card[]; // Only for server/initial dealing logic, usually hidden from client
  last_move?: GameMove;
  multiplier: number;
  round_start_player_id?: string;
  invincible_player_id?: string; // If 1v3
}

export interface PlayerHand {
  cards: Card[];
  selectedCards: string[]; // IDs of selected cards
}
