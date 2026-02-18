
import React, { useState } from 'react';
import { useTestGameStore } from '../store/testGameStore';
import { useThemeStore, themes } from '../store/themeStore';
import { ThemeSelector } from './ThemeSelector';
import { Card, Suit, GameMove } from '../types';
import { isValidMove, sortCards } from '../utils/gameLogic';
import clsx from 'clsx';
import { playSound } from '../utils/audio';

// Icons for suits
const SuitIcon = ({ suit, small }: { suit: Suit, small?: boolean }) => {
  const color = ['hearts', 'diamonds'].includes(suit) ? 'text-red-500' : 'text-slate-800';
  const symbol = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  }[suit];
  // Revert size to be legible but small
  const size = small ? "text-xs sm:text-sm" : "text-sm sm:text-base md:text-xl";
  return <span className={clsx(size, "font-bold", color)}>{symbol}</span>;
};

const CardView = ({ card, selected, onClick, small }: { card: Card; selected: boolean; onClick?: () => void, small?: boolean }) => {
  const color = ['hearts', 'diamonds'].includes(card.suit) ? 'text-red-500' : 'text-slate-800';
  
  // Revert to original aspect ratio but 1/2 size of original
  // Original was approx w-16 h-24. Half size is w-8 h-12.
  // Small mode (for other players) even smaller.
  const w = small ? "w-6 sm:w-8" : "w-8 sm:w-10 md:w-12";
  const h = small ? "h-8 sm:h-11" : "h-11 sm:h-14 md:h-16";
  const text = small ? "text-[8px] sm:text-[10px] font-bold" : "text-[10px] sm:text-xs md:text-sm";
  
  if (small) {
      return (
        <div
          onClick={onClick}
          className={clsx(
            `relative ${w} ${h} bg-white rounded border shadow-sm flex flex-col items-center justify-start select-none cursor-default flex-shrink-0`,
            "border-slate-300"
          )}
          style={{ marginLeft: '-10px' }} 
        >
            {/* Number at the top */}
            <span className={clsx(text, color, "leading-none mt-0.5")}>{card.rank}</span>
            {/* Suit below */}
            <div className="mt-0">
                <SuitIcon suit={card.suit} small />
            </div>
        </div>
      );
  }

  return (
    <div
      onClick={onClick}
      className={clsx(
        `relative ${w} ${h} bg-white rounded-md border shadow-md flex flex-col items-start justify-start p-0.5 select-none transition-transform cursor-pointer hover:shadow-lg`,
        selected ? "-translate-y-2 sm:-translate-y-3 border-blue-500 ring-1 ring-blue-200" : "border-slate-200",
        "flex-shrink-0"
      )}
      style={{ marginLeft: '-16px sm:-20px md:-24px' }} 
    >
      <div className={`self-start ${text} font-bold flex flex-col items-center leading-none pl-0.5 pt-0.5`}>
        <span className={color}>{card.rank}</span>
        <SuitIcon suit={card.suit} />
      </div>
      {/* Center Suit - Visible only on slightly larger cards */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <SuitIcon suit={card.suit} />
      </div>
    </div>
  );
};

// Component to display cards on the table
const TableCards = ({ move }: { move: GameMove | null }) => {
    if (!move) return null;
    if (move.move_type === 'pass') {
    return <div className="bg-black/40 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold animate-in fade-in zoom-in duration-300">不出</div>;
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
  const { myHand, playCards, passTurn, currentPlayerId, gamePlayers, currentWinningMove, tableMoves, scores, game, lastMove } = useTestGameStore();
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
  const isFirstMoveOfGame = !lastMove;
  const canPlay = isMyTurn && selectedCardIds.length > 0 && isValidMove(selectedCardIds.map(id => myHand.find(c => c.id === id)!), targetMove, myHand.length, isFirstMoveOfGame);

  const handlePass = () => {
    playSound('pass');
    passTurn();
    setSelectedCardIds([]);
  };

  const handlePlay = () => {
    playSound('play');
    const cardsToPlay = selectedCardIds.map(id => myHand.find(c => c.id === id)!);
    playCards(cardsToPlay);
    setSelectedCardIds([]);
  };

  return (
    <div className={clsx("fixed inset-0 z-[100] flex flex-col overflow-hidden transition-colors duration-500", theme.backgroundClass)}>
      
      {showScoreboard && (
          <Scoreboard scores={scores} players={gamePlayers} onClose={() => setShowScoreboard(false)} />
      )}
      
      {/* Top Left Controls */}
      <div className="absolute top-4 left-4 z-30 flex gap-2">
         {/* Score Info moved to Top Left */}
         <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white/90 text-xs font-medium flex gap-3 shadow-lg">
            <div className="flex items-center gap-1">
                <span className="text-yellow-400">底:</span>
                <span>{game?.game_state.base_score || 1}</span>
            </div>
            <div className="w-px h-3 bg-white/20"></div>
            <div className="flex items-center gap-1">
                <span className="text-yellow-400">倍:</span>
                <span className="text-sm font-bold">x{game?.game_state.multiplier || 1}</span>
            </div>
        </div>
        <button 
            className="bg-black/40 text-white/80 hover:text-white px-2 py-1 rounded-full hover:bg-black/60 text-xs flex items-center gap-1 transition-all"
            onClick={() => setShowScoreboard(true)}
        >
            <span>📊</span> Score
        </button>
        <ThemeSelector />
      </div>

      {/* --- Top Player (Bot 2) --- */}
      <div className="absolute top-2 sm:top-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
         {/* Avatar & Info moved UP and SMALLER */}
         <div className={clsx("bg-black/40 p-1 rounded text-white text-center w-20 sm:w-24 relative mb-1", currentPlayerId === topBot?.user_id && "ring-2 ring-yellow-400")}>
            <div className="font-bold text-[10px] sm:text-xs truncate px-1">{topBot?.user?.username}</div>
            
            {/* Hand Count Badge */}
            <div className="flex items-center justify-center gap-1 mt-0.5 bg-black/30 rounded px-1.5 py-0.5">
                <div className="w-2 h-3 bg-white border border-slate-300 rounded-[1px]"></div>
                <span className="text-[10px] sm:text-xs font-bold text-yellow-300">{topBot?.cards_count}</span>
            </div>
         </div>
         {/* Table Cards moved down slightly to clear the avatar */}
         <div className="mt-0 min-h-[40px] sm:min-h-[60px]">
             <TableCards move={topMove} />
         </div>
      </div>

      {/* --- Left Player (Bot 1) --- */}
      <div className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10">
         <div className={clsx("bg-black/40 p-1 rounded text-white text-center w-20 sm:w-24 relative", currentPlayerId === leftBot?.user_id && "ring-2 ring-yellow-400")}>
            <div className="font-bold text-[10px] sm:text-xs truncate px-1">{leftBot?.user?.username}</div>
            
            {/* Hand Count Badge */}
            <div className="flex items-center justify-center gap-1 mt-0.5 bg-black/30 rounded px-1.5 py-0.5">
                <div className="w-2 h-3 bg-white border border-slate-300 rounded-[1px]"></div>
                <span className="text-[10px] sm:text-xs font-bold text-yellow-300">{leftBot?.cards_count}</span>
            </div>
         </div>
         <div className="min-w-[80px] sm:min-w-[100px] min-h-[40px] sm:min-h-[60px] flex items-center justify-center">
             <TableCards move={leftMove} />
         </div>
      </div>

      {/* --- Right Player (Bot 3) --- */}
      <div className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10">
         <div className={clsx("bg-black/40 p-1 rounded text-white text-center w-20 sm:w-24 relative", currentPlayerId === rightBot?.user_id && "ring-2 ring-yellow-400")}>
            <div className="font-bold text-[10px] sm:text-xs truncate px-1">{rightBot?.user?.username}</div>
            
             {/* Hand Count Badge */}
            <div className="flex items-center justify-center gap-1 mt-0.5 bg-black/30 rounded px-1.5 py-0.5">
                <div className="w-2 h-3 bg-white border border-slate-300 rounded-[1px]"></div>
                <span className="text-[10px] sm:text-xs font-bold text-yellow-300">{rightBot?.cards_count}</span>
            </div>
         </div>
         <div className="min-w-[80px] sm:min-w-[100px] min-h-[40px] sm:min-h-[60px] flex items-center justify-center">
             <TableCards move={rightMove} />
         </div>
      </div>

      {/* --- Table Area --- */}
      <div className="absolute inset-0 flex items-center justify-center z-0">
         {/* Center Info - Only show when it's My Turn */}
         {isMyTurn && (
             <div className="text-white font-bold text-lg sm:text-xl animate-pulse mb-4 sm:mb-8">
                Your Turn
             </div>
         )}
         
         {/* My Played Cards (Center) */}
         <div className="mb-0 sm:mb-2 min-h-[40px] sm:min-h-[60px] translate-y-8 sm:translate-y-12">
             <TableCards move={myMove} />
         </div>
      </div>
      
      {/* --- Controls --- */}
      {isMyTurn && (
        <div className="h-12 sm:h-16 flex items-center justify-center gap-4 px-4 z-10 mb-2 translate-y-4 sm:translate-y-6">
          <button
            onClick={handlePass}
            className="px-6 py-1.5 sm:py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-full font-bold text-sm sm:text-base shadow-lg active:scale-95 transition-all"
          >
            不出
          </button>
          <button
            onClick={handlePlay}
            disabled={!canPlay}
            className={clsx(
              "px-8 py-1.5 sm:py-2 rounded-full font-bold text-sm sm:text-base shadow-lg active:scale-95 transition-all",
              canPlay 
                ? theme.accentColorClass 
                : "bg-slate-400 text-slate-200 cursor-not-allowed"
            )}
          >
            出牌
          </button>
        </div>
      )}

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
