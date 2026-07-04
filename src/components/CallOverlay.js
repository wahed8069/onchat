'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './CallOverlay.module.css';

export default function CallOverlay({ activeCall, peer, currentUser, onAccept, onDecline }) {
  const [seconds, setSeconds] = useState(0);
  const selfVideoRef = useRef(null);
  const peerVideoRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const ringerIntervalRef = useRef(null);

  // 1. Timer Logic for Connected Call
  useEffect(() => {
    let timer;
    if (activeCall?.status === 'connected') {
      timer = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setSeconds(0);
    }
    return () => clearInterval(timer);
  }, [activeCall?.status]);

  // 2. Synthesize Ringing & Beeping Sounds using Web Audio API (Zero Asset Dependencies!)
  const playRingtone = () => {
    try {
      if (audioContextRef.current) return;
      
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const isIncoming = activeCall.receiverId === currentUser.id;

      if (isIncoming) {
        // High pulsing electronic ring for incoming calls
        const playPulse = () => {
          if (ctx.state === 'closed') return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        };
        
        playPulse();
        ringerIntervalRef.current = setInterval(playPulse, 1000);
      } else {
        // Dual-tone standard US ringback tone for outgoing calls (440Hz + 480Hz)
        const playRingCycle = () => {
          if (ctx.state === 'closed') return;
          
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc1.frequency.value = 440;
          osc2.frequency.value = 480;
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.1, ctx.currentTime + 1.8);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);
          
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          
          osc1.start();
          osc2.start();
          osc1.stop(ctx.currentTime + 2.0);
          osc2.stop(ctx.currentTime + 2.0);
        };
        
        playRingCycle();
        ringerIntervalRef.current = setInterval(playRingCycle, 4000);
      }
    } catch (e) {
      console.warn('AudioContext failed to start:', e);
    }
  };

  const playCallEndBeep = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, ctx.currentTime); // Low pitch warning beep
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn('Beep playback failed:', e);
    }
  };

  const stopSounds = () => {
    if (ringerIntervalRef.current) {
      clearInterval(ringerIntervalRef.current);
      ringerIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  // 3. Trigger Ringing Audio
  useEffect(() => {
    if (activeCall?.status === 'ringing') {
      playRingtone();
    } else {
      stopSounds();
    }
    return () => stopSounds();
  }, [activeCall?.status]);

  // 4. Capture & Stop Camera Webcams
  useEffect(() => {
    async function startCamera() {
      if (activeCall?.status === 'connected' && activeCall?.type === 'video') {
        try {
          const devicesStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
          streamRef.current = devicesStream;
          
          // Connect local camera stream to both local view (muted) and mock peer view
          if (selfVideoRef.current) {
            selfVideoRef.current.srcObject = devicesStream;
          }
          if (peerVideoRef.current) {
            peerVideoRef.current.srcObject = devicesStream;
          }
        } catch (err) {
          console.warn('Failed to access webcam/microphone:', err);
        }
      }
    }

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [activeCall?.status, activeCall?.type]);

  // Play disconnect beep when call transitions out
  useEffect(() => {
    return () => {
      playCallEndBeep();
    };
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isCaller = activeCall?.callerId === currentUser?.id;

  return (
    <div className={styles.overlay}>
      {/* 1. CONNECTED VIDEO CALL PANEL */}
      {activeCall?.status === 'connected' && activeCall?.type === 'video' && (
        <div className={styles.videoContainer}>
          {/* Main Background View (representing the Remote Peer) */}
          <video 
            ref={peerVideoRef} 
            className={styles.peerVideo} 
            autoPlay 
            playsInline 
          />
          {/* Small Floating Corner View (representing Self) */}
          <video 
            ref={selfVideoRef} 
            className={styles.selfVideo} 
            autoPlay 
            playsInline 
            muted 
          />
          
          <div className={styles.videoControlsOverlay}>
            <div className={styles.videoCallInfo}>
              <div className={styles.videoCallName}>{peer?.username || 'User'}</div>
              <div className={styles.videoCallTimer}>{formatTime(seconds)}</div>
            </div>
            <button 
              className={`${styles.btn} ${styles.btnDecline}`} 
              onClick={onDecline}
              title="Hang up"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="28" height="28">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 2. RINGING OR CONNECTED AUDIO VIEW */}
      {!(activeCall?.status === 'connected' && activeCall?.type === 'video') && (
        <div className={styles.callingPane}>
          <div className={styles.avatarWrapper}>
            <div className={styles.avatar} style={{
              background: `linear-gradient(135deg, var(--accent-color), #818cf8)`,
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              fontSize: '3rem',
              fontWeight: 700
            }}>
              {peer?.username?.charAt(0).toUpperCase() || 'P'}
            </div>
            {activeCall?.status === 'ringing' && (
              <>
                <div className={`${styles.ripple} ${styles.ripple1}`}></div>
                <div className={`${styles.ripple} ${styles.ripple2}`}></div>
                <div className={`${styles.ripple} ${styles.ripple3}`}></div>
              </>
            )}
          </div>

          <h2 className={styles.name}>{peer?.username || 'User'}</h2>
          
          {activeCall?.status === 'ringing' ? (
            <p className={styles.status}>
              {isCaller ? 'Calling...' : `Incoming ${activeCall.type} call...`}
            </p>
          ) : (
            <>
              {/* Waveform for connected audio */}
              <div className={styles.waveform}>
                <div className={styles.wavebar}></div>
                <div className={styles.wavebar}></div>
                <div className={styles.wavebar}></div>
                <div className={styles.wavebar}></div>
                <div className={styles.wavebar}></div>
              </div>
              <div className={styles.timer}>{formatTime(seconds)}</div>
            </>
          )}

          <div className={styles.actionsRow}>
            {/* End Call / Decline Button */}
            <button 
              className={`${styles.btn} ${styles.btnDecline}`} 
              onClick={onDecline}
              title={activeCall?.status === 'ringing' && !isCaller ? 'Decline' : 'Hang Up'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="28" height="28">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </button>

            {/* Answer Button (Only visible for Incoming Ringing call) */}
            {activeCall?.status === 'ringing' && !isCaller && (
              <button 
                className={`${styles.btn} ${styles.btnAccept}`} 
                onClick={onAccept}
                title="Answer Call"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="28" height="28">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.387a12.035 12.035 0 0 1-7.108-7.108c-.155-.44.011-.927.387-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
