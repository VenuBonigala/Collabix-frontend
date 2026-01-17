import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        navigate('/');
    } else {
        setUsername(user.username.charAt(0).toUpperCase() + user.username.slice(1));
    }
  }, [navigate]);

  const createNewRoom = (e) => {
    e.preventDefault();
    const id = uuidv4();
    setRoomId(id);
    toast.success('Created a new room');
  };

  const copyRoomId = async () => {
    if (!roomId) {
        toast.error('Generate a Room ID first');
        return;
    }
    try {
        await navigator.clipboard.writeText(roomId);
        toast.success('Room ID copied to clipboard');
    } catch (err) {
        toast.error('Could not copy Room ID');
    }
  };

  const joinRoom = () => {
    if (!roomId) {
      toast.error('Room ID is required');
      return;
    }
    navigate(`/editor/${roomId}`, {
      state: {
        username,
      },
    });
  };

  const handleInputEnter = (e) => {
    if (e.code === 'Enter') {
      joinRoom();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1e1e1e] text-white flex-col">
    <h5 className="text-2xl font-bold mb-6 text-center">Welcome back {username}</h5>
      <div className="bg-[#252526] p-8 rounded-xl max-w-md w-full border border-gray-700 shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-center">Join A Room</h2>
        <div className="flex flex-col gap-4">
          
          {/* Wrapper for Input and Copy Button */}
          <div className="flex gap-2">
            <input
              type="text"
              className="p-3 rounded bg-[#1e1e1e] border border-gray-600 text-white outline-none focus:border-blue-500 flex-1"
              placeholder="ROOM ID"
              onChange={(e) => setRoomId(e.target.value)}
              value={roomId}
              onKeyUp={handleInputEnter}
            />
            <button
              onClick={copyRoomId}
              className="bg-gray-600 hover:bg-gray-700 transition-all p-3 rounded font-bold text-white w-24"
            >
              Copy
            </button>
          </div>

          <button 
            onClick={joinRoom}
            className="bg-blue-600 hover:bg-blue-700 transition-all p-3 rounded font-bold text-white"
          >
            Join
          </button>
          
          <span className="text-gray-400 text-center text-sm">
            If you don't have an invite then &nbsp;
            <a onClick={createNewRoom} href="" className="text-blue-500 hover:underline font-bold">
              new room
            </a>
          </span>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
