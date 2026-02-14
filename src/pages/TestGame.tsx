
import React, { useEffect } from 'react';
import { useTestGameStore } from '../store/testGameStore';
import { TestPlayingRoom } from '../components/TestPlayingRoom';

export default function TestGame() {
  const { initTestGame, room } = useTestGameStore();

  useEffect(() => {
    initTestGame();
  }, [initTestGame]);

  if (!room) return <div>Loading Test Environment...</div>;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <TestPlayingRoom />
    </div>
  );
}
