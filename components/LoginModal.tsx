
import React, { useState } from 'react';
import { authService } from '../services/auth';

interface LoginModalProps {
  onLogin: (username: string) => void;
  onCancel: () => void;
}

type AuthMode = 'LOGIN' | 'REGISTER';

export const LoginModal: React.FC<LoginModalProps> = ({ onLogin, onCancel }) => {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().toUpperCase();
    const cleanPass = password.trim();

    if (cleanUsername.length < 3) {
        setError("USERNAME TOO SHORT");
        return;
    }
    if (cleanPass.length < 3) {
        setError("PASSWORD TOO SHORT");
        return;
    }

    setLoading(true);

    let result;
    if (mode === 'LOGIN') {
        result = await authService.login(cleanUsername, cleanPass);
    } else {
        result = await authService.register(cleanUsername, cleanPass);
    }

    setLoading(false);

    if (result.success) {
        onLogin(cleanUsername);
    } else {
        setError(result.error || "UNKNOWN ERROR");
    }
  };

  const toggleMode = () => {
      setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN');
      setError(null);
      setPassword("");
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 animate-in fade-in duration-300">
      <form onSubmit={handleSubmit} className="pixel-border bg-gray-900 p-8 flex flex-col gap-4 w-96 relative">
        <button 
            type="button" 
            onClick={onCancel} 
            className="absolute top-2 right-4 text-gray-500 hover:text-white font-bold"
        >
            X
        </button>

        <h2 className="text-xl text-yellow-400 font-bold text-center mb-1">
            {mode === 'LOGIN' ? 'IDENTIFICATION' : 'NEW FIGHTER'}
        </h2>
        
        <div className="text-[10px] text-gray-500 text-center mb-4">
            {mode === 'LOGIN' ? 'ENTER CREDENTIALS' : 'CREATE YOUR PROFILE'}
        </div>

        {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 text-xs p-2 text-center animate-pulse">
                ! {error} !
            </div>
        )}

        <div className="flex flex-col gap-1">
            <label className="text-[10px] text-blue-300 font-bold">USERNAME</label>
            <input 
              type="text" 
              maxLength={12}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-black border-2 border-gray-600 p-3 text-white font-mono text-center focus:border-blue-500 outline-none uppercase"
              autoFocus
              disabled={loading}
            />
        </div>

        <div className="flex flex-col gap-1">
            <label className="text-[10px] text-blue-300 font-bold">PASSWORD</label>
            <input 
              type="password" 
              maxLength={20}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-black border-2 border-gray-600 p-3 text-white font-mono text-center focus:border-blue-500 outline-none"
              disabled={loading}
            />
        </div>

        <button 
            type="submit" 
            disabled={loading}
            className={`p-4 pixel-border mt-2 font-bold tracking-widest transition-all ${loading ? 'bg-gray-700 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
        >
            {loading ? 'PROCESSING...' : (mode === 'LOGIN' ? 'LOGIN' : 'REGISTER')}
        </button>

        <div className="flex justify-center mt-2">
            <button 
                type="button" 
                onClick={toggleMode} 
                className="text-xs text-gray-500 hover:text-yellow-400 underline decoration-dotted underline-offset-4"
            >
                {mode === 'LOGIN' ? 'NO ACCOUNT? REGISTER' : 'HAS ACCOUNT? LOGIN'}
            </button>
        </div>
      </form>
    </div>
  );
};
