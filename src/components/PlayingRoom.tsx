import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Card, Suit, Rank } from '../types';
import { isValidMove } from '../utils/gameLogic';
import clsx from 'clsx';
import { useDrag } from '@use-gesture/react';

// Icons for suits
const SuitIcon = ({ suit }: { suit: Suit }) => {
  const color = ['hearts', 'diamonds'].includes(suit) ? 'text-red-500' : 'text-slate-800';
  const symbol = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  }[suit];
  return <span className={clsx("text-lg sm:text-2xl font-bold", color)}>{symbol}</span>;
};

const CardView = ({ card, selected, onClick }: { card: Card; selected: boolean; onClick: () => void }) => {
  const color = ['hearts', 'diamonds'].includes(card.suit) ? 'text-red-500' : 'text-slate-800';
  
  return (
    <div
      onClick={onClick}
      className={clsx(
        "relative w-16 h-24 sm:w-24 sm:h-36 bg-white rounded-lg border-2 shadow-md flex flex-col items-center justify-between p-1 select-none transition-transform cursor-pointer hover:shadow-lg",
        selected ? "-translate-y-4 border-blue-500 ring-2 ring-blue-200" : "border-slate-200",
        "flex-shrink-0"
      )}
      style={{ marginLeft: '-30px' }} // Overlap cards
    >
      <div className="self-start text-xs sm:text-base font-bold flex flex-col items-center leading-none">
        <span className={color}>{card.rank}</span>
        <SuitIcon suit={card.suit} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
        <SuitIcon suit={card.suit} />
      </div>
      <div className="self-end rotate-180 text-xs sm:text-base font-bold flex flex-col items-center leading-none">
        <span className={color}>{card.rank}</span>
        <SuitIcon suit={card.suit} />
      </div>
    </div>
  );
};

export const PlayingRoom: React.FC = () => {
  const { myHand, lastMove, playCards, passTurn } = useGameStore();
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

  const toggleSelect = (cardId: string) => {
    setSelectedCardIds(prev => 
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const selectedCards = myHand.filter(c => selectedCardIds.includes(c.id));
  const canPlay = isValidMove(selectedCards, lastMove || undefined);

  const handlePlay = async () => {
    if (!canPlay) return;
    await playCards(selectedCards);
    setSelectedCardIds([]);
  };

  const handlePass = async () => {
    await passTurn();
    setSelectedCardIds([]);
  };

  return (
    <div className="flex flex-col h-full bg-green-800 relative overflow-hidden">
      {/* Table Area - Simplified for now */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white/50 text-4xl font-bold select-none">
          无敌扑克桌
        </div>
        
        {/* Last Move Display */}
        {lastMove && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/20 p-4 rounded-xl flex">
              {lastMove.move_type === 'pass' ? (
                <span className="text-white font-bold text-xl">不出</span>
              ) : (
                lastMove.cards_played.map((card, i) => (
                   <div key={card.id} className="relative w-12 h-16 bg-white rounded border shadow-sm flex items-center justify-center -ml-4 first:ml-0">
                      <span className={['hearts', 'diamonds'].includes(card.suit) ? 'text-red-500' : 'text-black'}>
                        {card.rank}
                      </span>
                   </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="h-20 bg-green-900/50 flex items-center justify-center gap-4 px-4 backdrop-blur-sm z-10">
        <button
          onClick={handlePass}
          className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-full font-bold shadow-lg active:scale-95 transition-all"
        >
          不出
        </button>
        <button
          onClick={handlePlay}
          disabled={!canPlay}
          className={clsx(
            "px-8 py-2 rounded-full font-bold shadow-lg active:scale-95 transition-all",
            canPlay 
              ? "bg-amber-500 hover:bg-amber-600 text-white" 
              : "bg-slate-400 text-slate-200 cursor-not-allowed"
          )}
        >
          出牌
        </button>
      </div>

      {/* Hand Area */}
      <div className="h-40 sm:h-52 w-full bg-green-900/80 flex items-center justify-center px-4 sm:px-10 overflow-x-auto">
        <div className="flex items-center pl-8 pr-4 py-4 min-w-min">
          {myHand.map((card) => (
            <CardView 
              key={card.id} 
              card={card} 
              selected={selectedCardIds.includes(card.id)}
              onClick={() => toggleSelect(card.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
