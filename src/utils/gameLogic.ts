import { Card, Suit, Rank, GameMove } from '../types';

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

// Basic Move Validation Logic
export function isValidMove(selectedCards: Card[], lastMove?: GameMove, remainingHandCount?: number, isFirstMoveOfGame: boolean = false): boolean {
  if (selectedCards.length === 0) return false;
  
  // Rule: First move of the game MUST include Spade 3
  if (isFirstMoveOfGame) {
      const hasSpade3 = selectedCards.some(c => c.suit === 'spades' && c.rank === '3');
      if (!hasSpade3) return false;
  }
  
  // Sort selected cards for easier analysis
  const sorted = sortCards(selectedCards);
  
  // 1. Check if it's a valid pattern
  const pattern = getPattern(sorted, remainingHandCount);
  if (!pattern) return false;

  // Rule: Triple with One is only allowed if it's the last 4 cards
  if (pattern.type === 'triple_with_one') {
    if (remainingHandCount !== 4) return false;
  }

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

  // Special compatibility: Triple with One (4 cards) vs Triple with Two (5 cards)
  // Both are "Triple with Wing". 
  const isTripleWing = (t: PatternType) => t === 'triple_with_two' || t === 'triple_with_one';
  if (isTripleWing(pattern.type) && isTripleWing(lastPattern.type)) {
     return pattern.value > lastPattern.value;
  }

  return false;
}

export type PatternType = 
  | 'single' 
  | 'pair' 
  | 'triple' 
  | 'triple_with_two' // 3+2 (any 2)
  | 'triple_with_one' // 3+1 (only if last 4 cards)
  | 'bomb' 
  | 'invincible_bomb'
  | 'sequence' // 5+ single
  | 'pair_sequence' // 2+ pairs
  | 'plane' // Consecutive triples
  | 'plane_with_wings'; // Consecutive triples + wings

export interface Pattern {
  type: PatternType;
  value: number; // Primary value for comparison
  length: number;
}

export function getPattern(cards: Card[], remainingHandCount?: number): Pattern | null {
  const len = cards.length;
  if (len === 0) return null;

  // Group cards by value
  const counts: Record<number, number> = {};
  for (const c of cards) {
    counts[c.value] = (counts[c.value] || 0) + 1;
  }
  const uniqueValues = Object.keys(counts).map(Number).sort((a, b) => b - a); // Descending

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
  if (len === 2 && uniqueValues.length === 1) {
    return { type: 'pair', value: cards[0].value, length: 2 };
  }

  // Triple
  if (len === 3 && uniqueValues.length === 1) {
     return { type: 'triple', value: cards[0].value, length: 3 };
  }

  // Bomb (4 same)
  if (len === 4 && uniqueValues.length === 1) {
    return { type: 'bomb', value: cards[0].value, length: 4 };
  }

  // Triple with Two (3+2)
  if (len === 5) {
    // Must find a triple
    let tripleValue = -1;
    for (const val of uniqueValues) {
      if (counts[val] === 3) {
        tripleValue = val;
        break;
      }
    }
    // Also support 4+1? No, 4 is bomb.
    // If we have 33344 (Full House) -> Triple 3.
    // If we have 33345 (Triple + 2 singles) -> Triple 3.
    if (tripleValue !== -1) {
      return { type: 'triple_with_two', value: tripleValue, length: 5 };
    }
  }

  // Triple with One (3+1)
  // Structurally: 4 cards, 3 same + 1 different
  // Note: Validation rule (must be last 4 cards) is checked in isValidMove
  if (len === 4) {
    let tripleValue = -1;
    for (const val of uniqueValues) {
      if (counts[val] === 3) {
        tripleValue = val;
        break;
      }
    }
    if (tripleValue !== -1) {
      return { type: 'triple_with_one', value: tripleValue, length: 4 };
    }
  }

  // Sequence (Straight)
  // 5+ cards, consecutive, no 2
  if (len >= 5 && uniqueValues.length === len) {
    // Check consecutive
    // uniqueValues is sorted descending
    const max = uniqueValues[0];
    const min = uniqueValues[len - 1];
    // Check for '2' (value 15)
    if (max === 15) return null; // 2 cannot be in sequence
    
    if (max - min === len - 1) {
       return { type: 'sequence', value: min, length: len }; // Use min value for comparison usually? Or max. Let's use min (start of sequence).
    }
  }

  // Pair Sequence (Linked Pairs)
  // 2+ pairs (length >= 4, even), consecutive pairs, no 2
  if (len >= 4 && len % 2 === 0) {
    // Check counts are all 2 (or 4? 4 could be 2 pairs of same? No, deck has only 4 same max)
    // Actually, if we have 333344, is that 3 pairs? 33 33 44? 
    // Usually Pair Sequence must be distinct pairs: 33 44 55.
    const pairs: number[] = [];
    let isAllPairs = true;
    for (const val of uniqueValues) {
      if (counts[val] !== 2) {
        // What if we have 4 of a kind (3333)? Can be treated as 2 pairs of 3?
        // Usually NO. 3333 is a Bomb.
        isAllPairs = false;
        break;
      }
      pairs.push(val);
    }
    
    if (isAllPairs) {
      // Check consecutive
      const max = pairs[0];
      const min = pairs[pairs.length - 1];
      if (max === 15) return null; // No 2s
      
      if (max - min === pairs.length - 1) {
        return { type: 'pair_sequence', value: min, length: len };
      }
    }
  }

  // Plane (Consecutive Triples) & Plane with Wings
  // Find triples
  const triples: number[] = [];
  for (const val of uniqueValues) {
    if (counts[val] >= 3) {
      triples.push(val);
    }
  }
  
  if (triples.length >= 2) {
    // Sort triples descending
    triples.sort((a, b) => b - a);
    
    // Find longest consecutive sequence of triples
    // E.g. 3,4,5 triples.
    // We need to check if the cards form a valid Plane structure.
    // Case 1: Pure Plane (Just triples) -> len == triples.length * 3
    // Case 2: Plane + Wings -> len == triples.length * 5 (User: "Three with two", so Plane with 2*N)
    
    // We iterate through all possible sub-sequences of triples to see if they match the total card count.
    for (let i = 0; i < triples.length; i++) {
      let consecCount = 1;
      for (let j = i + 1; j < triples.length; j++) {
        if (triples[j-1] - triples[j] === 1 && triples[j-1] !== 15) { // Consecutive and not 2 (can 2 be in plane? Usually no)
          consecCount++;
        } else {
          break;
        }
      }
      
      if (consecCount >= 2) {
        // We found a sequence of 'consecCount' triples.
        // Check if the total cards match the requirements.
        const planeSize = consecCount * 3;
        
        // Pure Plane
        if (len === planeSize) {
           return { type: 'plane', value: triples[i + consecCount - 1], length: len }; // Value is the smallest triple
        }
        
        // Plane with Wings (2 cards per triple)
        if (len === planeSize + consecCount * 2) {
           return { type: 'plane_with_wings', value: triples[i + consecCount - 1], length: len };
        }
      }
    }
  }

  return null;
}

export function findValidMove(hand: Card[], lastMove?: GameMove, remainingHandCount?: number, isFirstMoveOfGame: boolean = false): Card[] | null {
  const sortedHand = sortCards(hand);
  
  // 1. First move of game: MUST include Spade 3
  if (isFirstMoveOfGame) {
      const spade3 = sortedHand.find(c => c.suit === 'spades' && c.rank === '3');
      if (!spade3) return null; // Should not happen if logic is correct
      
      // Try to play as part of a larger pattern if possible?
      // For simplicity, just play the single Spade 3 or the smallest combination containing it.
      
      // Check for Pair of 3s
      const threes = sortedHand.filter(c => c.rank === '3');
      if (threes.length >= 2) {
          // Play pair if we have it? Or triple?
          // Strategy: If we have many 3s, maybe play them together.
          // Let's just play the single Spade 3 to be safe and simple for now.
          // Or play the smallest valid hand.
          // Actually, if we have 33, playing 33 is better than splitting.
          // If we have 333, playing 333 is better.
          // If we have 3333 (Bomb), maybe keep it?
          
          if (threes.length === 2) return threes;
          if (threes.length === 3) return threes;
          // If bomb, maybe save it? But for now let's just play it if it's the only way.
      }
      
      // Default: Play single Spade 3
      return [spade3];
  }

  // 2. Free turn: Play smallest single
  if (!lastMove || lastMove.move_type === 'pass') {
     if (sortedHand.length === 0) return null;
     return [sortedHand[sortedHand.length - 1]];
  }
  
  const lastCards = lastMove.cards_played;
  const lastPattern = getPattern(sortCards(lastCards));
  if (!lastPattern) return null;
  
  // Group by value
  const counts: Record<number, Card[]> = {};
  for(const c of sortedHand) {
      if(!counts[c.value]) counts[c.value] = [];
      counts[c.value].push(c);
  }
  const uniqueValues = Object.keys(counts).map(Number).sort((a,b)=>a-b); // Ascending
  
  // Try to match pattern
  if (lastPattern.type === 'single') {
      for (const c of sortedHand.reverse()) { // Smallest first
          if (c.value > lastPattern.value) return [c];
      }
  }
  
  if (lastPattern.type === 'pair') {
      for (const val of uniqueValues) {
          if (val > lastPattern.value && counts[val].length >= 2) {
              return counts[val].slice(0, 2);
          }
      }
  }
  
  if (lastPattern.type === 'triple') {
      for (const val of uniqueValues) {
          if (val > lastPattern.value && counts[val].length >= 3) {
              return counts[val].slice(0, 3);
          }
      }
  }
  
  if (lastPattern.type === 'bomb') {
      for (const val of uniqueValues) {
          if (val > lastPattern.value && counts[val].length === 4) {
              return counts[val];
          }
      }
  }
  
  // Use Bomb to beat non-bomb
  if (lastPattern.type !== 'bomb' && lastPattern.type !== 'invincible_bomb') {
      for (const val of uniqueValues) {
          if (counts[val].length === 4) {
              return counts[val];
          }
      }
  }
  
  return null;
}
