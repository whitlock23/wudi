
import React, { useState } from 'react';
import { useTestGameStore } from '../store/testGameStore';
import { Card, Suit, GameMove } from '../types';
import { isValidMove, sortCards } from '../utils/gameLogic';
import clsx from 'clsx';

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

const CardView = ({ card, selected, onClick, small }: { card: Card; selected: boolean; onClick?: () => void, small?: boolean }) => {
  const color = ['hearts', 'diamonds'].includes(card.suit) ? 'text-red-500' : 'text-slate-800';
  
  const w = small ? "w-8" : "w-16 sm:w-24";
  const h = small ? "h-12" : "h-24 sm:h-36";
  const text = small ? "text-[8px]" : "text-xs sm:text-base";
  
  return (
    <div
      onClick={onClick}
      className={clsx(
        `relative ${w} ${h} bg-white rounded-lg border shadow-md flex flex-col items-center justify-between p-0.5 select-none transition-transform cursor-pointer hover:shadow-lg`,
        selected ? "-translate-y-4 border-blue-500 ring-2 ring-blue-200" : "border-slate-200",
        "flex-shrink-0"
      )}
      style={{ marginLeft: small ? '-20px' : '-30px' }} 
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
        return <div className="bg-black/40 text-white px-3 py-1 rounded-full text-sm font-bold">不出</div>;
    }
    return (
        <div className="flex items-center pl-4">
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
    // Cannot pass if it's a free turn (targetMove is undefined)
    if (!targetMove) return;
    passTurn();
    setSelectedCardIds([]);
  };

  const handlePlay = () => {
    const cardsToPlay = selectedCardIds.map(id => myHand.find(c => c.id === id)!);
    playCards(cardsToPlay);
    setSelectedCardIds([]);
  };

  return (
    <div className="flex flex-col h-full bg-green-800 relative overflow-hidden">
      
      {showScoreboard && (
          <Scoreboard scores={scores} players={gamePlayers} onClose={() => setShowScoreboard(false)} />
      )}
      
      {/* Top Left Controls */}
      <div className="absolute top-4 left-4 z-30 flex gap-2">
        <button 
            className="bg-black/40 text-white px-3 py-1 rounded hover:bg-black/60 text-sm flex items-center gap-2"
            onClick={() => setShowScoreboard(true)}
        >
            <span>📊</span> Scoreboard
        </button>
      </div>

      {/* --- Top Player (Bot 2) --- */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
         <div className={clsx("bg-black/40 p-2 rounded text-white text-center w-32 relative", currentPlayerId === topBot?.user_id && "ring-2 ring-yellow-400")}>
            <div className="font-bold">{topBot?.user?.username}</div>
            
            {/* Hand Count Badge */}
            <div className="flex items-center justify-center gap-1 mt-1 bg-black/30 rounded px-2 py-0.5">
                <div className="w-3 h-4 bg-white border border-slate-300 rounded-sm"></div>
                <span className="text-sm font-bold text-yellow-300">{topBot?.cards_count}</span>
            </div>
         </div>
         <div className="mt-2 min-h-[60px]">
             <TableCards move={topMove} />
         </div>
      </div>

      {/* --- Left Player (Bot 1) --- */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-row items-center gap-4">
         <div className={clsx("bg-black/40 p-2 rounded text-white text-center w-24 relative", currentPlayerId === leftBot?.user_id && "ring-2 ring-yellow-400")}>
            <div className="font-bold">{leftBot?.user?.username}</div>
            
            {/* Hand Count Badge */}
            <div className="flex items-center justify-center gap-1 mt-1 bg-black/30 rounded px-2 py-0.5">
                <div className="w-3 h-4 bg-white border border-slate-300 rounded-sm"></div>
                <span className="text-sm font-bold text-yellow-300">{leftBot?.cards_count}</span>
            </div>
         </div>
         <div className="min-w-[100px] min-h-[60px] flex items-center">
             <TableCards move={leftMove} />
         </div>
      </div>

      {/* --- Right Player (Bot 3) --- */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-row-reverse items-center gap-4">
         <div className={clsx("bg-black/40 p-2 rounded text-white text-center w-24 relative", currentPlayerId === rightBot?.user_id && "ring-2 ring-yellow-400")}>
            <div className="font-bold">{rightBot?.user?.username}</div>
            
             {/* Hand Count Badge */}
            <div className="flex items-center justify-center gap-1 mt-1 bg-black/30 rounded px-2 py-0.5">
                <div className="w-3 h-4 bg-white border border-slate-300 rounded-sm"></div>
                <span className="text-sm font-bold text-yellow-300">{rightBot?.cards_count}</span>
            </div>
         </div>
         <div className="min-w-[100px] min-h-[60px] flex justify-end items-center">
             <TableCards move={rightMove} />
         </div>
      </div>

      {/* --- Center Info --- */}
      <div className="flex-1 flex flex-col items-center justify-center pointer-events-none mt-12">
        <div className="text-yellow-300 font-bold text-xl animate-pulse mb-8">
            {isMyTurn ? "Your Turn" : `Waiting for ${gamePlayers.find(p=>p.user_id===currentPlayerId)?.user?.username || '...'}...`}
        </div>
        
        {/* My Table Cards (Just above controls) */}
        <div className="mb-4 min-h-[60px]">
            <TableCards move={myMove} />
        </div>
      </div>

      {/* --- Controls --- */}
      <div className="h-16 flex items-center justify-center gap-4 px-4 z-10 mb-2">
        <button
          onClick={handlePass}
          disabled={!isMyTurn || !targetMove} 
          className={clsx(
              "px-6 py-2 rounded-full font-bold shadow-lg active:scale-95 transition-all text-white",
              (!isMyTurn || !targetMove) ? "bg-slate-600 opacity-50 cursor-not-allowed" : "bg-slate-600 hover:bg-slate-700"
          )}
        >
          不出
        </button>
        <button
          onClick={handlePlay}
          disabled={!canPlay || !isMyTurn}
          className={clsx(
            "px-8 py-2 rounded-full font-bold shadow-lg active:scale-95 transition-all",
            (canPlay && isMyTurn)
              ? "bg-amber-500 hover:bg-amber-600 text-white" 
              : "bg-slate-400 text-slate-200 cursor-not-allowed"
          )}
        >
          出牌
        </button>
      </div>

      {/* --- My Hand --- */}
      <div className={clsx(
          "h-36 sm:h-48 w-full bg-green-900/80 flex items-center justify-center px-4 sm:px-10 overflow-x-auto transition-colors",
          isMyTurn ? "bg-green-800/90 ring-t-4 ring-yellow-400" : ""
      )}>
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
