import React from 'react';

export default function LoadingSpinner({ size = 'default' }) {
  const sizeClass = size === 'sm' ? 'w-4 h-4 border-2' : 'w-8 h-8 border-4';
  return (
    <div className={`${sizeClass} border-slate-200 border-t-indigo-600 rounded-full animate-spin`}></div>
  );
}