import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LogOut, User as UserIcon } from 'lucide-react';

export const Layout: React.FC = () => {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-blue-600 flex items-center gap-2">
            ♠️ <span className="hidden sm:inline">无敌扑克</span>
          </Link>
          
          {user ? (
            <div className="flex items-center gap-4">
              <Link to="/profile" className="flex items-center gap-2 text-sm font-medium hover:text-blue-600">
                <UserIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{user.username}</span>
              </Link>
              <button 
                onClick={handleSignOut}
                className="p-2 text-slate-500 hover:text-red-600 transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link to="/" className="text-sm font-medium text-blue-600 hover:underline">
              登录 / 注册
            </Link>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};
