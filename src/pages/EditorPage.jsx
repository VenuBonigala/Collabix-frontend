import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { 
  Play, FileCode, FileJson, FileType, LogOut, 
  MessageSquare, Send, Monitor, Users, 
  PanelRightClose, PanelRightOpen, 
  Plus, Trash2, FolderPlus, Folder, File, ChevronRight, ChevronDown, 
  FolderOpen, Activity, Clock, MapPin, MapPinOff, 
  Mic, MicOff, Download, Crown, XCircle, Copy // Added Copy Icon here
} from 'lucide-react';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';

// --- AUDIO PLAYER COMPONENT ---
const AudioPlayer = ({ peer }) => {
    const audioRef = useRef();
    useEffect(() => {
        if(!peer) return;
        peer.on("stream", stream => {
            if(audioRef.current) audioRef.current.srcObject = stream;
        });
        peer.on("error", () => {});
    }, [peer]);
    return <audio ref={audioRef} autoPlay style={{ display: 'none' }} />;
};

// --- FILE TREE UTILS ---
const buildFileTree = (files) => {
    const root = {};
    Object.keys(files).forEach(path => {
        const parts = path.split('/');
        let current = root;
        parts.forEach((part, index) => {
            if (!current[part]) {
                current[part] = {
                    id: parts.slice(0, index + 1).join('/'),
                    name: part,
                    type: (index === parts.length - 1) ? files[path].type : 'folder',
                    children: {}
                };
            }
            current = current[part].children;
        });
    });
    return root;
};

// --- FILE TREE NODE (Fixed Crash Bug) ---
const FileTreeNode = ({ node, level, activeFile, onSelect, onCreate, onDelete }) => {
    const isFolder = node.type === 'folder';
    const [isOpen, setIsOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isCreating, setIsCreating] = useState(false); 
    const [newItemName, setNewItemName] = useState("");

    const handleCreateSubmit = (e) => {
        e.preventDefault();
        if (!newItemName) return setIsCreating(false);
        onCreate(`${node.id}/${newItemName}`, isCreating);
        setNewItemName("");
        setIsCreating(false);
        setIsOpen(true);
    };

    return (
        <div className="select-none">
            <div 
                className={`group px-4 py-1 flex items-center justify-between cursor-pointer transition-colors ${activeFile === node.id ? 'bg-[#37373d] border-l-2 border-blue-500 text-white' : 'text-gray-400 hover:bg-[#2a2d2e] hover:text-gray-200'}`}
                style={{ paddingLeft: `${level * 12 + 12}px` }}
                onClick={(e) => { e.stopPropagation(); isFolder ? setIsOpen(!isOpen) : onSelect(node.id); }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <div className="w-4 flex justify-center">{isFolder && (isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}</div>
                    {isFolder ? (isOpen ? <FolderOpen size={16} className="text-blue-400 shrink-0" /> : <Folder size={16} className="text-blue-400 shrink-0" />) : (
                        node.name.endsWith('.html') ? <FileCode size={15} className="text-orange-500 shrink-0" /> :
                        node.name.endsWith('.css') ? <FileType size={15} className="text-blue-400 shrink-0" /> :
                        node.name.endsWith('.js') ? <FileJson size={15} className="text-yellow-400 shrink-0" /> :
                        <File size={15} className="text-gray-500 shrink-0" />
                    )}
                    <span className="truncate text-sm">{node.name}</span>
                </div>
                <div className={`flex items-center gap-1 ${isHovered ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
                    {isFolder && (<>
                        <button onClick={(e) => { e.stopPropagation(); setIsCreating('file'); setIsOpen(true); }} className="text-gray-500 hover:text-white p-0.5"><Plus size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setIsCreating('folder'); setIsOpen(true); }} className="text-gray-500 hover:text-white p-0.5"><FolderPlus size={12} /></button>
                    </>)}
                    <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="text-gray-500 hover:text-red-500 p-0.5"><Trash2 size={12} /></button>
                </div>
            </div>
            {isCreating && (
                <div className="pl-8 pr-2 py-1 bg-[#37373d] flex items-center gap-2" style={{ paddingLeft: `${(level + 1) * 12 + 12}px` }}>
                    {isCreating === 'folder' ? <Folder size={14} className="text-blue-400"/> : <File size={14} className="text-gray-400"/>}
                    <form onSubmit={handleCreateSubmit} className="flex-1">
                        <input 
                            autoFocus 
                            type="text" 
                            className="w-full bg-transparent border-b border-blue-500 text-xs text-white outline-none" 
                            value={newItemName} 
                            onChange={(e) => setNewItemName(e.target.value)} 
                            onBlur={() => { if(!newItemName) setIsCreating(false) }} 
                            onClick={(e) => e.stopPropagation()}
                        />
                    </form>
                </div>
            )}
            {isFolder && isOpen && <div>{Object.keys(node.children).sort((a, b) => (node.children[a].type === 'folder' ? 0 : 1) - (node.children[b].type === 'folder' ? 0 : 1) || a.localeCompare(b)).map(childName => <FileTreeNode key={node.children[childName].id} node={node.children[childName]} level={level + 1} activeFile={activeFile} onSelect={onSelect} onCreate={onCreate} onDelete={onDelete} />)}</div>}
        </div>
    );
};

// --- MAIN PAGE ---
const EditorPage = () => {
  const socketRef = useRef(null);
  const location = useLocation();
  const { roomId } = useParams();
  const reactNavigator = useNavigate();
  const editorRef = useRef(null); 
  const monacoRef = useRef(null);
  const decorationsRef = useRef({});

  // App State
  const [clients, setClients] = useState([]);
  const [activeFile, setActiveFile] = useState('');
  const [files, setFiles] = useState({});
  const [activities, setActivities] = useState([]);
  const [activeRightTab, setActiveRightTab] = useState('preview'); 
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(true);
  const [messages, setMessages] = useState([]);
  const [currentMsg, setCurrentMsg] = useState("");
  const [hasUnreadMsg, setHasUnreadMsg] = useState(false);
  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [newRootItemName, setNewRootItemName] = useState("");
  const [isSharingLocation, setIsSharingLocation] = useState(true);
  const [consoleOutput, setConsoleOutput] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  // VOICE & HOST STATE
  const [peers, setPeers] = useState([]);
  const [stream, setStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [hostId, setHostId] = useState(null);
  
  const peersRef = useRef([]); 
  const activeFileRef = useRef('');
  const activeRightTabRef = useRef(activeRightTab);
  const isRightPanelVisibleRef = useRef(isRightPanelVisible);
  const isSharingLocationRef = useRef(isSharingLocation);
  const isRemoteUpdate = useRef(false);

  useEffect(() => { activeRightTabRef.current = activeRightTab; }, [activeRightTab]);
  useEffect(() => { isRightPanelVisibleRef.current = isRightPanelVisible; }, [isRightPanelVisible]);
  useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);
  useEffect(() => { isSharingLocationRef.current = isSharingLocation; }, [isSharingLocation]);

  const fileTree = buildFileTree(files);

  const logActivity = (message) => {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setActivities(prev => [{ message, time }, ...prev].slice(0, 50));
  };

  const createPeer = (userToSignal, callerID, stream) => {
      const peer = new SimplePeer({ initiator: true, trickle: false, stream });
      peer.on("signal", signal => { socketRef.current.emit("sending-signal", { userToSignal, callerID, signal, username: location.state?.username }); });
      return peer;
  };

  const addPeer = (incomingSignal, callerID, stream) => {
      const peer = new SimplePeer({ initiator: false, trickle: false, stream });
      peer.on("signal", signal => { socketRef.current.emit("returning-signal", { signal, callerID }); });
      peer.signal(incomingSignal);
      return peer;
  };

  useEffect(() => {
      const handleBeforeUnload = () => { if (socketRef.current) socketRef.current.disconnect(); };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const kickUser = (targetSocketId) => {
      if (!window.confirm("Are you sure you want to remove this user?")) return;
      socketRef.current.emit('kick-user', { roomId, targetSocketId });
  };

  const handleLogout = () => {
    localStorage.removeItem('userInfo'); 
    if(socketRef.current) socketRef.current.disconnect();
    reactNavigator('/');
    toast.success("Logged out");
  };

  useEffect(() => {
    const init = async () => {
      let currentStream = null;
      try {
          currentStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setStream(currentStream);
      } catch (err) { 
          console.error("Failed to get audio", err); 
      }

      socketRef.current = io('http://localhost:5000');
      
      socketRef.current.on('connect_error', (err) => {
        toast.error('Socket connection failed');
        reactNavigator('/');
      });

      socketRef.current.emit('join-room', { roomId, username: location.state?.username });

      socketRef.current.on('joined', ({ clients: roomClients, username, files: dbFiles, hostId: initialHostId }) => {
        
        if (username !== location.state?.username) { toast.success(`${username} joined.`); logActivity(`You joined the room`); }
        setHostId(initialHostId);
        const uniqueClients = roomClients.filter((c, index, self) => index === self.findIndex((t) => t.socketId === c.socketId) && c.socketId !== socketRef.current.id);
        setClients(uniqueClients);
        
        if(dbFiles) {
            const normalizedFiles = {};
            Object.values(dbFiles).forEach(file => {
                normalizedFiles[file.name] = { ...file, value: file.value || file.content || "" };
            });
            setFiles(normalizedFiles);
            const firstFile = Object.keys(normalizedFiles).find(k => normalizedFiles[k].type === 'file');
            if (firstFile) setActiveFile(firstFile);
        }

        if (currentStream) {
            const peersList = [];
            uniqueClients.forEach(client => {
                const peer = createPeer(client.socketId, socketRef.current.id, currentStream);
                peersRef.current.push({ peerID: client.socketId, peer, username: client.username });
                peersList.push({ peerID: client.socketId, peer, username: client.username });
            });
            setPeers(peersList);
        }
      });

      // --- CHAT LISTENER ---
      socketRef.current.on('receive-message', (msgData) => {
          setMessages((prev) => [...prev, msgData]);
          if (!isRightPanelVisibleRef.current || activeRightTabRef.current !== 'chat') {
              setHasUnreadMsg(true);
          }
      });

      socketRef.current.on('kicked', () => {
          socketRef.current.disconnect();
          toast.error("You have been removed.");
          reactNavigator('/home');
      });

      socketRef.current.on('update-host', ({ hostId }) => {
          setHostId(hostId);
          toast("Host changed", { icon: '👑' });
      });

      socketRef.current.on('user-joined-call', payload => {
          const peer = addPeer(payload.signal, payload.callerID, currentStream);
          peersRef.current.push({ peerID: payload.callerID, peer, username: payload.username });
          setPeers(users => [...users, { peerID: payload.callerID, peer, username: payload.username }]);
      });

      socketRef.current.on('receiving-returned-signal', payload => {
          const item = peersRef.current.find(p => p.peerID === payload.id);
          if (item) item.peer.signal(payload.signal);
      });

      socketRef.current.on('user-joined', ({ username, socketId }) => {
          if (socketId === socketRef.current.id) return;
          toast.success(`${username} joined`);
          setClients(prev => { if(prev.some(c => c.socketId === socketId)) return prev; return [...prev, { username, socketId }]; });
          logActivity(`${username} joined`);
      });

      socketRef.current.on('user-disconnected', ({ socketId, username }) => {
        toast.success(`${username} left`);
        setClients(prev => prev.filter(c => c.socketId !== socketId));
        logActivity(`${username} left`);
        const peerObj = peersRef.current.find(p => p.peerID === socketId);
        if(peerObj) peerObj.peer.destroy();
        const newPeers = peersRef.current.filter(p => p.peerID !== socketId);
        peersRef.current = newPeers;
        setPeers(newPeers);
        if (editorRef.current && decorationsRef.current[socketId]) { editorRef.current.deltaDecorations(decorationsRef.current[socketId], []); delete decorationsRef.current[socketId]; }
      });

      socketRef.current.on('code-change', ({ fileName, code, originId }) => {
          if (originId === socketRef.current.id) return;
          setFiles(prev => ({ ...prev, [fileName]: prev[fileName] ? { ...prev[fileName], value: code } : prev[fileName] }));
          if (fileName === activeFileRef.current && editorRef.current) {
              const editor = editorRef.current;
              const model = editor.getModel();
              if (model.getValue() !== code) { isRemoteUpdate.current = true; const currentPos = editor.getPosition(); model.setValue(code); if (currentPos) editor.setPosition(currentPos); isRemoteUpdate.current = false; }
          }
      });
      
      socketRef.current.on('file-created', (newFile) => { setFiles(prev => ({ ...prev, [newFile.name]: { ...newFile, value: newFile.content } })); logActivity(`File created: ${newFile.name}`); });
      socketRef.current.on('file-deleted', (fileName) => { setFiles(prev => { const newFiles = { ...prev }; Object.keys(newFiles).forEach(k => { if (k.startsWith(fileName + '/')) delete newFiles[k]; }); delete newFiles[fileName]; return newFiles; }); logActivity(`File deleted: ${fileName}`); if (activeFile === fileName) setActiveFile(''); });
      
      socketRef.current.on('line-change', ({ socketId, lineNumber, fileName, username }) => { if (!editorRef.current || !monacoRef.current) return; if (fileName !== activeFileRef.current) return; const previousDecorations = decorationsRef.current[socketId] || []; if (lineNumber === -1) { editorRef.current.deltaDecorations(previousDecorations, []); delete decorationsRef.current[socketId]; return; } const newDecorations = editorRef.current.deltaDecorations(previousDecorations, [{ range: new monacoRef.current.Range(lineNumber, 1, lineNumber, 1), options: { isWholeLine: true, className: 'remote-line-highlight', hoverMessage: { value: `${username} is typing here` } } }]); decorationsRef.current[socketId] = newDecorations; });
      socketRef.current.on('code-output', ({ output, isError }) => { setIsRunning(false); setConsoleOutput(prev => [...prev, { text: output, isError }]); });
    };

    init();

    return () => {
        if(socketRef.current) { socketRef.current.disconnect(); socketRef.current.off(); }
        peersRef.current.forEach(p => p.peer.destroy());
        setPeers([]);
        if(stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []); 

  if (!location.state) return <Navigate to="/" />;

  const handleEditorDidMount = (editor, monaco) => { editorRef.current = editor; monacoRef.current = monaco; editor.onDidChangeCursorPosition((e) => { if (isSharingLocationRef.current) { socketRef.current.emit('line-change', { roomId, lineNumber: e.position.lineNumber, fileName: activeFileRef.current, username: location.state?.username }); } }); };
  const toggleLocationSharing = () => { const newState = !isSharingLocation; setIsSharingLocation(newState); if (newState) { toast.success("Location sharing ON"); if (editorRef.current) { const pos = editorRef.current.getPosition(); if(pos) { socketRef.current.emit('line-change', { roomId, lineNumber: pos.lineNumber, fileName: activeFileRef.current, username: location.state?.username }); } } } else { toast("Location sharing OFF", { icon: '🕵️' }); socketRef.current.emit('line-change', { roomId, lineNumber: -1, fileName: activeFileRef.current, username: location.state?.username }); } };
  const handleCodeChange = (value) => { if (isRemoteUpdate.current) return; setFiles(prev => ({ ...prev, [activeFile]: { ...prev[activeFile], value } })); socketRef.current.emit('code-change', { roomId, fileName: activeFile, code: value }); };
  const handleCreate = (fileName, type) => { if (files[fileName]) return toast.error("Exists"); socketRef.current.emit('file-created', { roomId, fileName, type }); };
  const handleDelete = (fileName) => { if(window.confirm(`Delete ${fileName}?`)) socketRef.current.emit('file-deleted', { roomId, fileName }); };
  const createRootItem = (e) => { e.preventDefault(); if(!newRootItemName) return setIsCreatingRoot(false); handleCreate(newRootItemName, isCreatingRoot); setNewRootItemName(""); setIsCreatingRoot(false); };
  
  const runCode = () => { 
      setIsRightPanelVisible(true); 
      const file = files[activeFile]; 
      if (!file) return; 
      if (file.name.endsWith('.html')) { setActiveRightTab('preview'); setOutputKey(prev => prev + 1); return; } 
      setActiveRightTab('console'); setIsRunning(true); setConsoleOutput([]); 
      socketRef.current.emit('run-code', { language: file.language, code: file.value || file.content || "" }); 
  };
  
  const toggleMic = () => { if(stream) { stream.getAudioTracks()[0].enabled = !isMicOn; setIsMicOn(!isMicOn); toast(isMicOn ? "Mic Muted" : "Mic On", { icon: isMicOn ? '🔇' : '🎙️' }); } };
  
  const sendMessage = () => { 
      if (currentMsg.trim()) { 
          socketRef.current.emit('send-message', { roomId, message: currentMsg, username: location.state?.username }); 
          setCurrentMsg(""); 
      }
  };
  
  // --- UPDATED PREVIEW LOGIC ---
  const getSrcDoc = () => {
      if (!files || Object.keys(files).length === 0) return "";

      // 1. Determine which HTML file to render
      // Priority: Active File (if HTML) -> index.html -> First found HTML file
      let targetFileName = activeFile.endsWith('.html') ? activeFile : 'index.html';
      
      if (!files[targetFileName]) {
          targetFileName = Object.keys(files).find(key => key.endsWith('.html'));
      }

      // If no HTML file is found, return a placeholder
      if (!targetFileName || !files[targetFileName]) return '<div style="color:white; padding:20px;">No HTML file found</div>';

      let htmlContent = files[targetFileName].value;

      // 2. Inject CSS (Replace <link href="..."> with <style>content</style>)
      const cssRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/g;
      htmlContent = htmlContent.replace(cssRegex, (match, href) => {
          const cleanPath = href.replace(/^\.\//, ''); // Remove ./ if present
          const fileNode = files[cleanPath];
          if (fileNode) {
              return `<style>\n${fileNode.value}\n</style>`;
          }
          return match; 
      });

      // 3. Inject JS (Replace <script src="..."> with <script>content</script>)
      const jsRegex = /<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/g;
      htmlContent = htmlContent.replace(jsRegex, (match, src) => {
          const cleanPath = src.replace(/^\.\//, ''); 
          const fileNode = files[cleanPath];
          if (fileNode) {
              return `<script>\n${fileNode.value}\n</script>`;
          }
          return match;
      });

      return htmlContent;
  };
  
  const downloadProject = async () => {
      const toastId = toast.loading("Bundling project...");
      try {
          const response = await fetch(`http://localhost:5000/api/download/${roomId}`);
          if (!response.ok) throw new Error("Download failed");
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Collabix-${roomId}.zip`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          toast.dismiss(toastId);
          toast.success("Download started!");
      } catch (error) {
          console.error(error);
          toast.dismiss(toastId);
          toast.error("Could not download project");
      }
  };

  // --- NEW FUNCTION TO COPY ROOM ID ---
  const copyRoomId = async () => {
    try {
        await navigator.clipboard.writeText(roomId);
        toast.success('Room ID copied to clipboard');
    } catch (err) {
        toast.error('Could not copy Room ID');
        console.error(err);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-white overflow-hidden">
      <nav className="h-14 bg-[#252526] border-b border-gray-700 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
            <span className="font-bold text-blue-500 text-lg">&lt;&gt;Collabix</span>
            {/* UPDATED ROOM ID SECTION WITH BUTTON */}
            <div className="flex items-center gap-2">
                <div className="text-xs text-gray-400 hidden sm:block">Room: {roomId}</div>
                <button 
                    onClick={copyRoomId} 
                    className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
                    title="Copy Room ID"
                >
                    <Copy size={14} />
                </button>
            </div>
        </div>
        <div className="flex gap-2"><button onClick={runCode} className="flex items-center gap-2 bg-green-600 px-4 py-1 rounded hover:bg-green-700 text-sm font-bold"><Play size={16} /> Run Live</button></div>
        <div className="flex items-center gap-4"><button onClick={() => setIsRightPanelVisible(!isRightPanelVisible)} className="p-1.5 rounded hover:bg-gray-700">{isRightPanelVisible ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}</button></div>
      </nav>
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-60 bg-[#252526] border-r border-gray-700 flex flex-col shrink-0">
            <div className="flex-1 flex flex-col min-h-0">
                <div className="p-3 flex items-center justify-between border-b border-gray-700 bg-[#252526]">
                    <span className="text-xs font-bold text-gray-400 uppercase">Explorer</span>
                    <div className="flex gap-1">
                        <button onClick={downloadProject} className="text-gray-400 hover:text-white rounded p-1" title="Download ZIP"><Download size={16} /></button>
                        <div className="w-[1px] h-4 bg-gray-600 mx-1"></div>
                        <button onClick={() => setIsCreatingRoot('file')} className="text-gray-400 hover:text-white rounded p-1"><Plus size={16} /></button>
                        <button onClick={() => setIsCreatingRoot('folder')} className="text-gray-400 hover:text-white rounded p-1"><FolderPlus size={16} /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto mt-1">{isCreatingRoot && (<div className="px-4 py-1 flex items-center gap-2 bg-[#37373d]">{isCreatingRoot === 'folder' ? <Folder size={14} className="text-blue-400"/> : <File size={14} className="text-gray-400"/>}<form onSubmit={createRootItem} className="flex-1"><input autoFocus type="text" className="w-full bg-transparent border-b border-blue-500 text-xs text-white outline-none" value={newRootItemName} onChange={(e) => setNewRootItemName(e.target.value)} onBlur={() => { if(!newRootItemName) setIsCreatingRoot(false) }} /></form></div>)}{Object.keys(fileTree).sort().map(name => <FileTreeNode key={fileTree[name].id} node={fileTree[name]} level={0} activeFile={activeFile} onSelect={setActiveFile} onCreate={handleCreate} onDelete={handleDelete}/>)}</div>
            </div>
            <div className="h-48 border-t border-gray-700 bg-[#1e1e1e] flex flex-col">
                <div className="p-2 border-b border-gray-700 bg-[#252526] flex items-center gap-2"><Activity size={14} className="text-blue-500" /><span className="text-xs font-bold text-gray-400 uppercase">Activity Log</span></div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">{activities.map((log, index) => (<div key={index} className="flex flex-col"><span className="text-xs text-gray-300">{log.message}</span><span className="text-[10px] text-gray-600 flex items-center gap-1"><Clock size={8} /> {log.time}</span></div>))}</div>
            </div>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
            {files[activeFile] && files[activeFile].type === 'file' ? (
                <>
                <div className="bg-[#1e1e1e] px-4 py-2 text-sm text-gray-400 border-b border-gray-700 flex items-center gap-2"><span className="text-white font-bold bg-[#2d2d2d] px-2 py-0.5 rounded text-xs">{activeFile}</span></div>
                <Editor height="100%" theme="vs-dark" language={files[activeFile].language} value={files[activeFile].value} onChange={handleCodeChange} onMount={handleEditorDidMount} options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true }} />
                </>
            ) : (<div className="flex-1 flex flex-col items-center justify-center text-gray-500"><Monitor size={48} className="mb-4 opacity-20" /><p>Select a file to start editing</p></div>)}
        </div>
        <div className={`flex flex-col bg-white border-l border-gray-700 shrink-0 transition-all duration-300 ${isRightPanelVisible ? 'w-[400px]' : 'w-0 border-none'}`}>
            <div className="h-10 bg-[#252526] flex border-b border-gray-700 overflow-hidden">
                <button onClick={() => setActiveRightTab('preview')} className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium ${activeRightTab === 'preview' ? 'bg-[#1e1e1e] text-blue-400 border-t-2 border-blue-500' : 'text-gray-400'}`}>Preview</button>
                <button onClick={() => setActiveRightTab('console')} className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium ${activeRightTab === 'console' ? 'bg-[#1e1e1e] text-blue-400 border-t-2 border-blue-500' : 'text-gray-400'}`}>Console</button>
                <button onClick={() => setActiveRightTab('chat')} className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium ${activeRightTab === 'chat' ? 'bg-[#1e1e1e] text-blue-400 border-t-2 border-blue-500' : 'text-gray-400'}`}>Chat</button>
                <button onClick={() => setActiveRightTab('participants')} className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium ${activeRightTab === 'participants' ? 'bg-[#1e1e1e] text-blue-400 border-t-2 border-blue-500' : 'text-gray-400'}`}>Users</button>
            </div>
            <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden relative">
                {activeRightTab === 'preview' && <iframe srcDoc={getSrcDoc()} title="output" sandbox="allow-scripts" width="100%" height="100%" className="flex-1 bg-white border-none" />}
                {activeRightTab === 'console' && (<div className="flex-1 bg-[#1e1e1e] p-4 font-mono text-sm overflow-y-auto"><div className="text-gray-500 mb-2 uppercase text-xs font-bold tracking-wider">Server Output</div>{isRunning && <div className="text-yellow-500 italic mb-2">Running...</div>}{consoleOutput.length === 0 && !isRunning && <div className="text-gray-600 italic">No output yet. Run your code!</div>}{consoleOutput.map((line, i) => (<div key={i} className={`${line.isError ? 'text-red-400' : 'text-green-400'} whitespace-pre-wrap mb-1`}>{line.text}</div>))}</div>)}
                
                {/* CHAT TAB */}
                {activeRightTab === 'chat' && (<div className="flex-1 flex flex-col"><div className="flex-1 overflow-y-auto p-4 space-y-4">{messages.map((msg, i) => (<div key={i} className={`flex flex-col ${msg.username === location.state?.username ? 'items-end' : 'items-start'}`}><div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm shadow-sm ${msg.username === location.state?.username ? 'bg-blue-600 text-white' : 'bg-[#37373d] text-gray-200'}`}>{msg.message}</div><span className="text-[10px] text-gray-500 mt-1">{msg.username}</span></div>))}</div><div className="p-3 bg-[#252526] border-t border-gray-700 flex gap-2"><input type="text" value={currentMsg} onChange={(e) => setCurrentMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Message..." className="flex-1 bg-[#1e1e1e] text-white text-sm rounded px-3 py-2 border border-gray-600 outline-none" /><button onClick={sendMessage} className="bg-blue-600 p-2 rounded text-white"><Send size={18} /></button></div></div>)}
                
                {activeRightTab === 'participants' && (
                    <div className="p-4 space-y-4 overflow-y-auto">
                        {peers.map((p, index) => (<AudioPlayer key={index} peer={p.peer} />))}
                        <div className="space-y-2 mt-4">
                            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Connected Users</h3>
                            <div className="flex items-center justify-between bg-[#252526] p-2 rounded border border-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">{location.state?.username.slice(0,2).toUpperCase()}</div>
                                    <span className="text-sm font-medium flex items-center gap-1">{location.state?.username} {hostId === socketRef.current?.id && <Crown size={12} className="text-yellow-400" />}</span>
                                </div>
                                <span className="text-xs text-gray-500 italic">You</span>
                            </div>
                            {clients.map(client => (
                                <div key={client.socketId} className="flex items-center justify-between bg-[#252526] p-2 rounded border border-gray-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">{client.username.slice(0,2).toUpperCase()}</div>
                                        <span className="text-sm font-medium flex items-center gap-1">{client.username} {hostId === client.socketId && <Crown size={12} className="text-yellow-400" />}</span>
                                    </div>
                                    {hostId === socketRef.current?.id && (<button onClick={() => kickUser(client.socketId)} className="text-gray-500 hover:text-red-500 transition-colors" title="Remove User"><XCircle size={16} /></button>)}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[#252526]/90 backdrop-blur-sm px-6 py-3 rounded-full shadow-2xl border border-gray-600 flex items-center gap-6 z-[100]">
        <button onClick={toggleLocationSharing} className={`p-2 rounded-full transition relative group ${isSharingLocation ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`} title={isSharingLocation ? "Location Sharing ON" : "Stealth Mode"}>{isSharingLocation ? <MapPin size={20} /> : <MapPinOff size={20} />}</button>
        <div className="w-[1px] h-6 bg-gray-600"></div>
        <button onClick={toggleMic} className={`p-2 rounded-full transition relative group ${isMicOn ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-red-500 text-white'}`} title="Mic">{isMicOn ? <Mic size={20} /> : <MicOff size={20} />}</button>
        <div className="w-[1px] h-6 bg-gray-600"></div>
        <button onClick={() => {setIsRightPanelVisible(true); setActiveRightTab('chat'); setHasUnreadMsg(false);}} className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition relative group" title="Open Chat"><MessageSquare size={20} />{hasUnreadMsg && !isRightPanelVisible && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-[#252526]"></span>}</button>
        <div className="w-[1px] h-6 bg-gray-600"></div>
        <button onClick={handleLogout} className="p-2 rounded-full bg-red-500/10 text-red-500 hover:bg-red-600 hover:text-white transition group" title="Leave Room"><LogOut size={20} /></button>
      </div>
    </div>
  );
};

export default EditorPage;