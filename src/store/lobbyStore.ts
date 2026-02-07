import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Room } from '../types';

interface LobbyState {
  rooms: Room[];
  loading: boolean;
  error: string | null;
  fetchRooms: () => Promise<void>;
  subscribeToRooms: () => void;
  unsubscribeFromRooms: () => void;
}

export const useLobbyStore = create<LobbyState>((set, get) => ({
  rooms: [],
  loading: false,
  error: null,
  fetchRooms: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('status', 'waiting')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ rooms: data as Room[] });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },
  subscribeToRooms: () => {
    const subscription = supabase
      .channel('public:rooms')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: 'status=eq.waiting' },
        (payload) => {
          const currentRooms = get().rooms;
          if (payload.eventType === 'INSERT') {
            set({ rooms: [payload.new as Room, ...currentRooms] });
          } else if (payload.eventType === 'DELETE') {
            set({ rooms: currentRooms.filter((room) => room.id !== payload.old.id) });
          } else if (payload.eventType === 'UPDATE') {
            set({
              rooms: currentRooms.map((room) =>
                room.id === payload.new.id ? (payload.new as Room) : room
              ),
            });
          }
        }
      )
      .subscribe();
      
    // Store subscription cleanup if needed, but for now simple subscribe is fine.
    // Ideally we return the unsubscribe function or store the channel.
  },
  unsubscribeFromRooms: () => {
    supabase.removeAllChannels();
  }
}));
