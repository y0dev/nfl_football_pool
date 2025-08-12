'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Share2, Copy, Check, Smartphone, Mail, MessageCircle } from 'lucide-react';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { useToast } from '@/hooks/use-toast';

interface SharePoolButtonProps {
  poolId: string;
  poolName: string;
}

export function SharePoolButton({ poolId, poolName }: SharePoolButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadWeek = async () => {
      try {
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData?.week_number || 1);
      } catch (error) {
        console.error('Error loading current week:', error);
      }
    };
    loadWeek();
  }, []);

  useEffect(() => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/participant?pool=${poolId}&week=${currentWeek}`;
    setShareUrl(url);
  }, [poolId, currentWeek]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Pool link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${poolName} - NFL Confidence Pool`,
          text: `Join my NFL Confidence Pool for Week ${currentWeek}!`,
          url: shareUrl,
        });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Error sharing:', error);
          toast({
            title: "Error",
            description: "Failed to share",
            variant: "destructive",
          });
        }
      }
    } else {
      // Fallback to copy
      handleCopy();
    }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`Join ${poolName} - NFL Confidence Pool Week ${currentWeek}`);
    const body = encodeURIComponent(
      `Hi!\n\nI'd like to invite you to join my NFL Confidence Pool for Week ${currentWeek}!\n\nClick this link to join: ${shareUrl}\n\nSee you there!`
    );
    const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
    window.open(mailtoUrl);
  };

  const handleSMSShare = () => {
    const message = encodeURIComponent(
      `Join my NFL Confidence Pool for Week ${currentWeek}! ${shareUrl}`
    );
    const smsUrl = `sms:?body=${message}`;
    window.open(smsUrl);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Pool</DialogTitle>
          <DialogDescription>
            Share this link with participants to join {poolName} for Week {currentWeek}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="share-url">Pool Link</Label>
            <div className="flex gap-2">
              <Input
                id="share-url"
                value={shareUrl}
                readOnly
                className="flex-1"
              />
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Share via:</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleNativeShare}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Smartphone className="h-4 w-4" />
                Native Share
              </Button>
              <Button
                onClick={handleEmailShare}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                Email
              </Button>
              <Button
                onClick={handleSMSShare}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                SMS
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This link will take participants directly to Week {currentWeek} picks for {poolName}.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
