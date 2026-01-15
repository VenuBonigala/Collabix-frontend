import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Code, Users, Zap } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-white flex flex-col">
      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="text-2xl font-bold text-blue-500 flex items-center gap-2">
          <Code /> Collabix
        </div>
        <div className="flex gap-6">
          <button className="hover:text-blue-400">Tutorial</button>
          <button className="hover:text-blue-400">About</button>
          <button className="hover:text-blue-400">Contact</button>
          <button 
            onClick={() => navigate('/auth')}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold"
          >
            Login / Sign Up
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Code Together, Real-Time.
        </h1>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl">
          Collaborate on code with your team in real-time. Create rooms, 
          share projects, and build amazing software together.
        </p>
        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/auth')}
            className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg text-lg font-bold"
          >
            Get Started
          </button>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-10 max-w-6xl">
          <div className="p-6 bg-[#252526] rounded-xl border border-gray-700">
            <Zap className="w-10 h-10 text-yellow-400 mb-4 mx-auto" />
            <h3 className="text-xl font-bold mb-2">Real-Time Sync</h3>
            <p className="text-gray-400">See changes instantly as your team types.</p>
          </div>
          <div className="p-6 bg-[#252526] rounded-xl border border-gray-700">
            <Users className="w-10 h-10 text-green-400 mb-4 mx-auto" />
            <h3 className="text-xl font-bold mb-2">Multi-User Rooms</h3>
            <p className="text-gray-400">Work with multiple developers in one shared space.</p>
          </div>
          <div className="p-6 bg-[#252526] rounded-xl border border-gray-700">
            <Code className="w-10 h-10 text-purple-400 mb-4 mx-auto" />
            <h3 className="text-xl font-bold mb-2">Advanced Editor</h3>
            <p className="text-gray-400">Powered by VS Code's robust editing engine.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;