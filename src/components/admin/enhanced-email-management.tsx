'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Users, Send, Copy, Eye, X, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EMAIL_TEMPLATES, EmailTemplate, getTemplatesByCategory } from '@/lib/email-templates';
import { processTemplate, getDefaultVariables, TemplateVariables } from '@/lib/template-processor';
import { loadUsers } from '@/actions/loadUsers';
import { getUsersWhoSubmitted } from '@/actions/checkUserSubmission';
import { sendTemplatedEmails } from '@/actions/sendTemplatedEmails';
import { getUpcomingWeek, loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { DEFAULT_SEASON, debugLog, debugError} from '@/lib/utils';

// Design tokens (matching landing page)
const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const red     = 'oklch(60% 0.22 25)';
const amber   = 'oklch(72% 0.16 60)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface EnhancedEmailManagementProps {
  poolId: string;
  poolName: string;
  weekNumber: number;
  adminId: string;
}

interface Participant {
  id: string;
  name: string;
  email: string;
}

function ParticipantCountWarning({
  template,
  participants,
  poolId,
  weekNumber
}: {
  template: EmailTemplate | undefined;
  participants: Participant[];
  poolId: string;
  weekNumber: number;
}) {
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (template) {
      loadTargetCount();
    }
  }, [template, participants, poolId, weekNumber]);

  const loadTargetCount = async () => {
    if (!template) return;
    setIsLoading(true);
    try {
      if (template.targetAudience === 'all') {
        setTargetCount(participants.length);
      } else {
        const { week, seasonType } = await getUpcomingWeek();
        if (template.targetAudience === 'submitted') {
          const submittedIds = await getUsersWhoSubmitted(poolId, week, seasonType);
          setTargetCount(submittedIds.length);
        } else if (template.targetAudience === 'not_submitted') {
          const submittedIds = await getUsersWhoSubmitted(poolId, week, seasonType);
          setTargetCount(Math.max(0, participants.length - submittedIds.length));
        }
      }
    } catch (error) {
      debugError('Error loading target count:', error);
      setTargetCount(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getVariant = () => {
    if (targetCount === null || template?.targetAudience === 'all') return null;
    if (targetCount === 0) return 'error';
    if (targetCount <= 2) return 'warn';
    return 'ok';
  };

  const getMessage = () => {
    if (targetCount === null || !template) return 'Calculating participant count...';
    if (targetCount < 0) return '⚠️ Error calculating participant count. Please refresh.';
    if (template.targetAudience === 'all') return null;
    if (targetCount === 0) return `⚠️ No participants match "${template.name}". Template targets ${
      template.targetAudience === 'submitted' ? 'submitted picks' : 'not-yet-submitted picks'
    }.`;
    if (targetCount <= 2) return `⚠️ Only ${targetCount} participant${targetCount === 1 ? '' : 's'} will receive this email.`;
    return `✓ ${targetCount} participant${targetCount === 1 ? '' : 's'} will receive this email.`;
  };

  if (!template || isLoading) return null;
  if (template.targetAudience === 'all') return null;

  const variant = getVariant();
  const msg = getMessage();
  if (!msg) return null;

  const variantColor = variant === 'error' ? red : variant === 'warn' ? amber : green;

  return (
    <div style={{ padding: '0.6rem 0.85rem', borderRadius: 6, border: `1px solid ${variantColor}`, background: `color-mix(in oklch, ${variantColor} 12%, ${card})` }}>
      <p style={{ ...b, fontSize: '0.8rem', color: variantColor, margin: 0 }}>{msg}</p>
    </div>
  );
}

export function EnhancedEmailManagement({
  poolId,
  poolName,
  weekNumber,
  adminId
}: EnhancedEmailManagementProps) {
  const [activeEmailTab, setActiveEmailTab] = useState<'templates' | 'participants'>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [emailPreview, setEmailPreview] = useState({ subject: '', body: '' });
  const [isUpdatingPreview, setIsUpdatingPreview] = useState(false);
  const [adminName, setAdminName] = useState('Pool Commissioner');
  const { toast } = useToast();

  useEffect(() => {
    loadParticipants();
    loadAdminName();
  }, [poolId, weekNumber]);

  const loadAdminName = async () => {
    try {
      const supabase = await import('@/lib/supabase').then(m => m.getSupabaseClient());
      const { data: adminData, error } = await supabase
        .from('admins')
        .select('full_name')
        .eq('id', adminId)
        .single();
      if (!error && adminData?.full_name) setAdminName(adminData.full_name);
    } catch (error) {
      debugError('Error loading admin name:', error);
    }
  };

  useEffect(() => {
    if (selectedTemplate && participants.length > 0) updatePreview();
  }, [selectedTemplate, participants]);

  useEffect(() => {
    if (selectedTemplate && participants.length > 0 && (customSubject || customMessage)) {
      debugLog('Custom fields changed, updating preview...');
      updatePreview();
    }
  }, [customSubject, customMessage]);

  const loadParticipants = async () => {
    try {
      setIsLoading(true);
      const allParticipants = await loadUsers(poolId);
      setParticipants(allParticipants);
    } catch (error) {
      debugError('Error loading participants:', error);
      toast({ title: 'Error', description: 'Failed to load participants', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredParticipants = async (targetAudience: 'all' | 'submitted' | 'not_submitted') => {
    if (targetAudience === 'all') return participants;
    try {
      const weekData = await loadCurrentWeek();
      const seasonType = weekData?.season_type || 2;
      const submittedIds = await getUsersWhoSubmitted(poolId, weekNumber, seasonType);
      if (targetAudience === 'submitted') return participants.filter(p => submittedIds.includes(p.id));
      return participants.filter(p => !submittedIds.includes(p.id));
    } catch (error) {
      debugError('Error filtering participants:', error);
      return participants;
    }
  };

  const updatePreview = async () => {
    if (isUpdatingPreview) return;
    setIsUpdatingPreview(true);
    setEmailPreview({ subject: '', body: '' });
    setIsPreviewLoading(true);
    if (!selectedTemplate) { setIsPreviewLoading(false); setIsUpdatingPreview(false); return; }
    const template = EMAIL_TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) { setIsPreviewLoading(false); setIsUpdatingPreview(false); return; }
    try {
      if (participants.length === 0) {
        setTimeout(() => { setIsUpdatingPreview(false); updatePreview(); }, 500);
        return;
      }
      const filteredParticipants = await getFilteredParticipants(template.targetAudience);
      if (filteredParticipants.length === 0) {
        setEmailPreview({ subject: 'No participants match criteria', body: 'This template targets participants who do not match the current criteria.' });
        setIsPreviewLoading(false); setIsUpdatingPreview(false); return;
      }
      const sampleParticipant = filteredParticipants[0];
      const weekData = await loadCurrentWeek();
      const actualSeason = weekData?.season_year || DEFAULT_SEASON;
      const variables = getDefaultVariables(poolName, poolId, weekNumber, adminName, actualSeason);
      variables.participantName = sampleParticipant.name;
      if (template.id === 'custom-message') {
        variables.customSubject = customSubject;
        variables.customMessage = customMessage;
      }
      setEmailPreview({ subject: processTemplate(template.subject, variables), body: processTemplate(template.body, variables) });
    } catch (error) {
      debugError('Error updating preview:', error);
      setEmailPreview({ subject: 'Error generating preview', body: 'There was an error generating the email preview. Please try again.' });
    } finally {
      setIsPreviewLoading(false);
      setIsUpdatingPreview(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (template?.id === 'custom-message') {
      setCustomSubject('Message from Pool Commissioner');
      setCustomMessage('This is a custom message from the pool commissioner.');
    }
    setShowPreview(true);
    setTimeout(() => updatePreview(), 200);
  };

  const handleSendEmails = async () => {
    if (!selectedTemplate) return;
    setIsSending(true);
    try {
      const template = EMAIL_TEMPLATES.find(t => t.id === selectedTemplate);
      if (!template) { toast({ title: 'Error', description: 'Template not found', variant: 'destructive' }); return; }
      const customVariables: Partial<TemplateVariables> = {};
      if (customSubject) customVariables.customSubject = customSubject;
      if (customMessage) customVariables.customMessage = customMessage;
      const result = await sendTemplatedEmails({ poolId, poolName, weekNumber, adminId, template, customVariables });
      if (result.success && result.mailtoUrl) {
        try {
          const newWindow = window.open(result.mailtoUrl, '_blank');
          if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') throw new Error('Popup blocked');
          toast({ title: 'Email Client Opened', description: `Email prepared for ${result.recipientCount} participants.` });
        } catch {
          try {
            window.location.href = result.mailtoUrl;
            toast({ title: 'Email Client Opening', description: `Redirecting to email client...` });
          } catch {
            try {
              await navigator.clipboard.writeText(result.mailtoUrl);
              toast({ title: 'Email URL Copied', description: 'Paste it in your browser address bar.' });
            } catch {
              toast({ title: 'Manual Action Required', description: `Copy: ${result.mailtoUrl}`, variant: 'destructive' });
            }
          }
        }
      } else if (result.success) {
        toast({ title: 'Error', description: 'Email prepared but no mailto URL generated', variant: 'destructive' });
      } else {
        let errorMessage = result.error || 'Failed to prepare emails';
        if (result.error === 'No participants match the selected criteria') {
          const tpl = EMAIL_TEMPLATES.find(t => t.id === selectedTemplate);
          if (tpl) {
            const desc = tpl.targetAudience === 'submitted' ? 'participants who have submitted picks' :
              tpl.targetAudience === 'not_submitted' ? 'participants who have not submitted picks' : 'all participants';
            errorMessage = `No participants match "${tpl.name}". Targets ${desc}.`;
          }
        }
        toast({ title: 'Cannot Send Email', description: errorMessage, variant: 'destructive' });
      }
    } catch (error) {
      debugError('Error sending emails:', error);
      toast({ title: 'Error', description: 'Failed to prepare emails', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyToClipboard = async (textToCopy: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast({ title: 'Copied!', description: 'Email content copied to clipboard' });
    } catch (error) {
      debugError('Failed to copy:', error);
      toast({ title: 'Error', description: 'Failed to copy to clipboard', variant: 'destructive' });
    }
  };

  const getTemplateCount = (targetAudience: 'all' | 'submitted' | 'not_submitted') =>
    EMAIL_TEMPLATES.filter(t => t.targetAudience === targetAudience).length;

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setSelectedTemplate('');
    setShowPreview(false);
    setEmailPreview({ subject: '', body: '' });
    setCustomSubject('');
    setCustomMessage('');
  };

  // Shared inline styles
  const cardStyle = { background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem' };
  const labelStyle = { ...bc, fontSize: '0.7rem', fontWeight: 700, color: textMid, textTransform: 'uppercase' as const, letterSpacing: '0.07em', display: 'block', marginBottom: '0.4rem' };
  const btnPrimary = { ...bc, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', background: green, color: text, border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.05em', cursor: 'pointer', textTransform: 'uppercase' as const };
  const btnDisabled = { ...btnPrimary, background: border, color: textDim, cursor: 'not-allowed' };
  const btnOutline = { ...bc, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' };
  const inputStyle = { ...b, background: surface, border: `1px solid ${border}`, color: text, padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box' as const, fontSize: '0.875rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ ...bc, fontSize: '1rem', fontWeight: 800, color: text, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Email Management</h3>
          <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginTop: '0.2rem' }}>Send emails to participants using templates</p>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.7rem', background: surface, border: `1px solid ${border}`, borderRadius: 20 }}>
          <Mail style={{ width: 12, height: 12, color: textMid }} />
          <span style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, color: textMid, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{participants.length} Participants</span>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: `1px solid ${border}` }}>
        {(['templates', 'participants'] as const).map((tab) => {
          const active = activeEmailTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveEmailTab(tab)}
              style={{
                ...bc, padding: '0.45rem 1rem', background: 'transparent',
                color: active ? green : textMid,
                border: 'none', borderBottom: `2px solid ${active ? green : 'transparent'}`,
                fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em',
                textTransform: 'uppercase', cursor: 'pointer', marginBottom: -1,
              }}
            >
              {tab === 'templates' ? 'Email Templates' : 'Participants'}
            </button>
          );
        })}
      </div>

      {/* Templates Tab */}
      {activeEmailTab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Template Selection Card */}
          <div style={cardStyle}>
            <p style={{ ...bc, fontSize: '0.85rem', fontWeight: 800, color: text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>Select Email Template</p>
            <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>Choose a template and customize the message</p>

            {/* Category Filter */}
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={labelStyle}>Filter by Category</label>
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="welcome">Welcome</SelectItem>
                  <SelectItem value="reminder">Reminders</SelectItem>
                  <SelectItem value="update">Updates</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Template selector */}
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={labelStyle}>Email Template</label>
              <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder={selectedCategory === 'all' ? 'Select a template' : `Select a ${selectedCategory} template`} />
                </SelectTrigger>
                <SelectContent>
                  {getTemplatesByCategory(selectedCategory === 'all' ? undefined : selectedCategory).length === 0 ? (
                    <div style={{ padding: '0.5rem', fontSize: '0.8rem', color: textDim }}>No templates for this category</div>
                  ) : (
                    getTemplatesByCategory(selectedCategory === 'all' ? undefined : selectedCategory).map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
                          <span>{template.name}</span>
                          <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', border: `1px solid ${border}`, borderRadius: 4, color: textDim }}>
                            {template.targetAudience === 'all' ? 'All' : template.targetAudience === 'submitted' ? 'Submitted' : 'Not Submitted'}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Template description + warning */}
            {selectedTemplate && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ padding: '0.6rem 0.85rem', borderRadius: 6, background: `color-mix(in oklch, ${green} 10%, ${surface})`, border: `1px solid color-mix(in oklch, ${green} 30%, ${border})` }}>
                  <p style={{ ...b, fontSize: '0.8rem', color: textMid, margin: 0 }}>
                    {EMAIL_TEMPLATES.find(t => t.id === selectedTemplate)?.description}
                  </p>
                </div>
                <ParticipantCountWarning
                  template={EMAIL_TEMPLATES.find(t => t.id === selectedTemplate)}
                  participants={participants}
                  poolId={poolId}
                  weekNumber={weekNumber}
                />
              </div>
            )}

            {/* Custom message fields */}
            {selectedTemplate === 'custom-message' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.85rem' }}>
                <div>
                  <label style={labelStyle}>Subject</label>
                  <input
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Enter email subject"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Message</label>
                  <Textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Enter your custom message"
                    rows={6}
                    style={{ background: surface, border: `1px solid ${border}`, color: text, borderRadius: 6, ...b, fontSize: '0.875rem' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Send Button Card */}
          <div style={cardStyle}>
            <button
              onClick={handleSendEmails}
              disabled={!selectedTemplate || isSending}
              style={{ ...(!selectedTemplate || isSending ? btnDisabled : btnPrimary), width: '100%', justifyContent: 'center', padding: '0.65rem' }}
            >
              <Send style={{ width: 14, height: 14 }} />
              {isSending ? 'Sending...' : 'Send Emails'}
            </button>
            <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.85rem', borderRadius: 6, background: `color-mix(in oklch, ${green} 8%, ${surface})`, border: `1px solid color-mix(in oklch, ${green} 25%, ${border})` }}>
              <p style={{ ...b, fontSize: '0.75rem', color: textMid, margin: 0 }}>
                <strong style={{ color: textMid }}>Note:</strong> Opens your default email client with all participants in BCC. Participants cannot see each other&apos;s addresses.
              </p>
            </div>
          </div>

          {/* Email Preview Card */}
          {showPreview && selectedTemplate && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Eye style={{ width: 14, height: 14, color: textMid }} />
                  <span style={{ ...bc, fontSize: '0.85rem', fontWeight: 800, color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email Preview</span>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  style={{ background: 'transparent', border: 'none', color: textDim, cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>
              <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>Preview how the email will look to participants</p>

              {isPreviewLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div style={{ width: 28, height: 28, border: `2px solid ${border}`, borderTopColor: green, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 0.75rem' }} />
                  <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>Generating preview...</p>
                </div>
              ) : emailPreview.subject ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Subject</label>
                    <div style={{ padding: '0.6rem 0.85rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, ...b, fontSize: '0.875rem', color: text }}>
                      {emailPreview.subject}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Message</label>
                    <div style={{ padding: '0.6rem 0.85rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, ...b, fontSize: '0.875rem', color: text, whiteSpace: 'pre-wrap' }}>
                      {emailPreview.body}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => handleCopyToClipboard(emailPreview.subject)} style={btnOutline}>
                      <Copy style={{ width: 12, height: 12 }} />
                      Copy Subject
                    </button>
                    <button onClick={() => handleCopyToClipboard(emailPreview.body)} style={btnOutline}>
                      <Copy style={{ width: 12, height: 12 }} />
                      Copy Message
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <Mail style={{ width: 36, height: 36, color: textDim, margin: '0 auto 0.75rem', display: 'block' }} />
                  <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>Select a template to preview the email</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Participants Tab */}
      {activeEmailTab === 'participants' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {[
              { label: 'Total Participants', value: participants.length, color: green },
              { label: 'Submitted Templates', value: getTemplateCount('submitted'), color: green },
              { label: 'Reminder Templates', value: getTemplateCount('not_submitted'), color: amber },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ ...cardStyle, textAlign: 'center' }}>
                <div style={{ ...bc, fontSize: '1.5rem', fontWeight: 900, color, letterSpacing: '-0.02em' }}>{value}</div>
                <div style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.2rem' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Template categories */}
          <div style={cardStyle}>
            <p style={{ ...bc, fontSize: '0.85rem', fontWeight: 800, color: text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>Template Categories</p>
            <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>Available templates by target audience</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(['all', 'submitted', 'not_submitted'] as const).map((audience) => (
                <div key={audience} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: surface, borderRadius: 6, border: `1px solid ${border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users style={{ width: 14, height: 14, color: textDim }} />
                    <span style={{ ...b, fontSize: '0.85rem', color: text, fontWeight: 600, textTransform: 'capitalize' }}>
                      {audience.replace('_', ' ')} Participants
                    </span>
                  </div>
                  <span style={{ ...bc, fontSize: '0.7rem', fontWeight: 700, color: textMid, padding: '0.2rem 0.55rem', border: `1px solid ${border}`, borderRadius: 4 }}>
                    {getTemplateCount(audience)} templates
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
