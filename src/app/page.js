'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import EmojiPicker from '@/components/EmojiPicker';
import CallOverlay from '@/components/CallOverlay';
import styles from './page.module.css';

// Gradient choices for default user avatars (Teal/Mint branding)
const DEFAULT_AVATARS = [
  { name: 'Teal Gradient', value: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)' },
  { name: 'Mint Gradient', value: 'linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%)' },
  { name: 'Emerald Gradient', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { name: 'Sky Gradient', value: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)' },
  { name: 'Slate Gradient', value: 'linear-gradient(135deg, #475569 0%, #94a3b8 100%)' }
];

// Custom premium glassmorphic audio player for voice notes
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
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'users'
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState('light');

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
      
      // If regular user, they only chat with their creator admin. Pre-set creator as Selected User
      if (parsedUser.role === 'user') {
        setSelectedUser({ 
          id: parsedUser.creatorId || 'admin-id', 
          username: 'Admin Console', 
          role: 'admin', 
          avatarUrl: '/uploads/avatar-admin.png' 
        });
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
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'superadmin') {
      fetchUsers();
    }
  }, [currentUser]);

  // 4. Fetch Messages & Calls (Main Polling Loop)
  const fetchChatData = async () => {
    if (!currentUser) return;

    // Refresh user list (and unread counts) for admin/superadmin
    if (currentUser.role === 'admin' || currentUser.role === 'superadmin') {
      fetchUsers();
    }

    // A. Fetch Call Session Status
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

    // B. Fetch Messages
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

  // Run initial fetch and trigger interval polling
  useEffect(() => {
    if (currentUser) {
      fetchChatData();
      const interval = setInterval(fetchChatData, 2000);
      return () => clearInterval(interval);
    }
  }, [currentUser, selectedUser]);

  // 5. Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 6. Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('user');
    document.cookie = 'user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
  };

  // 7. Avatar Upload during user creation
  const handleAvatarUpload = async (e) => {
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
      if (res.ok) {
        setCustomAvatarUrl(data.url);
        setSelectedAvatar(data.url);
      } else {
        alert(data.error || 'Failed to upload photo');
      }
    } catch (err) {
      alert('Upload failed');
    } finally {
      setIsAvatarUploading(false);
    }
  };

  // 8. Handle Create User (Admin Only)
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError('');
    if (!newUsername || !newPassword) {
      setCreateError('All fields are required');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: newUsername, 
          password: newPassword,
          avatarUrl: selectedAvatar
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewUsername('');
        setNewPassword('');
        setCustomAvatarUrl('');
        setSelectedAvatar(DEFAULT_AVATARS[0].value);
        setIsCreateModalOpen(false);
        fetchUsers();
      } else {
        setCreateError(data.error || 'Failed to create user');
      }
    } catch (err) {
      setCreateError('Connection error');
    }
  };

  // 9. Handle Image Attachment inside Chat Input
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
      if (res.ok) {
        setUploadedImageUrl(data.url);
      } else {
        alert(data.error || 'Failed to upload photo');
      }
    } catch (err) {
      alert('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Voice Note Helpers
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const options = { mimeType: 'audio/webm' };
      const recorder = new MediaRecorder(stream, options);
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size === 0) return;

        const formData = new FormData();
        formData.append('file', audioBlob, `voice-note-${Date.now()}.webm`);

        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          
          if (res.ok) {
            const data = await res.json();
            await sendAudioMessage(data.url);
          } else {
            console.error('Failed to upload audio message');
          }
        } catch (uploadErr) {
          console.error('Error uploading audio:', uploadErr);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(200);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error starting audio recording:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const sendAudioMessage = async (audioUrl) => {
    if (!currentUser || !selectedUser) return;
    const currentUserId = currentUser.id || (currentUser.username?.toLowerCase() === 'admin' ? 'admin-id' : '');
    
    const body = {
      senderId: currentUserId,
      receiverId: selectedUser.id,
      audioUrl
    };

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        fetchChatData();
      }
    } catch (err) {
      console.error('Error sending audio message:', err);
    }
  };

  // 10. Handle Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() && !uploadedImageUrl) return;

    const payload = {
      text: inputText,
      imageUrl: uploadedImageUrl || null,
      receiverId: (currentUser.role === 'admin' || currentUser.role === 'superadmin') ? selectedUser.id : (currentUser.creatorId || 'admin-id')
    };

    // Optimistic Update
    const tempMsg = {
      id: 'temp-' + Date.now(),
      senderId: currentUser.id,
      receiverId: payload.receiverId,
      text: payload.text,
      imageUrl: payload.imageUrl,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);
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
      console.error('Send error:', err);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setInputText(prev => prev + emoji);
  };

  // 11. Call Signaling Triggers
  const handleStartCall = async (type) => {
    if (!selectedUser) return;
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          receiverId: selectedUser.id,
          type
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveCall(data.call);
        setCallPeer(selectedUser);
      }
    } catch (e) {
      console.error('Error starting call:', e);
    }
  };

  const handleAcceptCall = async () => {
    if (!activeCall) return;
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          callId: activeCall.id
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveCall(data.call);
      }
    } catch (e) {
      console.error('Error accepting call:', e);
    }
  };

  const handleEndCall = async () => {
    try {
      await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end' })
      });
      setActiveCall(null);
      setCallPeer(null);
    } catch (e) {
      console.error('Error ending call:', e);
    }
  };

  // Avatar helper
  const renderAvatar = (url, firstLetter = 'U', customClass = '') => {
    if (url && url.startsWith('linear-gradient')) {
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

  // Filter users by search bar query
  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = users.reduce((sum, u) => sum + (u.unreadCount || 0), 0);

  if (isPageLoading) {
    return (
      <div className={styles.splashContainer}>
        <div className={styles.splashIcon}>C</div>
        <div>Loading Chat...</div>
      </div>
    );
  }

  return (
    <div className={styles.appContainer}>
      
      {/* 1. LEFT NAVIGATION RAIL */}
      <nav className={styles.navRail}>
        <div className={styles.navAvatarWrapper} title={`Logged in as ${currentUser.username}`}>
          {renderAvatar(currentUser.avatarUrl, currentUser.username.charAt(0).toUpperCase(), styles.navAvatar)}
        </div>

        <div className={styles.navTabs}>
          {/* Chats Tab */}
          <button 
            className={`${styles.navTabBtn} ${activeTab === 'chats' ? styles.navTabBtnActive : ''}`} 
            onClick={() => {
              setActiveTab('chats');
              if (currentUser.role === 'user') {
                setSelectedUser({ 
                  id: currentUser.creatorId || 'admin-id', 
                  username: 'Admin Console', 
                  role: 'admin', 
                  avatarUrl: '/uploads/avatar-admin.png' 
                });
              }
            }}
            title="Chats"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="22" height="22">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025 4.486 4.486 0 0 0-.406-1.106C3.743 16.584 3 14.39 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
            </svg>
            {totalUnread > 0 && (
              <span className={styles.navTabBadge}>{totalUnread}</span>
            )}
          </button>
 
          {/* Admin Credentials Panel Tab (For Admin & Super Admin) */}
          {(currentUser.role === 'admin' || currentUser.role === 'superadmin') && (
            <button 
              className={`${styles.navTabBtn} ${activeTab === 'users' ? styles.navTabBtnActive : ''}`} 
              onClick={() => setActiveTab('users')}
              title="Users & Passwords"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="22" height="22">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm-3.75 7.5c0-.994.806-1.8 1.8-1.8h.15c.994 0 1.8.806 1.8 1.8v1.125c0 .207-.168.375-.375.375h-3c-.207 0-.375-.168-.375-.375V16.875Z" />
              </svg>
            </button>
          )}

          {/* Light/Dark Mode Toggle Icon */}
          <button 
            className={styles.navTabBtn} 
            onClick={toggleTheme}
            title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          >
            {theme === 'light' ? (
              // Moon Icon
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="22" height="22">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
              </svg>
            ) : (
              // Sun Icon
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="22" height="22">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21M5.22 5.22l1.59 1.59m10.38 10.38l1.59 1.59M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM3 12h2.25m13.5 0H21M5.22 18.78l1.59-1.59m10.38-10.38l1.59-1.59" />
              </svg>
            )}
          </button>
        </div>

        {/* Logout at the bottom */}
        <button className={styles.navLogoutBtn} onClick={handleLogout} title="Log Out">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="22" height="22">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
        </button>
      </nav>

      {/* 2. SIDEBAR: Chat List or User List */}
      {(currentUser.role === 'admin' || currentUser.role === 'superadmin') && (
        <aside className={`${styles.sidebar} ${showMobileChat ? styles.sidebarHidden : ''}`}>
          
          {/* SIDEBAR VIEW A: Chats Tab (People List ONLY - Groups removed) */}
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
                      {renderAvatar(user.avatarUrl, user.username.charAt(0).toUpperCase())}
                      <div className={styles.userMeta}>
                        <div className={styles.userItemName}>{user.username}</div>
                        <div className={styles.userItemStatus}>Tap to open private chat</div>
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

          {/* SIDEBAR VIEW B: Users & Passwords Tab (Admin Only) */}
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
        </aside>
      )}

      {/* 3. MAIN CHAT WINDOW */}
      <main className={`${styles.chatArea} ${showMobileChat ? styles.chatAreaActive : ''}`}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className={styles.chatHeader}>
              {(currentUser.role === 'admin' || currentUser.role === 'superadmin') && (
                <button 
                  className={styles.backBtn} 
                  onClick={() => setShowMobileChat(false)}
                  title="Back"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="20" height="20">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                </button>
              )}
              
              {renderAvatar(selectedUser.avatarUrl, selectedUser.username.charAt(0).toUpperCase(), styles.chatHeaderAvatar)}

              <div className={styles.chatHeaderInfo}>
                <span className={styles.chatHeaderName}>
                  {(currentUser.role === 'admin' || currentUser.role === 'superadmin') ? selectedUser.username : 'Admin Console'}
                </span>
                <span className={styles.chatHeaderStatus}>Online - Last seen, active</span>
              </div>

              {/* Chat Actions Header (Video and 3-dots removed, Audio call remains) */}
              <div className={styles.headerActions}>
                {/* Audio Call Button */}
                <button className={styles.iconBtn} onClick={() => handleStartCall('audio')} title="Audio Call">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="22" height="22">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.387a12.035 12.035 0 0 1-7.108-7.108c-.155-.44.011-.927.387-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Chat Messages (Verified sender on right, receiver on left) */}
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
                        <span className={styles.messageTime}>{formattedTime}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <form className={styles.inputArea} onSubmit={handleSendMessage}>
              {/* Photo Preview */}
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
                {/* Photo Input (Camera/Photo button) */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageSelect} 
                  accept="image/*" 
                  className={styles.fileInput} 
                />

                {/* Attachment Icon */}
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
                  /* Input capsule container */
                  <div className={styles.inputFieldWrapper}>
                    <input
                      type="text"
                      className={styles.textInput}
                      placeholder="Type your message here..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                    />
                    
                    {/* Emoji Picker */}
                    <EmojiPicker onEmojiSelect={handleEmojiSelect} />

                    {/* Secondary Camera Icon in capsule */}
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

                {/* Multi-action Voice / Send Button */}
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
            <div className={styles.emptyChatIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="36" height="36">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641l-.318 1.272a.406.406 0 0 0 .524.484l1.272-.318a.502.502 0 0 1 .524.116 8.971 8.971 0 0 0 4.148 1.025Z" />
              </svg>
            </div>
            <h2>Admin Dashboard Console</h2>
            <p style={{ marginTop: '0.5rem', opacity: 0.7 }}>Select a user from the sidebar to chat or manage call sessions.</p>
          </div>
        )}
      </main>

      {/* 4. ACTIVE CALL SIGNALING OVERLAY */}
      {activeCall && (
        <CallOverlay
          activeCall={activeCall}
          peer={callPeer}
          currentUser={currentUser}
          onAccept={handleAcceptCall}
          onDecline={handleEndCall}
        />
      )}

      {/* 5. CREATE USER MODAL (Admin Only) */}
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
                  type="password"
                  className={styles.modalInput}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="e.g. anilpassword123"
                  autoComplete="new-password"
                />
              </div>

              {/* Profile Avatar Selection */}
              <div className={styles.modalFormGroup}>
                <label className={styles.modalLabel}>Select Profile Avatar</label>
                <div className={styles.avatarSelectionRow}>
                  {/* Default colorful gradient choices */}
                  {DEFAULT_AVATARS.map((avatar, idx) => (
                    <div
                      key={idx}
                      className={`${styles.avatarSelectOption} ${selectedAvatar === avatar.value ? styles.avatarSelectOptionActive : ''}`}
                      style={{ background: avatar.value }}
                      onClick={() => {
                        setSelectedAvatar(avatar.value);
                        setCustomAvatarUrl('');
                      }}
                      title={avatar.name}
                    />
                  ))}
                  
                  {/* Custom photo uploaded avatar */}
                  {customAvatarUrl && (
                    <img
                      src={customAvatarUrl}
                      alt="Custom upload"
                      className={`${styles.avatarSelectOption} ${selectedAvatar === customAvatarUrl ? styles.avatarSelectOptionActive : ''}`}
                      onClick={() => setSelectedAvatar(customAvatarUrl)}
                    />
                  )}

                  {/* Upload Avatar Trigger button */}
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarUpload}
                    accept="image/*"
                    className={styles.fileInput}
                  />

                  <button
                    type="button"
                    className={styles.avatarSelectOption}
                    style={{
                      border: '2px dashed var(--border-color)',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-secondary)'
                    }}
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isAvatarUploading}
                    title="Upload Custom Photo"
                  >
                    {isAvatarUploading ? (
                      <span className={styles.spinner} style={{ borderTopColor: 'var(--accent-color)', marginRight: 0 }}></span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button 
                  type="button" 
                  className={styles.secondaryBtn} 
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setCreateError('');
                    setCustomAvatarUrl('');
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={isAvatarUploading}>
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
