import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { useThemeStore, themes } from '../store/themeStore';
import { ThemeSelector } from './ThemeSelector';
import { Card, Suit, GameMove, GamePlayer } from '../types';
import { isValidMove, sortCards } from '../utils/gameLogic';
import { LogOut, RotateCcw, Home } from 'lucide-react';
import clsx from 'clsx';

// --- Components ---

const GameOverModal = ({ 
    players, 
    multiplier, 
    onRestart, 
    onExit 
}: { 
    players: GamePlayer[]; 
    multiplier: number;
    onRestart: () => void;
    onExit: () => void;
}) => {
    // Sort by score change descending
    const sortedPlayers = [...players].sort((a, b) => b.score_change - a.score_change);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-center">
                    <h2 className="text-3xl font-black text-white uppercase tracking-wider drop-shadow-md">
                        游戏结束
                    </h2>
                    <p className="text-white/80 font-medium mt-1">
                        最终倍率: x{multiplier}
                    </p>
                </div>
                
                <div className="p-6 space-y-4">
                    {sortedPlayers.map((p, idx) => (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={clsx(
                                    "w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm",
                                    idx === 0 ? "bg-yellow-100 text-yellow-700" : "bg-slate-200 text-slate-600"
                                )}>
                                    {idx + 1}
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800">
                                        {p.user?.username || 'Unknown'}
                                    </div>
                                    <div className="text-xs text-slate-500 flex gap-2">
                                        {p.is_invincible && <span className="text-purple-600 font-bold">无敌</span>}
                                        {/* Since we didn't store team info explicitly in game_players for 2v2 teammates, we can't show it easily here yet unless we infer it */}
                                    </div>
                                </div>
                            </div>
                            <div className={clsx(
                                "text-xl font-black",
                                p.score_change > 0 ? "text-red-500" : "text-slate-400"
                            )}>
                                {p.score_change > 0 ? '+' : ''}{p.score_change}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-6 bg-slate-50 flex gap-4">
                    <button 
                        onClick={onExit}
                        className="flex-1 py-3 px-4 rounded-xl bg-white border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
                    >
                        <Home size={18} />
                        返回大厅
                    </button>
                    {/* Restart logic is not fully implemented in store yet (need to reset game state), so maybe just exit for now or implement reset */}
                    {/* For now, just "Back to Lobby" is safest */}
                </div>
            </div>
        </div>
    );
};

// Icons for suits
const SuitIcon = ({ suit, small }: { suit: Suit, small?: boolean }) => {
  const color = ['hearts', 'diamonds'].includes(suit) ? 'text-red-500' : 'text-slate-800';
  const symbol = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  }[suit];
  // Further reduced sizes for mobile landscape
  const size = small ? "text-xs sm:text-base md:text-xl" : "text-sm sm:text-lg md:text-2xl";
  return <span className={clsx(size, "font-bold", color)}>{symbol}</span>;
};

const CardView = ({ card, selected, onClick, small }: { card: Card; selected: boolean; onClick?: () => void, small?: boolean }) => {
  const color = ['hearts', 'diamonds'].includes(card.suit) ? 'text-red-500' : 'text-slate-800';
  
  // Drastically reduced sizes for small screens (mobile landscape)
  const w = small ? "w-6 sm:w-8 md:w-10" : "w-10 sm:w-14 md:w-24";
  const h = small ? "h-9 sm:h-11 md:h-14" : "h-14 sm:h-20 md:h-36";
  const text = small ? "text-[8px] sm:text-[10px] md:text-xs font-bold" : "text-[10px] sm:text-xs md:text-base";
  
  if (small) {
      return (
        <div
          onClick={onClick}
          className={clsx(
            `relative ${w} ${h} bg-white rounded border shadow-sm flex flex-col items-center justify-start select-none cursor-default flex-shrink-0`,
            "border-slate-300"
          )}
          style={{ marginLeft: '-8px' }} 
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
        `relative ${w} ${h} bg-white rounded-lg border shadow-md flex flex-col items-center justify-between p-0.5 select-none transition-transform cursor-pointer hover:shadow-lg`,
        selected ? "-translate-y-3 sm:-translate-y-4 md:-translate-y-6 border-blue-500 ring-1 sm:ring-2 ring-blue-200" : "border-slate-200",
        "flex-shrink-0"
      )}
      style={{ marginLeft: '-20px sm:-24px md:-30px' }} 
    >
      <div className={`self-start ${text} font-bold flex flex-col items-center leading-none`}>
        <span className={color}>{card.rank}</span>
        <SuitIcon suit={card.suit} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <SuitIcon suit={card.suit} />
      </div>
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

export const PlayingRoom: React.FC = () => {
  const navigate = useNavigate();
  const { myHand, lastMove, playCards, passTurn, gamePlayers, game, tableMoves, leaveRoom, room } = useGameStore();
  const { user } = useAuthStore();
  const currentThemeId = useThemeStore(state => state.currentTheme);
  const theme = themes[currentThemeId];

  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

  const toggleSelect = (cardId: string) => {
    setSelectedCardIds(prev => 
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const handleExit = async () => {
      if (window.confirm('游戏正在进行中，确定要强制退出吗？这将影响其他玩家。')) {
         if (room) {
             try {
                 // Stop polling first
                 useGameStore.getState().stopPolling();
                 await leaveRoom(room.id);
                 navigate('/lobby', { replace: true });
             } catch (e) {
                 console.error(e);
             }
         }
      }
  };

  const selectedCards = myHand.filter(c => selectedCardIds.includes(c.id));
  
  // Need to determine current winning move to check validity
  // In multiplayer, we might need to know if it's a free turn.
  // We can infer from tableMoves or game state.
  // For now, assume lastMove is the one to beat if it wasn't me and wasn't pass?
  // But lastMove in store is just the latest record.
  
  const isFirstMoveOfGame = !lastMove && game?.game_state.multiplier === 1; // Simplistic check. Better if we know game index.
  // Actually, isValidMove logic for Spade 3 is purely based on "isFirstMoveOfGame" param.
  // We need to know if it's the first GAME of the room too.
  // The frontend store doesn't easily expose "isFirstGameOfRoom".
  // Let's assume for now the backend will catch it, and frontend just warns if it LOOKS like first game.
  // But wait, if we are in 2nd game, isFirstMoveOfGame will be true at start, and isValidMove will force Spade 3.
  // So we need to disable that check in frontend for subsequent games.
  
  // We can check if room has any finished games?
  // Store doesn't load game history list.
  // Maybe we can infer from `game.created_at` vs `room.created_at`? If they are close, it's first game? Unreliable.
  // Or just rely on backend error?
  // User experience: Button should be clickable.
  // Let's modify isValidMove to be less strict or pass false if we suspect it's not first game?
  // Correct fix: Add `game_index` or `is_first_game` to Game object.
  // For now, let's just relax the frontend check if we can't be sure.
  // But actually, we can try to guess.
  
  // Temporary: Always pass false to isFirstMoveOfGame to disable frontend Spade 3 check?
  // No, then users will try to play non-Spade 3 in first game and get backend error.
  // Better to check if we can.
  
  // Let's assume for now:
  // If we are the start player, and we have Spade 3, we *should* play it in Game 1.
  // In Game 2, if we won, we are start player, but don't need Spade 3.
  
  const canPlay = isValidMove(selectedCards, lastMove || undefined, myHand.length, false); // Disable frontend strict Spade 3 check to allow Game 2+ logic. Backend will enforce if needed.

  const handlePlay = async () => {
    if (!canPlay) return;
    await playCards(selectedCards);
    setSelectedCardIds([]);
  };

  const handlePass = async () => {
    await passTurn();
    setSelectedCardIds([]);
  };
  
  const currentPlayerId = game?.current_player_id;
  const isMyTurn = currentPlayerId === user?.id;
  
  // Calculate seats relative to me
  // My seat
  const myPlayer = gamePlayers.find(p => p.user_id === user?.id);
  const mySeat = gamePlayers.findIndex(p => p.user_id === user?.id); // Note: gamePlayers is not ordered by seat?
  // We need seat_position from room_players?
  // gamePlayers usually matches room_players order if we sorted them?
  // Let's assume gamePlayers order is not reliable for seat logic unless we join with room_players.
  // But for now let's just find "next player" logic based on ID order if we don't have seat.
  // Actually gameStore.players has seat_position.
  
  // Let's find my seat index in the `players` array (which is ordered by seat_position)
  // Wait, `useGameStore` exposes `players` (RoomPlayer[]).
  const { players } = useGameStore();
  const myRoomPlayerIndex = players.findIndex(p => p.user_id === user?.id);
  
  // Helper to get player at relative offset (1=Right, 2=Top, 3=Left)
  // Standard anti-clockwise or clockwise? Usually clockwise.
  // If I am 0. Right is 1. Top is 2. Left is 3.
  const getPlayerAtOffset = (offset: number) => {
      if (myRoomPlayerIndex === -1) return null;
      const targetIndex = (myRoomPlayerIndex + offset) % 4;
      const targetRoomPlayer = players[targetIndex];
      if (!targetRoomPlayer) return null;
      const targetGamePlayer = gamePlayers.find(gp => gp.user_id === targetRoomPlayer.user_id);
      return { ...targetRoomPlayer, ...targetGamePlayer };
  };
  
  const rightBot = getPlayerAtOffset(1);
  const topBot = getPlayerAtOffset(2);
  const leftBot = getPlayerAtOffset(3);
  
  // Get visible table moves
  const myMove = user ? tableMoves[user.id] : null;
  const rightMove = rightBot ? tableMoves[rightBot.user_id] : null;
  const topMove = topBot ? tableMoves[topBot.user_id] : null;
  const leftMove = leftBot ? tableMoves[leftBot.user_id] : null;

  return (
    <div className={clsx("fixed inset-0 z-[100] flex flex-col overflow-hidden transition-colors duration-500", theme.backgroundClass)}>
      
      {/* --- Game Over Modal --- */}
      {game?.status === 'finished' && (
          <GameOverModal 
            players={gamePlayers} 
            multiplier={game.game_state.multiplier || 1}
            onRestart={() => {}} // TODO: Implement restart
            onExit={handleExit}
          />
      )}

      {/* --- Top Info Bar --- */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/60 to-transparent z-10 flex justify-center pt-2 pointer-events-none">
          <div className="bg-black/40 backdrop-blur-md px-4 py-1 rounded-full border border-white/10 text-white/90 text-sm font-medium flex gap-4 shadow-lg">
              <div className="flex items-center gap-1">
                  <span className="text-yellow-400">底分:</span>
                  <span>{game?.game_state.base_score || 1}</span>
              </div>
              <div className="w-px h-4 bg-white/20"></div>
              <div className="flex items-center gap-1">
                  <span className="text-yellow-400">倍数:</span>
                  <span className="text-lg font-bold">x{game?.game_state.multiplier || 1}</span>
              </div>
          </div>
      </div>
      
      {/* --- Top Right Controls --- */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <ThemeSelector />
        <button
          onClick={handleExit}
          className="bg-black/40 text-white/80 hover:text-white hover:bg-red-600/80 p-2 rounded-full transition-all"
          title="退出游戏"
        >
          <LogOut size={20} />
        </button>
      </div>

      {/* --- Top Player --- */}
      <div className="absolute top-12 sm:top-14 left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
         <div className={clsx("bg-black/40 p-1.5 sm:p-2 rounded text-white text-center w-24 sm:w-32 relative", currentPlayerId === topBot?.user_id && "ring-2 ring-yellow-400")}>
            <div className="font-bold text-xs sm:text-base truncate px-1">{topBot?.user?.username || 'Player'}</div>
            {/* Hand Count Badge */}
            <div className="flex items-center justify-center gap-1 mt-0.5 sm:mt-1 bg-black/30 rounded px-2 py-0.5">
                <div className="w-2.5 h-3.5 sm:w-3 sm:h-4 bg-white border border-slate-300 rounded-sm"></div>
                <span className="text-xs sm:text-sm font-bold text-yellow-300">{topBot?.hand_cards?.length ?? '?'}</span>
            </div>
         </div>
         <div className="mt-1 sm:mt-2 min-h-[40px] sm:min-h-[60px]">
             <TableCards move={topMove} />
         </div>
      </div>

      {/* --- Left Player --- */}
      <div className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 flex flex-row items-center gap-2 sm:gap-4 z-10">
         <div className={clsx("bg-black/40 p-1.5 sm:p-2 rounded text-white text-center w-20 sm:w-24 relative", currentPlayerId === leftBot?.user_id && "ring-2 ring-yellow-400")}>
            <div className="font-bold text-xs sm:text-base truncate px-1">{leftBot?.user?.username || 'Player'}</div>
            {/* Hand Count Badge */}
            <div className="flex items-center justify-center gap-1 mt-1 bg-black/30 rounded px-2 py-0.5">
                <div className="w-2.5 h-3.5 sm:w-3 sm:h-4 bg-white border border-slate-300 rounded-sm"></div>
                <span className="text-xs sm:text-sm font-bold text-yellow-300">{leftBot?.hand_cards?.length ?? '?'}</span>
            </div>
         </div>
         <div className="min-w-[80px] sm:min-w-[100px] min-h-[40px] sm:min-h-[60px] flex items-center justify-center sm:justify-start">
             <TableCards move={leftMove} />
         </div>
      </div>

      {/* --- Right Player --- */}
      <div className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 flex flex-row-reverse items-center gap-2 sm:gap-4 z-10">
         <div className={clsx("bg-black/40 p-1.5 sm:p-2 rounded text-white text-center w-20 sm:w-24 relative", currentPlayerId === rightBot?.user_id && "ring-2 ring-yellow-400")}>
            <div className={clsx("font-bold text-xs sm:text-base truncate px-1", theme.textColorClass)}>{rightBot?.user?.username || 'Player'}</div>
             {/* Hand Count Badge */}
            <div className="flex items-center justify-center gap-1 mt-1 bg-black/30 rounded px-2 py-0.5">
                <div className="w-2.5 h-3.5 sm:w-3 sm:h-4 bg-white border border-slate-300 rounded-sm"></div>
                <span className="text-xs sm:text-sm font-bold text-yellow-300">{rightBot?.hand_cards?.length ?? '?'}</span>
            </div>
         </div>
         <div className="min-w-[80px] sm:min-w-[100px] min-h-[40px] sm:min-h-[60px] flex items-center justify-center sm:justify-end">
             <TableCards move={rightMove} />
         </div>
      </div>

      {/* --- Center Info --- */}
      <div className="flex-1 flex flex-col items-center justify-center pointer-events-none mt-2 sm:mt-8 md:mt-12 relative">
        <div className={clsx("font-bold text-lg sm:text-xl animate-pulse mb-4 sm:mb-8", theme.textColorClass)}>
            {isMyTurn ? "Your Turn" : `Waiting for ${gamePlayers.find(p=>p.user_id===currentPlayerId)?.user?.username || '...'}...`}
        </div>
        
        {/* My Table Cards (Just above controls) */}
        <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 min-h-[40px] sm:min-h-[60px]">
            <TableCards move={myMove} />
        </div>
      </div>

      {/* --- Controls --- */}
      <div className="h-12 sm:h-16 flex items-center justify-center gap-4 px-4 z-10 mb-2">
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

      {/* --- My Hand --- */}
      <div className={clsx(
          "h-28 sm:h-40 md:h-48 w-full flex items-center justify-center px-4 sm:px-10 overflow-x-auto transition-colors",
          "bg-black/20 backdrop-blur-sm",
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
