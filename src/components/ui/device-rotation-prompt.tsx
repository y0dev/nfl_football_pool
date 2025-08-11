'use client';

import { useState, useEffect } from 'react';
import { RotateCcw, Smartphone } from 'lucide-react';

export function DeviceRotationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      // Show prompt if screen width is very small (mobile portrait)
      const isVerySmall = window.innerWidth < 480;
      setShowPrompt(isVerySmall);
    };

    // Check on mount and resize
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-sm text-center shadow-xl">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <Smartphone className="h-12 w-12 text-gray-600" />
            <RotateCcw className="h-6 w-6 text-blue-500 absolute -top-1 -right-1 animate-pulse" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Rotate Your Device
        </h3>
        <p className="text-gray-600 text-sm mb-4">
          For the best experience, please rotate your device to landscape mode or use a larger screen.
        </p>
        <button
          onClick={() => setShowPrompt(false)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
