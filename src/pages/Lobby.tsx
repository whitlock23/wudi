import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLobbyStore } from '../store/lobbyStore';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { Plus, Users, Lock, Search } from 'lucide-react';
import clsx from 'clsx';

export default function Lobby() {
  const { rooms, loading, fetchRooms, subscribeToRooms, unsubscribeFromRooms } = useLobbyStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPassword, setNewRoomPassword] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [joinPassword, setJoinPassword] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    fetchRooms();
    subscribeToRooms();
    return () => {
      unsubscribeFromRooms();
    };
  }, [fetchRooms, subscribeToRooms, unsubscribeFromRooms]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreateLoading(true);

    try {
      // Generate a simple 6-char code
      const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data, error } = await supabase
        .from('rooms')
        .insert({
          name: newRoomName,
          password: newRoomPassword || null,
          join_code: joinCode,
          owner_id: user.id,
          status: 'waiting',
          current_players: 0 // Trigger will handle this or we update it after join
        })
        .select()
        .single();

      if (error) throw error;

      // Auto join
      await handleJoinRoomLogic(data.id, newRoomPassword);
      
    } catch (err: any) {
      alert('创建房间失败: ' + err.message);
      setCreateLoading(false);
    }
  };

  const handleJoinClick = (roomId: string, hasPassword: boolean) => {
    if (hasPassword) {
      setSelectedRoomId(roomId);
      setShowJoinModal(true);
    } else {
      handleJoinRoomLogic(roomId);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId) return;
    await handleJoinRoomLogic(selectedRoomId, joinPassword);
  };

  const handleJoinRoomLogic = async (roomId: string, password?: string) => {
    if (!user) return;
    setJoinLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('join_room', {
        p_room_id: roomId,
        p_user_id: user.id,
        p_password: password || null
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      navigate(`/game/${data.room_id}`);
    } catch (err: any) {
      alert('加入房间失败: ' + err.message);
    } finally {
      setJoinLoading(false);
      setShowCreateModal(false);
      setShowJoinModal(false);
      setJoinPassword('');
      setSelectedRoomId(null);
    }
  };

  return (
    <div className="pb-20">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">游戏大厅</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">创建房间</span>
          <span className="sm:hidden">创建</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
          <p className="text-slate-500 mb-4">暂无房间，快来创建一个吧！</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-blue-600 font-medium hover:underline"
          >
            创建新房间
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <div
              key={room.id}
              onClick={() => handleJoinClick(room.id, !!room.password)}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-slate-800 truncate pr-2 group-hover:text-blue-600">
                  {room.name}
                </h3>
                {room.password && <Lock size={16} className="text-amber-500 flex-shrink-0 mt-1" />}
              </div>
              
              <div className="flex items-center justify-between text-sm text-slate-500 mt-4">
                <div className="flex items-center gap-1">
                  <Users size={16} />
                  <span>{room.current_players} / 4</span>
                </div>
                <span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">
                  #{room.join_code}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold mb-4">创建房间</h2>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">房间名称</label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="例如：欢乐斗地主"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">密码 (可选)</label>
                <input
                  type="text" // Show text for easier input on mobile? Or password? Let's use text for simplicity or password for security.
                  value={newRoomPassword}
                  onChange={(e) => setNewRoomPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="留空则公开"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createLoading ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-4">输入密码</h2>
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  required
                  autoFocus
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="请输入房间密码"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowJoinModal(false);
                    setJoinPassword('');
                    setSelectedRoomId(null);
                  }}
                  className="flex-1 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={joinLoading}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {joinLoading ? '加入中...' : '加入'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
