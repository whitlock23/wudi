import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LogIn, UserPlus, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login, register } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result;
      if (isLogin) {
        result = await login(username, password);
      } else {
        result = await register(username, password);
      }

      if (result.error) {
        setError(result.error);
      } else {
        navigate('/lobby');
      }
    } catch (err: any) {
      setError('发生未知错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">无敌扑克</h1>
            <p className="text-slate-600">
              {isLogin ? '欢迎回来，请登录' : '创建新账号开始游戏'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-start gap-2 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                用户名
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="请输入用户名"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                密码
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="请输入密码"
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={clsx(
                "w-full py-3 px-4 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-colors",
                loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
                  {isLogin ? '登录' : '注册'}
                </>
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {isLogin ? '没有账号？立即注册' : '已有账号？直接登录'}
            </button>
          </div>

          <div className="mt-4 text-center space-y-2">
            <button
              onClick={() => navigate('/test-game')}
              className="block w-full text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Dev: 单机 UI 测试
            </button>
            <button
              onClick={async () => {
                  setLoading(true);
                  try {
                      // Call custom reset RPC if using Mock
                      // We need to access supabase client directly or via store if exposed
                      // Store doesn't expose raw RPC for reset. 
                      // Let's import supabase from lib
                      const { supabase } = await import('../lib/supabase');
                      const { error } = await supabase.rpc('reset_test_users');
                      if (error) {
                          // Fallback to old loop method if RPC not found (e.g. real Supabase)
                          console.warn('reset_test_users RPC failed, falling back to register loop', error);
                          const users = ['User1', 'User2', 'User3', 'User4'];
                          for (const u of users) {
                              await register(u, '123456');
                          }
                          alert('尝试创建账号完成。如果提示用户名已存在，请直接登录。');
                      } else {
                          alert('已重置测试账号: User1, User2, User3, User4 (密码均为 123456)');
                      }
                  } catch (e) {
                      console.error(e);
                      alert('操作失败');
                  } finally {
                      setLoading(false);
                  }
              }}
              className="block w-full text-xs text-blue-500 hover:text-blue-700 underline"
            >
              Dev: 重置/创建 4个测试账号 (Mock Only)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
