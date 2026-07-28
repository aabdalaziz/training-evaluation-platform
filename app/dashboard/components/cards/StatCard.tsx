'use client';

import React from 'react';

type StatCardProps = {
  title: string;
  subtitle?: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  onClick?: () => void;
};

const COLORS = {
  blue: {
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1d4ed8',
    accent: '#2563eb',
  },
  green: {
    bg: '#ecfdf5',
    border: '#a7f3d0',
    text: '#047857',
    accent: '#10b981',
  },
  orange: {
    bg: '#fff7ed',
    border: '#fdba74',
    text: '#c2410c',
    accent: '#f97316',
  },
  red: {
    bg: '#fef2f2',
    border: '#fca5a5',
    text: '#b91c1c',
    accent: '#ef4444',
  },
  purple: {
    bg: '#faf5ff',
    border: '#d8b4fe',
    text: '#7e22ce',
    accent: '#9333ea',
  },
};

export default function StatCard({
  title,
  subtitle,
  value,
  icon,
  color = 'blue',
  onClick,
}: StatCardProps) {
  const c = COLORS[color];

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: 18,
        border: `1px solid ${c.border}`,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: '.2s',
        boxShadow: '0 8px 24px rgba(15,23,42,.05)',
      }}
    >
      <div
        style={{
          height: 6,
          background: c.accent,
        }}
      />

      <div
        style={{
          padding: 22,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              color: '#64748b',
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            {title}
          </div>

          <div
            style={{
              fontSize: 34,
              fontWeight: 900,
              color: c.text,
              lineHeight: 1,
            }}
          >
            {value}
          </div>

          {subtitle && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: '#64748b',
                fontWeight: 700,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: c.bg,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: 30,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
