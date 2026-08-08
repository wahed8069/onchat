'use client';

import React from 'react';

export default function OnChatLogo({ size = 38, showText = true, textClassName = '', style = {} }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        userSelect: 'none',
        ...style
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, filter: 'drop-shadow(0 4px 12px rgba(13, 148, 136, 0.35))' }}
      >
        <defs>
          <linearGradient id="onChatGrad1" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0d9488" />
            <stop offset="50%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <linearGradient id="onChatGrad2" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#ccfbf1" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Chat Bubble Shape with smooth rounded corners */}
        <path
          d="M24 4C12.954 4 4 12.059 4 22C4 26.657 5.962 30.89 9.208 34.02C8.384 37.668 6.425 40.548 4.316 42.671C4.015 42.974 4.184 43.5 4.608 43.504C9.52 43.551 14.156 41.05 17.202 38.647C19.349 39.52 21.623 40 24 40C35.046 40 44 31.941 44 22C44 12.059 35.046 4 24 4Z"
          fill="url(#onChatGrad1)"
        />

        {/* Pulsing signal dot / ON symbol overlay */}
        <circle cx="17" cy="22" r="3.5" fill="url(#onChatGrad2)" filter="url(#glow)" />
        <circle cx="24" cy="22" r="4.5" fill="url(#onChatGrad2)" filter="url(#glow)" />
        <circle cx="31" cy="22" r="3.5" fill="url(#onChatGrad2)" filter="url(#glow)" />

        {/* Small live online ring accent on top right */}
        <circle cx="38" cy="10" r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
      </svg>

      {showText && (
        <span
          className={textClassName}
          style={{
            fontSize: size * 0.62 + 'px',
            fontWeight: '800',
            letterSpacing: '-0.03em',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            display: 'flex',
            alignItems: 'baseline'
          }}
        >
          <span
            style={{
              background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            on
          </span>
          <span
            style={{
              color: 'var(--logo-chat-color, #0f172a)',
              marginLeft: '1px'
            }}
          >
            chat
          </span>
        </span>
      )}
    </div>
  );
}
