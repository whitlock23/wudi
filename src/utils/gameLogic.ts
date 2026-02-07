import { Card, Suit, Rank, MoveType, GameMove } from '../types';

export const SUITS: Suit[] = ['diamonds', 'clubs', 'hearts', 'spades'];
export const RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

export const RANK_VALUES: Record<Rank, number> = {
  '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15
};

export function createDeck(): Card[] {
  const deck: Card[] = [];
  let idCounter = 0;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        suit,
        rank,
        value: RANK_VALUES[rank],
        id: `card-${idCounter++}`
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (b.value !== a.value) {
      return b.value - a.value; // Descending value
    }
    // If values are same, sort by suit order (Spades > Hearts > Clubs > Diamonds)
    const suitOrder: Record<Suit, number> = { 'spades': 4, 'hearts': 3, 'clubs': 2, 'diamonds': 1 };
    return suitOrder[b.suit] - suitOrder[a.suit];
  });
}

// Basic Move Validation Logic (Placeholder for complex rules)
export function isValidMove(selectedCards: Card[], lastMove?: GameMove): boolean {
  if (selectedCards.length === 0) return false;
  
  // Sort selected cards for easier analysis
  const sorted = sortCards(selectedCards);
  
  // 1. Check if it's a valid pattern
  const pattern = getPattern(sorted);
  if (!pattern) return false;

  // 2. If no last move, any valid pattern is okay
  if (!lastMove || lastMove.move_type === 'pass') return true;

  // 3. Compare with last move
  const lastCards = lastMove.cards_played;
  const lastPattern = getPattern(sortCards(lastCards));
  
  if (!lastPattern) return false; // Should not happen

  // Invincible Bomb beats everything
  if (pattern.type === 'invincible_bomb') return true;
  if (lastPattern.type === 'invincible_bomb') return false;

  // Bomb beats normal
  if (pattern.type === 'bomb' && lastPattern.type !== 'bomb') return true;
  if (pattern.type !== 'bomb' && lastPattern.type === 'bomb') return false;

  // Same pattern comparison
  if (pattern.type === lastPattern.type && pattern.length === lastPattern.length) {
    return pattern.value > lastPattern.value;
  }

  return false;
}

type PatternType = 
  | 'single' 
  | 'pair' 
  | 'triple' 
  | 'triple_with_pair' // 3+2
  | 'bomb' 
  | 'invincible_bomb'
  | 'sequence' // 5+ single
  | 'pair_sequence' // 2+ pairs
  | 'plane'; // ...

interface Pattern {
  type: PatternType;
  value: number; // Primary value for comparison
  length: number;
}

function getPattern(cards: Card[]): Pattern | null {
  const len = cards.length;
  if (len === 0) return null;

  // Invincible Bomb: Heart 2 + Diamond 2
  if (len === 2) {
    const c1 = cards[0];
    const c2 = cards[1];
    if (c1.rank === '2' && c2.rank === '2') {
      const suits = [c1.suit, c2.suit];
      if (suits.includes('hearts') && suits.includes('diamonds')) {
        return { type: 'invincible_bomb', value: 999, length: 2 };
      }
    }
  }

  // Single
  if (len === 1) {
    return { type: 'single', value: cards[0].value, length: 1 };
  }

  // Pair
  if (len === 2 && cards[0].value === cards[1].value) {
    return { type: 'pair', value: cards[0].value, length: 2 };
  }

  // Triple
  if (len === 3 && cards[0].value === cards[1].value && cards[1].value === cards[2].value) {
     return { type: 'triple', value: cards[0].value, length: 3 };
  }

  // Bomb (4 same)
  if (len === 4 && cards[0].value === cards[1].value && cards[1].value === cards[2].value && cards[2].value === cards[3].value) {
    return { type: 'bomb', value: cards[0].value, length: 4 };
  }

  // Triple with Pair (3+2) - Full House
  if (len === 5) {
    // 33322 or 33222 (sorted: 33322)
    // Case 1: AAA BB
    if (cards[0].value === cards[1].value && cards[1].value === cards[2].value && cards[3].value === cards[4].value) {
      return { type: 'triple_with_pair', value: cards[0].value, length: 5 };
    }
    // Case 2: AA BBB (sorted: BBB AA because B < A? No, sorted descending)
    // If cards are sorted descending value: AAA BB (A > B) or BB AAA (B > A, so sorted as BB AAA? No, sorted by value)
    // sortCards sorts descending.
    // So if we have 333 44 (4>3), it would be 44 333.
    if (cards[0].value === cards[1].value && cards[2].value === cards[3].value && cards[3].value === cards[4].value) {
      return { type: 'triple_with_pair', value: cards[2].value, length: 5 };
    }
  }

  // TODO: Add Sequence, Pair Sequence, Plane logic
  // For now, support basics to get game running.

  return null;
}
