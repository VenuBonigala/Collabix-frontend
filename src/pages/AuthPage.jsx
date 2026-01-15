import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  // 1. Auto-Redirect if already logged in
  useEffect(() => {
    // FIX: Check for 'user' instead of 'userInfo' to match HomePage
    if (localStorage.getItem('user')) {
      navigate('/home');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!username || !password) {
        toast.error("Please fill in all fields");
        return;
    }

    // Ensure this URL is your exact active Render Backend URL
    const endpoint = isLogin ? 'https://collabix-backend.onrender.com/api/auth/login' : 'https://collabix-backend.onrender.com/api/auth/register';
    const payload = isLogin ? { username, password } : { username, email, password };
    
    try {
      const { data } = await axios.post(endpoint, payload);
      
      if (data.status) {
        // FIX: Save as 'user' to match HomePage.jsx logic
        localStorage.setItem('user', JSON.stringify(data.user));
        
        toast.success(isLogin ? "Welcome back!" : "Account created!");
        navigate('/home');
      } else {
        toast.error(data.msg);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.msg || "Something went wrong. Check server connection.");
    }
  };

  return (
    <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center p-4">
      <div className="bg-[#252526] p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
        <h2 className="text-3xl font-bold text-white mb-6 text-center">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h2>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Username"
            className="p-3 rounded bg-[#1e1e1e] text-white border border-gray-600 focus:border-blue-500 outline-none"
            onChange={(e) => setUsername(e.target.value)}
            value={username}
          />
          {!isLogin && (
            <input
              type="email"
              placeholder="Email"
              className="p-3 rounded bg-[#1e1e1e] text-white border border-gray-600 focus:border-blue-500 outline-none"
              onChange={(e) => setEmail(e.target.value)}
              value={email}
            />
          )}
          <input
            type="password"
            placeholder="Password"
            className="p-3 rounded bg-[#1e1e1e] text-white border border-gray-600 focus:border-blue-500 outline-none"
            onChange={(e) => setPassword(e.target.value)}
            value={password}
          />
          
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded font-bold mt-2 transition-colors">
            {isLogin ? "Login" : "Sign Up"}
          </button>
        </form>

        <p className="text-gray-400 text-center mt-4 select-none">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span 
            className="text-blue-500 cursor-pointer hover:underline font-bold"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "Sign Up" : "Login"}
          </span>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
