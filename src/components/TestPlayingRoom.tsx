
import React, { useState } from 'react';
import { useTestGameStore } from '../store/testGameStore';
import { useThemeStore, themes } from '../store/themeStore';
import { ThemeSelector } from './ThemeSelector';
import { Card, Suit, GameMove } from '../types';
import { isValidMove, sortCards } from '../utils/gameLogic';
import clsx from 'clsx';

// Icons for suits
const SuitIcon = ({ suit, small }: { suit: Suit, small?: boolean }) => {
  const color = ['hearts', 'diamonds'].includes(suit) ? 'text-red-500' : 'text-slate-800';
  const symbol = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  }[suit];
  // Adjust size for small mode
  const size = small ? "text-base sm:text-xl" : "text-base sm:text-xl md:text-2xl";
  return <span className={clsx(size, "font-bold", color)}>{symbol}</span>;
};

const CardView = ({ card, selected, onClick, small }: { card: Card; selected: boolean; onClick?: () => void, small?: boolean }) => {
  const color = ['hearts', 'diamonds'].includes(card.suit) ? 'text-red-500' : 'text-slate-800';
  
  const w = small ? "w-8 sm:w-10" : "w-14 sm:w-20 md:w-24";
  const h = small ? "h-11 sm:h-14" : "h-20 sm:h-28 md:h-36";
  const text = small ? "text-xs sm:text-sm font-bold" : "text-[10px] sm:text-xs md:text-base";
  
  if (small) {
      return (
        <div
          onClick={onClick}
          className={clsx(
            `relative ${w} ${h} bg-white rounded border shadow-sm flex flex-col items-center justify-start pt-1 select-none cursor-default flex-shrink-0`,
            "border-slate-300"
          )}
          style={{ marginLeft: '-12px' }} 
        >
            {/* Number at the top */}
            <span className={clsx(text, color, "leading-none mt-0.5 sm:mt-1")}>{card.rank}</span>
            {/* Suit below */}
            <div className="mt-0 sm:mt-0.5">
                <SuitIcon suit={card.suit} small />
            </div>
        </div>
      );
  }

  return (
    <div
      onClick={onClick}
      className={clsx(
        `relative ${w} ${h} bg-white rounded-lg border shadow-md flex flex-col items-center justify-between p-0.5 select-none transition-transform cursor-pointer hover:shadow-lg`,
        selected ? "-translate-y-6 border-blue-500 ring-2 ring-blue-200" : "border-slate-200",
        "flex-shrink-0"
      )}
      style={{ marginLeft: small ? '-12px' : '-30px' }} 
    >
      <div className={`self-start ${text} font-bold flex flex-col items-center leading-none`}>
        <span className={color}>{card.rank}</span>
        <SuitIcon suit={card.suit} />
      </div>
      {!small && (
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
            <SuitIcon suit={card.suit} />
        </div>
      )}
      <div className={`self-end rotate-180 ${text} font-bold flex flex-col items-center leading-none`}>
        <span className={color}>{card.rank}</span>
        <SuitIcon suit={card.suit} />
      </div>
    </div>
  );
};

// Component to display cards on the table
const TableCards = ({ move }: { move: GameMove | null }) => {
    if (!move) return null;
    if (move.move_type === 'pass') {
        return <div className="bg-black/40 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold">不出</div>;
    }
    return (
        <div className="flex items-center justify-center">
            {sortCards(move.cards_played).map(card => (
                <CardView key={card.id} card={card} selected={false} small />
            ))}
        </div>
    );
};

// Scoreboard Component
const Scoreboard = ({ scores, players, onClose }: { scores: Record<string, { lastGame: number, total: number }>, players: any[], onClose: () => void }) => {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-blue-600 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Scoreboard</h2>
                    <button onClick={onClose} className="text-white hover:bg-blue-700 p-1 rounded">✕</button>
                </div>
                <div className="p-6">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-slate-500 border-b">
                                <th className="pb-2">Player</th>
                                <th className="pb-2 text-right">Last Game</th>
                                <th className="pb-2 text-right">Total Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {players.map(p => (
                                <tr key={p.user_id} className="border-b last:border-0">
                                    <td className="py-3 font-medium">{p.user?.username}</td>
                                    <td className="py-3 text-right font-mono">
                                        {scores[p.user_id]?.lastGame > 0 ? '+' : ''}{scores[p.user_id]?.lastGame}
                                    </td>
                                    <td className="py-3 text-right font-mono font-bold">
                                        {scores[p.user_id]?.total}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export const TestPlayingRoom: React.FC = () => {
  const { myHand, playCards, passTurn, currentPlayerId, gamePlayers, currentWinningMove, tableMoves, scores } = useTestGameStore();
  const currentThemeId = useThemeStore(state => state.currentTheme);
  const theme = themes[currentThemeId];
  
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [showScoreboard, setShowScoreboard] = useState(false);

  const toggleSelect = (cardId: string) => {
    setSelectedCardIds(prev => 
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };
  
  // ... existing code ...

  const isMyTurn = currentPlayerId === 'human-player';
  
  // Find bot players
  const rightBot = gamePlayers.find(p => p.seat_position === 1);
  const topBot = gamePlayers.find(p => p.seat_position === 2);
  const leftBot = gamePlayers.find(p => p.seat_position === 3);
  
  // Get visible table moves
  const myMove = tableMoves['human-player'];
  const leftMove = leftBot ? tableMoves[leftBot.user_id] : null;
  const topMove = topBot ? tableMoves[topBot.user_id] : null;
  const rightMove = rightBot ? tableMoves[rightBot.user_id] : null;

  const targetMove = currentWinningMove?.player_id === currentPlayerId ? undefined : currentWinningMove;
  const canPlay = isMyTurn && selectedCardIds.length > 0 && isValidMove(selectedCardIds.map(id => myHand.find(c => c.id === id)!), targetMove);

  const handlePass = () => {
    passTurn();
    setSelectedCardIds([]);
  };

  const handlePlay = () => {
    const cardsToPlay = selectedCardIds.map(id => myHand.find(c => c.id === id)!);
    playCards(cardsToPlay);
    setSelectedCardIds([]);
  };

  return (
    <div className={clsx("flex flex-col h-full relative overflow-hidden transition-colors duration-500", theme.backgroundClass)}>
      
      {showScoreboard && (
          <Scoreboard scores={scores} players={gamePlayers} onClose={() => setShowScoreboard(false)} />
      )}
      
      {/* Top Left Controls */}
      <div className="absolute top-4 left-4 z-30 flex gap-2">
        <button 
            className="bg-black/40 text-white/80 hover:text-white px-3 py-1 rounded-full hover:bg-black/60 text-sm flex items-center gap-2 transition-all"
            onClick={() => setShowScoreboard(true)}
        >
            <span>📊</span> Scoreboard
        </button>
        <ThemeSelector />
      </div>

      {/* --- Top Player (Bot 2) --- */}
      <div className="absolute top-2 sm:top-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
         <div className={clsx("bg-black/40 p-1.5 sm:p-2 rounded text-white text-center w-24 sm:w-32 relative", currentPlayerId === topBot?.user_id && "ring-2 ring-yellow-400")}>
            <div className="font-bold text-xs sm:text-base truncate px-1">{topBot?.user?.username}</div>
            
            {/* Hand Count Badge */}
            <div className="flex items-center justify-center gap-1 mt-0.5 sm:mt-1 bg-black/30 rounded px-2 py-0.5">
                <div className="w-2.5 h-3.5 sm:w-3 sm:h-4 bg-white border border-slate-300 rounded-sm"></div>
                <span className="text-xs sm:text-sm font-bold text-yellow-300">{topBot?.cards_count}</span>
            </div>
         </div>
         <div className="mt-1 sm:mt-2 min-h-[40px] sm:min-h-[60px]">
             <TableCards move={topMove} />
         </div>
      </div>

      {/* --- Left Player (Bot 1) --- */}
      <div className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 flex flex-col sm:flex-row items-center gap-2 sm:gap-4 z-10">
         <div className={clsx("bg-black/40 p-1.5 sm:p-2 rounded text-white text-center w-20 sm:w-24 relative order-2 sm:order-1", currentPlayerId === leftBot?.user_id && "ring-2 ring-yellow-400")}>
            <div className="font-bold text-xs sm:text-base truncate px-1">{leftBot?.user?.username}</div>
            
            {/* Hand Count Badge */}
            <div className="flex items-center justify-center gap-1 mt-1 bg-black/30 rounded px-2 py-0.5">
                <div className="w-2.5 h-3.5 sm:w-3 sm:h-4 bg-white border border-slate-300 rounded-sm"></div>
                <span className="text-xs sm:text-sm font-bold text-yellow-300">{leftBot?.cards_count}</span>
            </div>
         </div>
         <div className="min-w-[80px] sm:min-w-[100px] min-h-[40px] sm:min-h-[60px] flex items-center justify-center sm:justify-start order-1 sm:order-2">
             <TableCards move={leftMove} />
         </div>
      </div>

      {/* --- Right Player (Bot 3) --- */}
      <div className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 flex flex-col sm:flex-row-reverse items-center gap-2 sm:gap-4 z-10">
         <div className={clsx("bg-black/40 p-1.5 sm:p-2 rounded text-white text-center w-20 sm:w-24 relative order-2 sm:order-1", currentPlayerId === rightBot?.user_id && "ring-2 ring-yellow-400")}>
            <div className="font-bold text-xs sm:text-base truncate px-1">{rightBot?.user?.username}</div>
            
             {/* Hand Count Badge */}
            <div className="flex items-center justify-center gap-1 mt-1 bg-black/30 rounded px-2 py-0.5">
                <div className="w-2.5 h-3.5 sm:w-3 sm:h-4 bg-white border border-slate-300 rounded-sm"></div>
                <span className="text-xs sm:text-sm font-bold text-yellow-300">{rightBot?.cards_count}</span>
            </div>
         </div>
         <div className="min-w-[80px] sm:min-w-[100px] min-h-[40px] sm:min-h-[60px] flex items-center justify-center sm:justify-end order-1 sm:order-2">
             <TableCards move={rightMove} />
         </div>
      </div>

      {/* --- Center Info --- */}
      <div className="flex-1 flex flex-col items-center justify-center pointer-events-none mt-2 sm:mt-8 md:mt-12 relative">
        <div className={clsx("font-bold text-lg sm:text-xl animate-pulse mb-4 sm:mb-8", theme.textColorClass)}>
            {isMyTurn ? "Your Turn" : `Waiting for ${gamePlayers.find(p=>p.user_id===currentPlayerId)?.user?.username || '...'}...`}
        </div>
        
        {/* My Table Cards (Just above controls) */}
        <div className="mb-2 sm:mb-4 min-h-[40px] sm:min-h-[60px]">
            <TableCards move={myMove} />
        </div>
      </div>

      {/* --- Controls --- */}
      <div className="h-12 sm:h-16 flex items-center justify-center gap-4 px-4 z-10 mb-2">
        <button
          onClick={handlePass}
          disabled={!isMyTurn} 
          className={clsx(
              "px-6 py-1.5 sm:py-2 rounded-full font-bold text-sm sm:text-base shadow-lg active:scale-95 transition-all text-white",
              !isMyTurn ? "bg-slate-600 opacity-50 cursor-not-allowed" : "bg-slate-600 hover:bg-slate-700"
          )}
        >
          不出
        </button>
        <button
          onClick={handlePlay}
          disabled={!canPlay || !isMyTurn}
          className={clsx(
            "px-8 py-1.5 sm:py-2 rounded-full font-bold text-sm sm:text-base shadow-lg active:scale-95 transition-all",
            (canPlay && isMyTurn)
              ? theme.accentColorClass 
              : "bg-slate-400 text-slate-200 cursor-not-allowed"
          )}
        >
          出牌
        </button>
      </div>

      {/* --- My Hand --- */}
      <div className={clsx(
          "h-28 sm:h-40 md:h-48 w-full flex items-center justify-center px-4 sm:px-10 overflow-x-auto transition-colors",
          "bg-black/20 backdrop-blur-sm", // More neutral background
          isMyTurn ? "ring-t-4 ring-yellow-400" : ""
      )}>
        <div className="flex items-center pl-8 pr-4 py-2 sm:py-4 min-w-min">
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
