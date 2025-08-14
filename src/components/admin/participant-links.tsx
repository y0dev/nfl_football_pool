'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2, Link as LinkIcon, QrCode } from 'lucide-react';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';

interface ParticipantLinksProps {
  poolId: string;
  poolName: string;
}

export function ParticipantLinks({ poolId, poolName }: ParticipantLinksProps) {
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [seasonType, setSeasonType] = useState<number>(2);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Generate participant link
  const generateParticipantLink = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/participant?pool=${poolId}&week=${currentWeek}&seasonType=${seasonType}`;
  };

  // Copy link to clipboard
  const copyLink = async () => {
    const link = generateParticipantLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({
        title: 'Link Copied',
        description: 'Participant link copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  // Share link (mobile-friendly)
  const shareLink = async () => {
    const link = generateParticipantLink();
    const text = `Join ${poolName} - Week ${currentWeek} NFL Confidence Pool: ${link}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${poolName} - Week ${currentWeek}`,
          text: text,
          url: link,
        });
      } catch (error) {
        console.log('Share cancelled or failed');
      }
    } else {
      // Fallback to copy
      copyLink();
    }
  };

  // Load current week on mount
  useEffect(() => {
    const loadWeek = async () => {
      try {
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData.week_number);
        setSeasonType(weekData.season_type || 2);
      } catch (error) {
        console.error('Error loading current week:', error);
      }
    };
    loadWeek();
  }, []);

  const participantLink = generateParticipantLink();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          Participant Links
        </CardTitle>
        <CardDescription>
          Generate and share links for participants to join your pool
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pool and Week Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Pool</Label>
            <div className="mt-1">
              <Badge variant="secondary" className="text-sm">
                {poolName}
              </Badge>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Week</Label>
            <div className="mt-1">
              <Badge variant="outline" className="text-sm">
                Week {currentWeek}
              </Badge>
            </div>
          </div>
        </div>

        {/* Generated Link */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Participant Link</Label>
          <div className="flex gap-2">
            <Input
              value={participantLink}
              readOnly
              className="flex-1 text-sm"
            />
            <Button
              onClick={copyLink}
              variant="outline"
              size="sm"
              className="shrink-0"
            >
              <Copy className="h-4 w-4" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={shareLink}
            className="flex-1 sm:flex-none"
            disabled={isLoading}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Link
          </Button>
          
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => window.open(participantLink, '_blank')}
          >
            <QrCode className="h-4 w-4 mr-2" />
            Preview Link
          </Button>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">How to use:</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Copy or share the participant link above</li>
            <li>Send it to your pool participants via text, email, or messaging</li>
            <li>Participants can click the link to access the pool directly</li>
            <li>The link includes the pool ID and current week automatically</li>
          </ol>
        </div>

        {/* Quick Share Options */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Quick Share</Label>
          <div className="grid grid-cols-1 lg:grid-cols-4 lg:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const subject = `${poolName} - Week ${currentWeek} NFL Pool`;
                const body = `Join our NFL Confidence Pool for Week ${currentWeek}!\n\nClick this link to participate: ${participantLink}`;
                window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
              }}
            >
              📧 Email
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
