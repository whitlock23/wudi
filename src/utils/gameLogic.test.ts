import { describe, it, expect } from 'vitest';
import { Card, Suit, Rank } from '../types';
import { getPattern, isValidMove, PatternType, sortCards } from './gameLogic';

// Helper to create cards
function c(rank: Rank, suit: Suit = 'hearts'): Card {
  const values: Record<Rank, number> = {
    '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15
  };
  return { rank, suit, value: values[rank], id: `${rank}-${suit}` };
}

describe('Game Logic', () => {
  describe('getPattern', () => {
    it('should identify Single', () => {
      const cards = [c('3')];
      expect(getPattern(cards)?.type).toBe('single');
    });

    it('should identify Pair', () => {
      const cards = [c('3'), c('3', 'diamonds')];
      expect(getPattern(cards)?.type).toBe('pair');
    });

    it('should identify Triple', () => {
      const cards = [c('3'), c('3', 'diamonds'), c('3', 'clubs')];
      expect(getPattern(cards)?.type).toBe('triple');
    });

    it('should identify Bomb', () => {
      const cards = [c('3'), c('3', 'diamonds'), c('3', 'clubs'), c('3', 'spades')];
      expect(getPattern(cards)?.type).toBe('bomb');
    });

    it('should identify Invincible Bomb', () => {
      const cards = [c('2', 'hearts'), c('2', 'diamonds')];
      expect(getPattern(cards)?.type).toBe('invincible_bomb');
    });

    it('should NOT identify Invincible Bomb for other 2s', () => {
      const cards = [c('2', 'spades'), c('2', 'clubs')];
      expect(getPattern(cards)?.type).toBe('pair');
    });

    it('should identify Triple with Two (Full House)', () => {
      const cards = [
        c('3'), c('3', 'diamonds'), c('3', 'clubs'),
        c('4'), c('4', 'diamonds')
      ];
      expect(getPattern(cards)?.type).toBe('triple_with_two');
    });

    it('should identify Triple with Two (Singles)', () => {
      const cards = [
        c('3'), c('3', 'diamonds'), c('3', 'clubs'),
        c('4'), c('5')
      ];
      expect(getPattern(cards)?.type).toBe('triple_with_two');
    });

    it('should identify Triple with One', () => {
      const cards = [
        c('3'), c('3', 'diamonds'), c('3', 'clubs'),
        c('4')
      ];
      expect(getPattern(cards)?.type).toBe('triple_with_one');
    });

    it('should identify Sequence (Straight)', () => {
      const cards = [c('3'), c('4'), c('5'), c('6'), c('7')];
      expect(getPattern(cards)?.type).toBe('sequence');
    });

    it('should NOT identify Sequence with 2', () => {
      const cards = [c('J'), c('Q'), c('K'), c('A'), c('2')];
      expect(getPattern(cards)).toBeNull();
    });

    it('should identify Pair Sequence', () => {
      const cards = [
        c('3'), c('3', 'diamonds'),
        c('4'), c('4', 'diamonds'),
        c('5'), c('5', 'diamonds')
      ];
      expect(getPattern(cards)?.type).toBe('pair_sequence');
    });

    it('should identify Plane', () => {
      const cards = [
        c('3'), c('3', 'diamonds'), c('3', 'clubs'),
        c('4'), c('4', 'diamonds'), c('4', 'clubs')
      ];
      expect(getPattern(cards)?.type).toBe('plane');
    });

    it('should identify Plane with Wings', () => {
      const cards = [
        c('3'), c('3', 'diamonds'), c('3', 'clubs'),
        c('4'), c('4', 'diamonds'), c('4', 'clubs'),
        c('5'), c('6'), c('7'), c('8') // 4 wings
      ];
      expect(getPattern(cards)?.type).toBe('plane_with_wings');
    });
  });

  describe('isValidMove', () => {
    it('Invincible Bomb should beat Bomb', () => {
      const bomb = [c('A'), c('A', 'diamonds'), c('A', 'clubs'), c('A', 'spades')];
      const inv = [c('2', 'hearts'), c('2', 'diamonds')];
      
      const lastMove = { 
        id: '1', game_id: '1', player_id: '1', 
        cards_played: bomb, move_type: 'play' as const, played_at: '' 
      };
      
      expect(isValidMove(inv, lastMove)).toBe(true);
    });

    it('Bomb should beat Triple', () => {
      const triple = [c('3'), c('3', 'diamonds'), c('3', 'clubs')];
      const bomb = [c('5'), c('5', 'diamonds'), c('5', 'clubs'), c('5', 'spades')];
      
      const lastMove = { 
        id: '1', game_id: '1', player_id: '1', 
        cards_played: triple, move_type: 'play' as const, played_at: '' 
      };
      
      expect(isValidMove(bomb, lastMove)).toBe(true);
    });

    it('Triple with Two (5 cards) should beat Triple with One (4 cards) if value higher', () => {
      const t3_1 = [c('3'), c('3', 'diamonds'), c('3', 'clubs'), c('4')]; // 3s + 4
      const t4_2 = [c('4'), c('4', 'diamonds'), c('4', 'clubs'), c('5'), c('6')]; // 4s + 5,6
      
      const lastMove = { 
        id: '1', game_id: '1', player_id: '1', 
        cards_played: t3_1, move_type: 'play' as const, played_at: '' 
      };
      
      // I play t4_2. I don't need to be restricted by hand count for t4_2 (it's normal triple with two).
      expect(isValidMove(t4_2, lastMove)).toBe(true);
    });

    it('Triple with One (4 cards) should beat Triple with Two (5 cards) if value higher AND hand count is 4', () => {
      const t3_2 = [c('3'), c('3', 'diamonds'), c('3', 'clubs'), c('4'), c('5')]; // 3s + 4,5
      const t4_1 = [c('4'), c('4', 'diamonds'), c('4', 'clubs'), c('5')]; // 4s + 5
      
      const lastMove = { 
        id: '1', game_id: '1', player_id: '1', 
        cards_played: t3_2, move_type: 'play' as const, played_at: '' 
      };
      
      // Valid if hand count is 4
      expect(isValidMove(t4_1, lastMove, 4)).toBe(true);
      
      // Invalid if hand count is not 4
      expect(isValidMove(t4_1, lastMove, 5)).toBe(false);
    });
  });
});
