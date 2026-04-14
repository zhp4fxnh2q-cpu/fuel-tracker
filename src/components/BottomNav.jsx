import React from 'react';

/**
 * BottomNav - Fixed bottom tab navigation bar
 * Props: { activeTab: string, onTabChange: (tab: string) => void }
 */
const BottomNav = ({ activeTab = 'dashboard', onTabChange }) => {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'foodlog', label: 'Food Log', icon: 'foodlog' },
    { id: 'weight', label: 'Weight', icon: 'weight' },
    { id: 'trends', label: 'Trends', icon: 'trends' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 border-t safe-area-inset-bottom"
      style={{
        backgroundColor: 'rgba(13, 17, 23, 0.95)',
        borderColor: 'var(--border)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div className="flex justify-around items-center h-20 max-w-6xl mx-auto px-3 pb-2 pt-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center justify-center flex-1 py-2 px-3 rounded-xl transition-all duration-200"
              style={{
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'rgba(88, 166, 255, 0.08)' : 'transparent',
              }}
            >
              {/* Icon */}
              <div className="w-6 h-6 mb-1 flex items-center justify-center">
                {renderIcon(tab.icon, isActive)}
              </div>

              {/* Label */}
              <span className="text-xs font-500 whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Render SVG icons inline
 */
function renderIcon(iconName, isActive) {
  const strokeWidth = isActive ? 2 : 1.5;
  const size = 24;

  switch (iconName) {
    case 'home':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );

    case 'foodlog':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Utensils icon - fork and knife */}
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
        </svg>
      );

    case 'weight':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Scale base */}
          <path d="M12 2L3 7v2h18V7l-9-5z" />
          {/* Scale display */}
          <rect x="4" y="9" width="16" height="8" rx="2" ry="2" />
          {/* Scale needle */}
          <line x1="12" y1="13" x2="12" y2="17" strokeWidth={strokeWidth} />
        </svg>
      );

    case 'trends':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      );

    case 'settings':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Gear icon */}
          <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );

    default:
      return null;
  }
}

export default BottomNav;
