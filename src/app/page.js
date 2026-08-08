'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import EmojiPicker from '@/components/EmojiPicker';
import CallOverlay from '@/components/CallOverlay';
import OnChatLogo from '@/components/OnChatLogo';
import styles from './page.module.css';

// Gradient choices for default user avatars
const DEFAULT_AVATARS = [
  { name: 'Slate Gradient', value: 'linear-gradient(135deg, #18181b 0%, #3f3f46 100%)' },
  { name: 'Zinc Gradient', value: 'linear-gradient(135deg, #27272a 0%, #52525b 100%)' },
  { name: 'Dark Gradient', value: 'linear-gradient(135deg, #09090b 0%, #27272a 100%)' },
  { name: 'Light Gradient', value: 'linear-gradient(135deg, #71717a 0%, #a1a1aa 100%)' }
];

// Helper to format last seen time string
function formatLastSeenTime(lastSeenIso) {
  if (!lastSeenIso) return 'Recently';
  const date = new Date(lastSeenIso);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Custom voice notes player
const VoicePlayer = ({ src, isSentByMe }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    if (audio.duration) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(e => console.error(e));
      setIsPlaying(true);
    }
  };

  const handleTimelineClick = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickPercent = clickX / width;
    audio.currentTime = clickPercent * duration;
    setCurrentTime(audio.currentTime);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`${styles.voicePlayer} ${isSentByMe ? styles.voicePlayerSent : styles.voicePlayerReceived}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button type="button" className={styles.voicePlayBtn} onClick={togglePlay}>
        {isPlaying ? (
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
          </svg>
        )}
      </button>
      <div className={styles.voiceTimeline} onClick={handleTimelineClick}>
        <div className={styles.voiceProgressBar} style={{ width: `${progress}%` }} />
      </div>
      <span className={styles.voiceTime}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
};

export default function Home() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'users' | 'requests'
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState('light');

  // Super Admin Requests State
  const [adminRequests, setAdminRequests] = useState([]);
  const [reqActionLoading, setReqActionLoading] = useState(null);

  // User Creation State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(DEFAULT_AVATARS[0].value);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [createError, setCreateError] = useState('');
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);

  // Message Image Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');

  // Call Signaling State
  const [activeCall, setActiveCall] = useState(null);
  const [callPeer, setCallPeer] = useState(null);

  // Mobile State
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  const router = useRouter();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  // 1. Authentication & Session Check
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
    } else {
      const parsedUser = JSON.parse(storedUser);
      setCurrentUser(parsedUser);
      setIsPageLoading(false);
      
      if (parsedUser.role === 'user') {
        setSelectedUser({ 
          id: parsedUser.creatorId || 'admin-id', 
          username: 'Admin Console', 
          role: 'admin', 
          avatarUrl: '/uploads/avatar-admin.png' 
        });
        setShowMobileChat(true); // Regular users automatically see chat
      }
    }
  }, [router]);

  // 2. Theme Initialization
  useEffect(() => {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = localStorage.getItem('theme') || (systemPrefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
    document.documentElement.className = initialTheme;
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.className = newTheme;
  };

  // 3. Fetch Users (Admin Only)
  const fetchUsers = async () => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) return;
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        
        if (selectedUser) {
          const updatedSelected = data.users.find(u => u.id === selectedUser.id);
          if (updatedSelected) {
            setSelectedUser(prev => ({ ...prev, ...updatedSelected }));
          }
        }
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  // 4. Fetch Admin Requests (Super Admin Only)
  const fetchAdminRequests = async () => {
    if (!currentUser || currentUser.role !== 'superadmin') return;
    try {
      const res = await fetch('/api/admin-requests');
      if (res.ok) {
        const data = await res.json();
        setAdminRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Error fetching admin requests:', err);
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'superadmin') {
      fetchUsers();
    }
    if (currentUser?.role === 'superadmin') {
      fetchAdminRequests();
    }
  }, [currentUser]);

  // 5. Fetch Messages & Calls (Main Polling Loop)
  const fetchChatData = async () => {
    if (!currentUser) return;

    if (currentUser.role === 'admin' || currentUser.role === 'superadmin') {
      fetchUsers();
    }
    if (currentUser.role === 'superadmin') {
      fetchAdminRequests();
    }

    try {
      const callRes = await fetch('/api/calls');
      if (callRes.ok) {
        const callData = await callRes.json();
        setActiveCall(callData.activeCall);
        setCallPeer(callData.peer);
      }
    } catch (err) {
      console.error('Error polling call status:', err);
    }

    if (!selectedUser) return;
    try {
      const url = (currentUser.role === 'admin' || currentUser.role === 'superadmin')
        ? `/api/messages?userId=${selectedUser.id}`
        : '/api/messages';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchChatData();
      const interval = setInterval(fetchChatData, 2000);
      return () => clearInterval(interval);
    }
  }, [currentUser, selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDeleteMessage = async (messageId) => {
    if (!messageId) return;
    setMessages(prev => prev.filter(m => m.id !== messageId));
    try {
      const res = await fetch(`/api/messages?messageId=${messageId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        fetchChatData();
      }
    } catch (err) {
      console.error('Error deleting message:', err);
      fetchChatData();
    }
  };

  const handleClearChat = async () => {
    if (!selectedUser) return;
    const name = selectedUser.username || 'this user';
    if (!window.confirm(`Are you sure you want to clear all messages with ${name}?`)) {
      return;
    }
    const chatUserId = selectedUser.id;
    setMessages([]);
    try {
      const res = await fetch(`/api/messages?clearAll=true&userId=${chatUserId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchChatData();
      }
    } catch (err) {
      console.error('Error clearing chat:', err);
      fetchChatData();
    }
  };

  const handleRequestAction = async (requestId, action) => {
    setReqActionLoading(requestId);
    try {
      const res = await fetch('/api/admin-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchAdminRequests();
        await fetchUsers();
      } else {
        alert(data.error || 'Failed to process request');
      }
    } catch (err) {
      console.error('Error processing request:', err);
      alert('Network error while processing request.');
    } finally {
      setReqActionLoading(null);
    }
  };

  const handleSendMessage = async (e, forcedAudioUrl = null) => {
    if (e) e.preventDefault();
    const textToSend = inputText.trim();
    const audioToSend = forcedAudioUrl;

    if (!textToSend && !uploadedImageUrl && !audioToSend) return;

    const payload = {
      text: textToSend,
      imageUrl: uploadedImageUrl || null,
      audioUrl: audioToSend || null,
      receiverId: (currentUser.role === 'admin' || currentUser.role === 'superadmin') ? selectedUser?.id : (currentUser.creatorId || 'admin-id')
    };

    const tempId = 'temp-' + Date.now();
    const tempMessage = {
      id: tempId,
      senderId: currentUser.id,
      receiverId: payload.receiverId,
      text: payload.text,
      imageUrl: payload.imageUrl,
      audioUrl: payload.audioUrl,
      timestamp: new Date().toISOString(),
      read: false,
      readAt: null
    };

    setMessages(prev => [...prev, tempMessage]);
    setInputText('');
    setUploadedImageUrl('');

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        fetchChatData();
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      alert('Microphone access is required to record voice messages.');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;

    mediaRecorderRef.current.onstop = async () => {
      clearInterval(recordingIntervalRef.current);
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      const formData = new FormData();
      formData.append('file', audioBlob, `voice-note-${Date.now()}.webm`);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (res.ok && data.url) {
          handleSendMessage(null, data.url);
        }
      } catch (err) {
        console.error('Failed to upload voice note:', err);
      } finally {
        setIsRecording(false);
        setRecordingDuration(0);
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
      }
    };

    mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
    clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setUploadedImageUrl(data.url);
      } else {
        alert(data.error || 'Failed to upload image');
      }
    } catch (err) {
      console.error('Image upload error:', err);
      alert('Error uploading image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAvatarFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAvatarUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setCustomAvatarUrl(data.url);
      } else {
        alert(data.error || 'Failed to upload avatar');
      }
    } catch (err) {
      console.error('Avatar upload error:', err);
      alert('Error uploading avatar');
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setInputText(prev => prev + emoji);
  };

  const handleStartCall = async (type) => {
    if (!selectedUser) return;
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: selectedUser.id, type })
      });
      if (res.ok) {
        fetchChatData();
      }
    } catch (err) {
      console.error('Error starting call:', err);
    }
  };

  const handleAcceptCall = async () => {
    if (!activeCall) return;
    try {
      const res = await fetch('/api/calls', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: activeCall.id, status: 'connected' })
      });
      if (res.ok) {
        fetchChatData();
      }
    } catch (err) {
      console.error('Error accepting call:', err);
    }
  };

  const handleEndCall = async () => {
    try {
      const res = await fetch('/api/calls', { method: 'DELETE' });
      if (res.ok) {
        setActiveCall(null);
        setCallPeer(null);
      }
    } catch (err) {
      console.error('Error ending call:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUsername || !newPassword) {
      setCreateError('Username and password are required');
      return;
    }

    setCreateError('');
    const finalAvatar = customAvatarUrl || selectedAvatar;

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          avatarUrl: finalAvatar
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsCreateModalOpen(false);
        setNewUsername('');
        setNewPassword('');
        setCustomAvatarUrl('');
        fetchUsers();
      } else {
        setCreateError(data.error || 'Failed to create user');
      }
    } catch (err) {
      console.error(err);
      setCreateError('Failed to connect to server');
    }
  };

  const renderAvatar = (avatarUrl, firstLetter = 'U', customClass = '') => {
    const url = avatarUrl || '';
    if (url.startsWith('linear-gradient')) {
      return (
        <div className={customClass || styles.userAvatarPlaceholder} style={{ background: url }}>
          {firstLetter}
        </div>
      );
    }
    if (url) {
      return (
        <img src={url} alt="Avatar" className={customClass || styles.userAvatar} />
      );
    }
    return (
      <div className={customClass || styles.userAvatarPlaceholder} style={{ background: DEFAULT_AVATARS[0].value }}>
        {firstLetter}
      </div>
    );
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingRequests = adminRequests.filter(r => r.status === 'pending');
  const totalUnread = users.reduce((sum, u) => sum + (u.unreadCount || 0), 0);
  const isRegularUser = currentUser?.role === 'user';

  if (isPageLoading) {
    return (
      <div className={styles.splashContainer}>
        <OnChatLogo size={56} showText={true} />
        <div style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading OnChat...</div>
      </div>
    );
  }

  return (
    <div className={styles.appContainer}>
      
      {/* 1. TOP APP HEADER (Sleek 56px Height with breathing room) */}
      <header className={styles.topAppHeader}>
        <div className={styles.headerLeft}>
          {/* Back Icon on mobile when chatting for Admin/Superadmin */}
          {showMobileChat && !isRegularUser && (
            <button
              className={styles.headerBackBtn}
              onClick={() => setShowMobileChat(false)}
              title="Back to list"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" width="20" height="20">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          <OnChatLogo size={32} showText={true} />
        </div>

        <div className={styles.topHeaderRight}>
          {/* Header Theme Toggle Button */}
          <button 
            className={styles.headerThemeBtn} 
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" width="18" height="18">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" width="18" height="18">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21M5.22 5.22l1.59 1.59m10.38 10.38l1.59 1.59M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM3 12h2.25m13.5 0H21M5.22 18.78l1.59-1.59m10.38-10.38l1.59-1.59" />
              </svg>
            )}
          </button>

          {/* User Profile Badge */}
          <div className={styles.topHeaderUser} title={`Logged in as ${currentUser.username}`}>
            {renderAvatar(currentUser.avatarUrl, currentUser.username.charAt(0).toUpperCase(), styles.topAvatar)}
            <span className={styles.topUsername}>{currentUser.username}</span>
            <span className={styles.topRoleBadge}>{currentUser.role}</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT SPLIT AREA (SIDEBAR + CHAT) */}
      <div className={styles.mainContentArea}>
        
        {/* SIDEBAR: CHAT LIST, USER CREDENTIALS, OR ADMIN REQUESTS (For Admin / Super Admin) */}
        {!isRegularUser && (
          <aside className={`${styles.sidebar} ${showMobileChat ? styles.sidebarHidden : ''}`}>
            
            {/* VIEW A: CHATS */}
            {activeTab === 'chats' && (
              <>
                <div className={styles.sidebarHeader}>
                  <div className={styles.searchWrapper}>
                    <svg className={styles.searchIcon} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="18" height="18">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
                    </svg>
                    <input 
                      type="text" 
                      placeholder="Search" 
                      className={styles.searchInput}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
   
                <div className={styles.sidebarScrollArea}>
                  <h3 className={styles.sectionTitle}>{currentUser.role === 'superadmin' ? 'Admins' : 'People'}</h3>
                  {filteredUsers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      No users found
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        className={`${styles.userItem} ${selectedUser?.id === user.id ? styles.userItemActive : ''}`}
                        onClick={() => {
                          setSelectedUser(user);
                          setShowMobileChat(true);
                        }}
                      >
                        <div className={styles.avatarWithPresence}>
                          {renderAvatar(user.avatarUrl, user.username.charAt(0).toUpperCase())}
                          <span className={user.isOnline ? styles.presenceDotOnline : styles.presenceDotOffline} />
                        </div>
                        
                        <div className={styles.userMeta}>
                          <div className={styles.userItemName}>{user.username}</div>
                          <div className={styles.userItemStatus}>
                            {user.isOnline ? (
                              <span style={{ color: '#10b981', fontWeight: '600' }}>Online</span>
                            ) : (
                              <span>Last seen {formatLastSeenTime(user.lastSeen)}</span>
                            )}
                          </div>
                        </div>
                        {user.unreadCount > 0 && (
                          <span className={styles.unreadBadge}>{user.unreadCount}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {/* VIEW B: USERS & PASSWORDS */}
            {activeTab === 'users' && (
              <>
                <div className={styles.sidebarHeader}>
                  <button className={styles.primaryBtn} onClick={() => setIsCreateModalOpen(true)}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="18" height="18">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    {currentUser.role === 'superadmin' ? 'Create Admin' : 'Create User'}
                  </button>
                </div>

                <div className={styles.sidebarScrollArea}>
                  <h3 className={styles.sectionTitle}>Account Credentials</h3>
                  {users.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>No accounts created.</div>
                  ) : (
                    users.map((user) => (
                      <div key={user.id} className={styles.userItem} style={{ borderBottom: '1px solid var(--border-color)', borderRadius: 0 }}>
                        {renderAvatar(user.avatarUrl, user.username.charAt(0).toUpperCase())}
                        <div className={styles.userMeta}>
                          <div className={styles.userItemName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{user.username}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user.id.substring(0, 8)}</span>
                          </div>
                          <div className={styles.userItemPassword} title="Copy password">
                            Password: {user.password}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* VIEW C: ADMIN REQUESTS */}
            {activeTab === 'requests' && currentUser.role === 'superadmin' && (
              <div className={styles.requestsPanelContainer}>
                <div className={styles.sidebarHeader}>
                  <h3 className={styles.sectionTitle} style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    New Admin Requests ({adminRequests.length})
                  </h3>
                </div>

                <div className={styles.sidebarScrollArea}>
                  {adminRequests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      No admin requests pending.
                    </div>
                  ) : (
                    adminRequests.map((req) => (
                      <div key={req.id} className={styles.requestCard}>
                        <div className={styles.requestCardHeader}>
                          {renderAvatar(req.photo, req.email.charAt(0).toUpperCase(), styles.requestAvatar)}
                          <div className={styles.requestCardMeta}>
                            <div className={styles.requestEmail}>{req.email}</div>
                            <div className={styles.requestPhone}>{req.phone}</div>
                            <div className={styles.requestPlace}>📍 {req.place}</div>
                          </div>
                        </div>

                        <div className={styles.requestCardBody}>
                          <div className={styles.requestCardRow}>
                            <span className={styles.requestLabel}>Payment Plan:</span>
                            <span className={styles.requestPlanBadge}>{req.paymentPlan}</span>
                          </div>

                          <div className={styles.requestCardRow}>
                            <span className={styles.requestLabel}>Password:</span>
                            <code className={styles.requestPasswordCode}>{req.password}</code>
                          </div>

                          <div className={styles.requestCardRow}>
                            <span className={styles.requestLabel}>Submitted:</span>
                            <span className={styles.requestDate}>{new Date(req.createdAt).toLocaleDateString()}</span>
                          </div>

                          <div className={styles.requestCardRow}>
                            <span className={styles.requestLabel}>Status:</span>
                            <span
                              className={
                                req.status === 'approved'
                                  ? styles.statusApproved
                                  : req.status === 'rejected'
                                  ? styles.statusRejected
                                  : styles.statusPending
                              }
                            >
                              {req.status.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {req.status === 'pending' && (
                          <div className={styles.requestCardActions}>
                            <button
                              className={styles.approveBtn}
                              onClick={() => handleRequestAction(req.id, 'approve')}
                              disabled={reqActionLoading === req.id}
                            >
                              {reqActionLoading === req.id ? 'Processing...' : '✓ Approve Admin'}
                            </button>
                            <button
                              className={styles.rejectBtn}
                              onClick={() => handleRequestAction(req.id, 'reject')}
                              disabled={reqActionLoading === req.id}
                            >
                              ✕ Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </aside>
        )}

        {/* MAIN CHAT WINDOW */}
        <main className={`${styles.chatArea} ${showMobileChat || isRegularUser ? styles.chatAreaActive : ''}`}>
          {selectedUser ? (
            <>
              {/* Chat Header */}
              <div className={styles.chatHeader}>
                {!isRegularUser && (
                  <button 
                    className={styles.backBtn} 
                    onClick={() => setShowMobileChat(false)}
                    title="Back to List"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" width="20" height="20">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                )}
                
                <div className={styles.avatarWithPresence}>
                  {renderAvatar(selectedUser.avatarUrl, selectedUser.username.charAt(0).toUpperCase(), styles.chatHeaderAvatar)}
                  <span className={selectedUser.isOnline ? styles.presenceDotOnline : styles.presenceDotOffline} />
                </div>

                <div className={styles.chatHeaderInfo}>
                  <span className={styles.chatHeaderName}>
                    {(currentUser.role === 'admin' || currentUser.role === 'superadmin') ? selectedUser.username : 'Admin Console'}
                  </span>
                  <span className={styles.chatHeaderStatus}>
                    {selectedUser.isOnline ? (
                      <span style={{ color: '#10b981', fontWeight: '600' }}>• Online</span>
                    ) : (
                      <span>Last seen {formatLastSeenTime(selectedUser.lastSeen)}</span>
                    )}
                  </span>
                </div>

                {/* Header Actions: Audio Call + Clear Chat */}
                <div className={styles.headerActions}>
                  <button className={styles.iconBtn} onClick={() => handleStartCall('audio')} title="Audio Call">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.387a12.035 12.035 0 0 1-7.108-7.108c-.155-.44.011-.927.387-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                    </svg>
                  </button>

                  <button className={styles.iconBtnDanger} onClick={handleClearChat} title="Clear Chat History">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 9m-4.72 0-.34-9m-4.788 3.84 3.106-1.166m10.457 0 3.106 1.166M4.5 12h15M10.5 4.5h3m-6 3h9M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className={styles.messagesList}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem', fontSize: '0.85rem' }}>
                    No messages. Write a message below to start chatting.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const currentUserId = currentUser.id || (currentUser.username?.toLowerCase() === 'admin' ? 'admin-id' : '');
                    const isSentByMe = msg.senderId === currentUserId;
                    const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const formattedSeenTime = msg.readAt ? new Date(msg.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : formattedTime;

                    return (
                      <div 
                        key={msg.id} 
                        className={`${styles.messageRow} ${isSentByMe ? styles.messageRowSent : styles.messageRowReceived}`}
                      >
                        <div className={`${styles.messageContainer} ${isSentByMe ? styles.messageContainerSent : styles.messageContainerReceived}`}>
                          <div className={`${styles.messageBubble} ${isSentByMe ? styles.messageSent : styles.messageReceived}`}>
                            {msg.imageUrl && (
                              <img 
                                className={styles.messageImage} 
                                src={msg.imageUrl} 
                                alt="Attached image" 
                                onClick={() => window.open(msg.imageUrl, '_blank')}
                                style={{ cursor: 'pointer' }}
                              />
                            )}
                            {msg.audioUrl && (
                              <VoicePlayer src={msg.audioUrl} isSentByMe={isSentByMe} />
                            )}
                            {msg.text && <p className={styles.messageText}>{msg.text}</p>}
                          </div>

                          {/* Time & Read Receipts & Delete Option */}
                          <div className={styles.messageFooterRow}>
                            <span className={styles.messageTime}>{formattedTime}</span>
                            {isSentByMe && (
                              <span className={styles.readReceiptWrapper}>
                                {msg.read ? (
                                  <span className={styles.readReceiptSeen} title={`Seen at ${formattedSeenTime}`}>
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12.75l6 6 9-13.5" />
                                    </svg>
                                    <span className={styles.seenLabel}>Seen {formattedSeenTime}</span>
                                  </span>
                                ) : (
                                  <span className={styles.readReceiptSent} title="Delivered">
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                  </span>
                                )}
                              </span>
                            )}
                            
                            {/* Delete Message Button */}
                            <button
                              className={styles.deleteMsgBtn}
                              onClick={() => handleDeleteMessage(msg.id)}
                              title="Delete Message"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" width="13" height="13">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 9m-4.72 0-.34-9m-4.788 3.84 3.106-1.166m10.457 0 3.106 1.166M4.5 12h15M10.5 4.5h3m-6 3h9M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
                              </svg>
                            </button>
                          </div>

                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form className={styles.inputArea} onSubmit={handleSendMessage}>
                {uploadedImageUrl && (
                  <div className={styles.previewBar}>
                    <img src={uploadedImageUrl} alt="Upload preview" className={styles.previewImage} />
                    <button 
                      type="button" 
                      className={styles.removePreviewBtn} 
                      onClick={() => setUploadedImageUrl('')}
                      title="Remove attachment"
                    >
                      ×
                    </button>
                  </div>
                )}

                <div className={styles.inputRow}>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageSelect} 
                    accept="image/*" 
                    className={styles.fileInput} 
                  />

                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    title="Attach File"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="22" height="22">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739 10.125 21a5.982 5.982 0 0 1-8.485-8.486l8.485-8.485a4.5 4.5 0 0 1 6.364 6.364l-8.485 8.485a3 3 0 0 1-4.243-4.243l8.485-8.485m3 0H18" />
                    </svg>
                  </button>

                  {isRecording ? (
                    <div className={styles.recordingWrapper}>
                      <div className={styles.recordingPulseDot} />
                      <span className={styles.recordingTimer}>
                        Recording {formatDuration(recordingDuration)}
                      </span>
                      <button
                        type="button"
                        className={styles.recordingCancelBtn}
                        onClick={cancelRecording}
                        title="Discard Recording"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 9m-4.72 0-.34-9m-4.788 3.84 3.106-1.166m10.457 0 3.106 1.166M4.5 12h15M10.5 4.5h3m-6 3h9M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className={styles.inputFieldWrapper}>
                      <input
                        type="text"
                        className={styles.textInput}
                        placeholder="Type your message here..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                      />
                      
                      <EmojiPicker onEmojiSelect={handleEmojiSelect} />

                      <button
                        type="button"
                        className={styles.iconBtn}
                        style={{ width: 32, height: 32, padding: 0 }}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        title="Camera / Photo"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {isRecording ? (
                    <button 
                      type="button" 
                      className={`${styles.sendBtn} ${styles.sendRecordingBtn}`}
                      onClick={stopRecording}
                      title="Send Voice Note"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                        <path fillRule="evenodd" d="M1.5 12a10.5 10.5 0 1 1 21 0 10.5 10.5 0 0 1-21 0Zm7.304-3.417a.75.75 0 0 1 1.096-.04l3.075 3.093 3.075-3.093a.75.75 0 1 1 1.096 1.025l-3.623 3.644a.75.75 0 0 1-1.096 0L8.764 9.608a.75.75 0 0 1 .04-1.025Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  ) : (inputText.trim() || uploadedImageUrl) ? (
                    <button 
                      type="submit" 
                      className={styles.sendBtn}
                      disabled={isUploading}
                      title="Send Message"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" width="22" height="22">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                      </svg>
                    </button>
                  ) : (
                    <button 
                      type="button" 
                      className={styles.voiceRecordBtn}
                      onClick={startRecording}
                      title="Record Voice Note"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a5.25 5.25 0 0 0 10.5 0v-3A5.25 5.25 0 0 0 12 1.5ZM12 16.5A7.5 7.5 0 0 1 4.5 9a.75.75 0 0 0-1.5 0 9 9 0 0 0 8.25 8.943V21a.75.75 0 0 0 1.5 0v-3.057A9 9 0 0 0 21 9a.75.75 0 0 0-1.5 0 7.5 7.5 0 0 1-7.5 7.5Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </form>
            </>
          ) : (
            <div className={styles.emptyChatState}>
              <OnChatLogo size={52} showText={true} />
              <h2 style={{ marginTop: '1rem' }}>Welcome to OnChat</h2>
              <p style={{ marginTop: '0.5rem', opacity: 0.7 }}>Select a conversation from the sidebar to start messaging.</p>
            </div>
          )}
        </main>
      </div>

      {/* 3. PINNED BOTTOM FOOTER NAVIGATION SESSION */}
      <footer className={styles.footerNavSection}>
        {/* Chats Tab */}
        <button 
          className={`${styles.footerTabBtn} ${activeTab === 'chats' ? styles.footerTabBtnActive : ''}`} 
          onClick={() => {
            setActiveTab('chats');
            if (currentUser.role === 'user') {
              setSelectedUser({ 
                id: currentUser.creatorId || 'admin-id', 
                username: 'Admin Console', 
                role: 'admin', 
                avatarUrl: '/uploads/avatar-admin.png' 
              });
              setShowMobileChat(true);
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" width="20" height="20">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025 4.486 4.486 0 0 0-.406-1.106C3.743 16.584 3 14.39 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
          <span>Chats</span>
          {totalUnread > 0 && (
            <span className={styles.footerTabBadge}>{totalUnread}</span>
          )}
        </button>

        {/* Admin Users / Credentials Tab */}
        {(currentUser.role === 'admin' || currentUser.role === 'superadmin') && (
          <button 
            className={`${styles.footerTabBtn} ${activeTab === 'users' ? styles.footerTabBtnActive : ''}`} 
            onClick={() => setActiveTab('users')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" width="20" height="20">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm-3.75 7.5c0-.994.806-1.8 1.8-1.8h.15c.994 0 1.8.806 1.8 1.8v1.125c0 .207-.168.375-.375.375h-3c-.207 0-.375-.168-.375-.375V16.875Z" />
            </svg>
            <span>Users</span>
          </button>
        )}

        {/* Super Admin Requests Tab */}
        {currentUser.role === 'superadmin' && (
          <button
            className={`${styles.footerTabBtn} ${activeTab === 'requests' ? styles.footerTabBtnActive : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" width="20" height="20">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a5.97 5.97 0 0 0-.942 3.197m0 0A9.094 9.094 0 0 1 2.25 18.24a3 3 0 0 1 4.682-2.72m.94 3.198A5.97 5.97 0 0 1 6 18.72m0 0v.03c0 .225.012.447.037.666a11.944 11.944 0 0 0 11.926 0M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
            <span>Requests</span>
            {pendingRequests.length > 0 && (
              <span className={styles.footerTabBadge}>{pendingRequests.length}</span>
            )}
          </button>
        )}

        {/* Theme Button */}
        <button 
          className={styles.footerTabBtn} 
          onClick={toggleTheme}
        >
          {theme === 'light' ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" width="20" height="20">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" width="20" height="20">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21M5.22 5.22l1.59 1.59m10.38 10.38l1.59 1.59M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM3 12h2.25m13.5 0H21M5.22 18.78l1.59-1.59m10.38-10.38l1.59-1.59" />
            </svg>
          )}
          <span>Theme</span>
        </button>

        {/* Logout Button */}
        <button className={styles.footerTabBtn} onClick={handleLogout}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" width="20" height="20">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
          <span>Logout</span>
        </button>
      </footer>

      {/* ACTIVE CALL SIGNALING OVERLAY */}
      {activeCall && (
        <CallOverlay
          activeCall={activeCall}
          peer={callPeer}
          currentUser={currentUser}
          onAccept={handleAcceptCall}
          onDecline={handleEndCall}
        />
      )}

      {/* CREATE USER MODAL */}
      {isCreateModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>{currentUser.role === 'superadmin' ? 'Create Admin Account' : 'Create Chat Account'}</h3>
            
            {createError && <div className={styles.error}>{createError}</div>}
            
            <form onSubmit={handleCreateUser}>
              <div className={styles.modalFormGroup}>
                <label className={styles.modalLabel} htmlFor="newUsername">Username</label>
                <input
                  id="newUsername"
                  type="text"
                  className={styles.modalInput}
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. Anil"
                  autoComplete="off"
                />
              </div>

              <div className={styles.modalFormGroup}>
                <label className={styles.modalLabel} htmlFor="newPassword">Password</label>
                <input
                  id="newPassword"
                  type="text"
                  className={styles.modalInput}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="e.g. Pass123"
                  autoComplete="off"
                />
              </div>

              {/* Avatar Selection */}
              <div className={styles.modalFormGroup}>
                <label className={styles.modalLabel}>Profile Avatar / Photo</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {DEFAULT_AVATARS.map((av, index) => (
                    <button
                      key={index}
                      type="button"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: av.value,
                        border: selectedAvatar === av.value && !customAvatarUrl ? '2px solid white' : 'none',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setSelectedAvatar(av.value);
                        setCustomAvatarUrl('');
                      }}
                      title={av.name}
                    />
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarFileUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isAvatarUploading}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                  >
                    {isAvatarUploading ? 'Uploading...' : 'Upload Image'}
                  </button>
                  {customAvatarUrl && <span style={{ fontSize: '0.75rem', color: '#10b981' }}>✓ Image Selected</span>}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn}>
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
