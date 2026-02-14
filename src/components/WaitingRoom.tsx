import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { RoomPlayer } from '../types';
import { Check, User as UserIcon, Play, Copy, LogOut } from 'lucide-react';
import clsx from 'clsx';

interface WaitingRoomProps {
  roomId: string;
  joinCode: string;
  players: RoomPlayer[];
  ownerId: string;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ roomId, joinCode, players, ownerId }) => {
  const navigate = useNavigate();
  const { toggleReady, startGame, leaveRoom } = useGameStore();
  const { user } = useAuthStore();

  const myPlayer = players.find(p => p.user_id === user?.id);
  const isOwner = user?.id === ownerId;
  const allReady = players.length === 4 && players.every(p => p.is_ready);

  const handleCopyInvite = async () => {
    const inviteText = `来玩无敌扑克！房间号: ${joinCode}`;
    try {
      await navigator.clipboard.writeText(inviteText);
      alert(`已复制邀请信息：\n${inviteText}`);
    } catch (err) {
      // Fallback
      alert(`房间号: ${joinCode}`);
    }
  };

  const handleLeave = async () => {
      if (window.confirm('确定要离开房间吗？')) {
          try {
              // Stop polling first to avoid race conditions with navigation
              useGameStore.getState().stopPolling();
              await leaveRoom(roomId);
          } catch (error) {
              console.error('Failed to leave room:', error);
          } finally {
              navigate('/lobby', { replace: true });
          }
      }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 bg-slate-50">
      <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-2xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">等待玩家...</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-slate-500 text-sm">{players.length} / 4 玩家已加入</span>
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded font-mono">#{joinCode}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleCopyInvite}
              className="text-blue-600 flex items-center gap-1 text-sm font-medium hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Copy size={16} />
              邀请
            </button>
            <button 
              onClick={handleLeave}
              className="text-red-600 flex items-center gap-1 text-sm font-medium hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              离开
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[0, 1, 2, 3].map((seat) => {
            const player = players.find(p => p.seat_position === seat);
            
            return (
              <div 
                key={seat} 
                className={clsx(
                  "aspect-square rounded-xl flex flex-col items-center justify-center border-2 transition-all",
                  player 
                    ? "border-blue-100 bg-blue-50" 
                    : "border-dashed border-slate-200 bg-slate-50"
                )}
              >
                {player ? (
                  <>
                    <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center mb-3 relative">
                      <UserIcon size={32} className="text-blue-600" />
                      {player.is_ready && (
                        <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-1 rounded-full border-2 border-white">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <span className="font-medium text-slate-800 truncate w-full text-center px-2">
                      {(player as any).user?.username || '玩家'}
                    </span>
                    {player.user_id === ownerId && (
                      <span className="text-xs text-amber-600 font-medium mt-1">房主</span>
                    )}
                  </>
                ) : (
                  <span className="text-slate-400 text-sm">等待加入</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Debug: Show unseated players if any */}
        {players.some(p => p.seat_position < 0 || p.seat_position > 3 || players.filter(op => op.seat_position === p.seat_position).length > 1) && (
           <div className="mb-6 p-4 bg-amber-50 text-amber-800 rounded-lg text-sm">
             <p className="font-bold mb-2">⚠️ 异常状态检测</p>
             <p>检测到部分玩家座位数据异常（可能是旧房间数据导致）。建议房主解散房间重新创建。</p>
             <div className="mt-2 flex flex-wrap gap-2">
               {players.filter(p => p.seat_position < 0 || p.seat_position > 3 || players.filter(op => op.seat_position === p.seat_position).length > 1).map(p => (
                 <span key={p.user_id} className="bg-white px-2 py-1 rounded border border-amber-200">
                   {(p as any).user?.username} (Seat: {p.seat_position})
                 </span>
               ))}
             </div>
           </div>
        )}

        <div className="flex justify-center gap-4">
          {myPlayer && (
            <button
              onClick={async () => {
                  try {
                      // Prevent double clicking
                      if ((window as any)._toggling) return;
                      (window as any)._toggling = true;
                      
                      const newStatus = !myPlayer.is_ready;
                      await toggleReady(roomId, newStatus);
                  } catch (e) {
                      console.error(e);
                  } finally {
                      (window as any)._toggling = false;
                  }
              }}
              className={clsx(
                "px-8 py-3 rounded-xl font-bold text-white transition-all transform active:scale-95",
                myPlayer.is_ready 
                  ? "bg-slate-400 hover:bg-slate-500" 
                  : "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
              )}
            >
              {myPlayer.is_ready ? '取消准备' : '准备'}
            </button>
          )}

          {isOwner && (
            <button
              onClick={async () => {
                  try {
                      await startGame(roomId);
                  } catch (e) {
                      console.error(e);
                  }
              }}
              disabled={!allReady}
              className={clsx(
                "px-8 py-3 rounded-xl font-bold text-white transition-all flex items-center gap-2",
                allReady
                  ? "bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200 transform active:scale-95"
                  : "bg-slate-300 cursor-not-allowed"
              )}
            >
              <Play size={20} fill="currentColor" />
              开始游戏
            </button>
          )}
        </div>
        
        {isOwner && !allReady && (
          <p className="text-center text-slate-400 text-xs mt-4">
            所有玩家准备后方可开始
          </p>
        )}
      </div>
    </div>
  );
};
