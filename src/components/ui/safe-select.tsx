'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface SafeSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export function SafeSelect({ 
  value, 
  onValueChange, 
  placeholder = "Select an option", 
  label,
  children,
  disabled = false 
}: SafeSelectProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't render until mounted to prevent hydration errors
  if (!isMounted) {
    return (
      <div className="space-y-2">
        {label && <Label>{label}</Label>}
        <div className="h-10 bg-gray-100 rounded-md animate-pulse" />
      </div>
    );
  }

  // If there was an error, show a fallback
  if (hasError) {
    return (
      <div className="space-y-2">
        {label && <Label>{label}</Label>}
        <div className="h-10 bg-red-50 border border-red-200 rounded-md flex items-center px-3 text-red-600 text-sm">
          Error loading options
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Select 
        value={value} 
        onValueChange={onValueChange}
        disabled={disabled}
        onOpenChange={(open) => {
          if (open) {
            // Reset error state when opening
            setHasError(false);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent onCloseAutoFocus={() => setHasError(false)}>
          {children}
        </SelectContent>
      </Select>
    </div>
  );
}
