import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { Play, Check, X, User as UserIcon } from 'lucide-react';
import clsx from 'clsx';
import { Card } from '../types';

// Components
import { PlayingRoom } from '../components/PlayingRoom';
import { WaitingRoom } from '../components/WaitingRoom';

export default function Game() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    room, 
    players, 
    loading, 
    error,
    fetchRoomData, 
    subscribeToRoom, 
    unsubscribeFromRoom 
  } = useGameStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (id) {
      fetchRoomData(id);
      subscribeToRoom(id);
    }
    return () => {
      unsubscribeFromRoom();
    };
  }, [id, fetchRoomData, subscribeToRoom, unsubscribeFromRoom]);

  if (loading && !room) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] text-red-600">
        <p>Error: {error}</p>
        <button 
          onClick={() => navigate('/lobby')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          返回大厅
        </button>
      </div>
    );
  }

  if (!room) return null;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {room.status === 'waiting' ? (
        <WaitingRoom roomId={room.id} players={players} ownerId={room.owner_id} />
      ) : (
        <PlayingRoom />
      )}
    </div>
  );
}
