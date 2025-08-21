'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Users, Send, Copy, Eye, EyeOff, AlertCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EMAIL_TEMPLATES, EmailTemplate, getTemplatesByCategory } from '@/lib/email-templates';
import { processTemplate, getDefaultVariables, TemplateVariables } from '@/lib/template-processor';
import { loadUsers } from '@/actions/loadUsers';
import { getUsersWhoSubmitted } from '@/actions/checkUserSubmission';
import { sendTemplatedEmails } from '@/actions/sendTemplatedEmails';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';

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

// Component to show participant count warning for selected template
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
        // Get current week data to get season type
        const weekData = await loadCurrentWeek();
        const seasonType = weekData?.season_type || 2;
        
        if (template.targetAudience === 'submitted') {
          const submittedIds = await getUsersWhoSubmitted(poolId, weekNumber, seasonType);
          setTargetCount(submittedIds.length);
        } else if (template.targetAudience === 'not_submitted') {
          const submittedIds = await getUsersWhoSubmitted(poolId, weekNumber, seasonType);
          // Ensure we don't get negative values
          const notSubmittedCount = Math.max(0, participants.length - submittedIds.length);
          setTargetCount(notSubmittedCount);
        }
      }
    } catch (error) {
      console.error('Error loading target count:', error);
      setTargetCount(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getWarningVariant = () => {
    if (targetCount === null) return 'default';
    if (template?.targetAudience === 'all') return null; // Don't show warnings for all templates
    if (targetCount === 0) return 'destructive';
    if (targetCount <= 2) return 'secondary';
    return 'default';
  };

  const getWarningMessage = () => {
    if (targetCount === null || !template) return 'Calculating participant count...';
    
    // Additional safety check for invalid counts
    if (targetCount < 0) {
      console.error('Invalid participant count detected:', targetCount);
      return '⚠️ Error calculating participant count. Please refresh the page.';
    }
    
    // All template types don't need warnings or messages
    if (template.targetAudience === 'all') {
      return null;
    }
    
    if (targetCount === 0) {
      return `⚠️ No participants match the criteria for "${template.name}". This template targets ${
        template.targetAudience === 'submitted' ? 'participants who have submitted picks' :
        template.targetAudience === 'not_submitted' ? 'participants who have not submitted picks' :
        'the selected participant group'
      }.`;
    }
    if (targetCount <= 2) {
      return `⚠️ Only ${targetCount} participant${targetCount === 1 ? '' : 's'} will receive this email.`;
    }
    return `✓ ${targetCount} participant${targetCount === 1 ? '' : 's'} will receive this email.`;
  };

  // Don't render anything for all template types
  if (!template || isLoading) return null;
  if (template.targetAudience === 'all') return null;

  // At this point, template is guaranteed to be defined and not 'all'
  const safeTemplate = template!;

  return (
    <div className={`p-3 rounded-lg border ${
      getWarningVariant() === 'destructive' ? 'bg-red-50 border-red-200' :
      getWarningVariant() === 'secondary' ? 'bg-yellow-50 border-yellow-200' :
      'bg-green-50 border-green-200'
    }`}>
      <p className={`text-sm ${
        getWarningVariant() === 'destructive' ? 'text-red-800' :
        getWarningVariant() === 'secondary' ? 'text-yellow-800' :
        'text-green-800'
      }`}>
        {getWarningMessage()}
      </p>
    </div>
  );
}

export function EnhancedEmailManagement({ 
  poolId, 
  poolName, 
  weekNumber, 
  adminId 
}: EnhancedEmailManagementProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [emailPreview, setEmailPreview] = useState({ subject: '', body: '' });
  const [isUpdatingPreview, setIsUpdatingPreview] = useState(false);
  const [adminName, setAdminName] = useState('Pool Administrator');
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
      
      if (!error && adminData?.full_name) {
        setAdminName(adminData.full_name);
      }
    } catch (error) {
      console.error('Error loading admin name:', error);
      // Keep default 'Pool Administrator' if loading fails
    }
  };

  useEffect(() => {
    if (selectedTemplate && participants.length > 0) {
      updatePreview();
    }
  }, [selectedTemplate, participants]);

  // Handle custom field changes separately
  useEffect(() => {
    if (selectedTemplate && participants.length > 0 && (customSubject || customMessage)) {
      console.log('Custom fields changed, updating preview...');
      updatePreview();
    }
  }, [customSubject, customMessage]);

  const loadParticipants = async () => {
    try {
      setIsLoading(true);
      const allParticipants = await loadUsers(poolId);
      setParticipants(allParticipants);
    } catch (error) {
      console.error('Error loading participants:', error);
      toast({
        title: 'Error',
        description: 'Failed to load participants',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredParticipants = async (targetAudience: 'all' | 'submitted' | 'not_submitted') => {
    if (targetAudience === 'all') {
      return participants;
    }

    try {
      // Get current week data to get season type
      const weekData = await loadCurrentWeek();
      const seasonType = weekData?.season_type || 2;
      
      const submittedIds = await getUsersWhoSubmitted(poolId, weekNumber, seasonType);
      // console.log('Submitted IDs:', submittedIds);
      // console.log('All participants:', participants);
      
      if (targetAudience === 'submitted') {
        const submittedParticipants = participants.filter(p => submittedIds.includes(p.id));
        console.log('Submitted participants:', submittedParticipants.length);
        return submittedParticipants;
      } else {
        const notSubmittedParticipants = participants.filter(p => !submittedIds.includes(p.id));
        console.log('Not submitted participants:', notSubmittedParticipants.length);
        return notSubmittedParticipants;
      }
    } catch (error) {
      console.error('Error filtering participants:', error);
      // Return all participants as fallback
      return participants;
    }
  };

  const updatePreview = async () => {
    // Prevent multiple simultaneous updates
    if (isUpdatingPreview) {
      console.log('Preview update already in progress, skipping...');
      return;
    }
    
    setIsUpdatingPreview(true);
    
    // Clear preview immediately when starting
    setEmailPreview({ subject: '', body: '' });
    setIsPreviewLoading(true);
    
    if (!selectedTemplate) {
      setIsPreviewLoading(false);
      setIsUpdatingPreview(false);
      return;
    }

    const template = EMAIL_TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) {
      setIsPreviewLoading(false);
      setIsUpdatingPreview(false);
      return;
    }

    try {
      // Wait for participants to be loaded
      if (participants.length === 0) {
        console.log('No participants loaded yet, waiting...');
        setTimeout(() => {
          setIsUpdatingPreview(false);
          updatePreview();
        }, 500);
        return;
      }
      
      const filteredParticipants = await getFilteredParticipants(template.targetAudience);
      
      if (filteredParticipants.length === 0) {
        setEmailPreview({ 
          subject: 'No participants match criteria', 
          body: 'This template targets participants who do not match the current criteria.' 
        });
        setIsPreviewLoading(false);
        setIsUpdatingPreview(false);
        return;
      }

      const sampleParticipant = filteredParticipants[0];
      
      // Get current week data to get the actual season
      const weekData = await loadCurrentWeek();
      const actualSeason = weekData?.season_year || 2025;
      
      const variables = getDefaultVariables(poolName, poolId, weekNumber, adminName, actualSeason);
      variables.participantName = sampleParticipant.name;
      // Remove the manual season assignment since it's now passed to getDefaultVariables

      // Handle custom template
      if (template.id === 'custom-message') {
        variables.customSubject = customSubject;
        variables.customMessage = customMessage;
      }

      const subject = processTemplate(template.subject, variables);
      const body = processTemplate(template.body, variables);

      // console.log('Final preview - Subject:', subject);
      // console.log('Final preview - Body:', body.substring(0, 100) + '...');

      setEmailPreview({ subject, body });
    } catch (error) {
      console.error('Error updating preview:', error);
      setEmailPreview({ 
        subject: 'Error generating preview', 
        body: 'There was an error generating the email preview. Please try again.' 
      });
    } finally {
      setIsPreviewLoading(false);
      setIsUpdatingPreview(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (template?.id === 'custom-message') {
      setCustomSubject('Message from Pool Administrator');
      setCustomMessage('This is a custom message from the pool administrator.');
    }
    // Show preview when template is selected
    setShowPreview(true);
    // Wait for state to update before triggering preview
    setTimeout(() => {
      // console.log('Triggering preview update for template:', templateId);
      updatePreview();
    }, 200);
  };

  const handleSendEmails = async () => {
    if (!selectedTemplate) return;
    setIsSending(true);
    try {
      const template = EMAIL_TEMPLATES.find(t => t.id === selectedTemplate);
      if (!template) {
        toast({
          title: 'Error',
          description: 'Template not found',
          variant: 'destructive',
        });
        return;
      }

      const customVariables: Partial<TemplateVariables> = {};
      if (customSubject) customVariables.customSubject = customSubject;
      if (customMessage) customVariables.customMessage = customMessage;
      
      const result = await sendTemplatedEmails({
        poolId,
        poolName,
        weekNumber,
        adminId,
        template,
        customVariables
      });
      
      if (result.success && result.mailtoUrl) {
        // console.log('Mailto URL:', result.mailtoUrl);
        
        // Try multiple approaches to open email client
        try {
          // Method 1: Direct window.open
          const newWindow = window.open(result.mailtoUrl, '_blank');
          
          // Check if popup was blocked
          if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            throw new Error('Popup blocked or failed to open');
          }
          
          toast({
            title: 'Email Client Opened',
            description: `Email prepared for ${result.recipientCount} participants. Your email client should open automatically.`,
          });
        } catch (openError) {
          console.error('Failed to open email client:', openError);
          
          // Method 2: Try with location.href
          try {
            window.location.href = result.mailtoUrl;
            toast({
              title: 'Email Client Opening',
              description: `Email prepared for ${result.recipientCount} participants. Redirecting to email client...`,
            });
          } catch (hrefError) {
            console.error('Failed with location.href:', hrefError);
            
            // Method 3: Copy to clipboard as fallback
            try {
              await navigator.clipboard.writeText(result.mailtoUrl);
              toast({
                title: 'Email URL Copied',
                description: `Email URL copied to clipboard. Paste it in your browser address bar to open your email client.`,
              });
            } catch (clipboardError) {
              console.error('Failed to copy to clipboard:', clipboardError);
              toast({
                title: 'Manual Action Required',
                description: `Please copy this URL and paste it in your browser: ${result.mailtoUrl}`,
                variant: 'destructive',
              });
            }
          }
        }
      } else if (result.success) {
        toast({
          title: 'Error',
          description: 'Email prepared but no mailto URL generated',
          variant: 'destructive',
        });
      } else {
        // Handle specific error cases with better user feedback
        let errorMessage = result.error || 'Failed to prepare emails';
        
        if (result.error === 'No participants match the selected criteria') {
          const template = EMAIL_TEMPLATES.find(t => t.id === selectedTemplate);
          if (template) {
            const targetAudience = template.targetAudience;
            let audienceDescription = '';
            
            switch (targetAudience) {
              case 'submitted':
                audienceDescription = 'participants who have already submitted their picks';
                break;
              case 'not_submitted':
                audienceDescription = 'participants who have not submitted their picks yet';
                break;
              case 'all':
                audienceDescription = 'all participants';
                break;
              default:
                audienceDescription = 'the selected participant group';
            }
            
            errorMessage = `No participants match the criteria for "${template.name}". This template targets ${audienceDescription}.`;
          }
        }
        
        toast({
          title: 'Cannot Send Email',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error sending emails:', error);
      toast({
        title: 'Error',
        description: 'Failed to prepare emails',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: 'Email content copied to clipboard',
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const getTemplateCount = (targetAudience: 'all' | 'submitted' | 'not_submitted') => {
    return EMAIL_TEMPLATES.filter(t => t.targetAudience === targetAudience).length;
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    // Clear selected template when category changes
    setSelectedTemplate('');
    setShowPreview(false);
    setEmailPreview({ subject: '', body: '' });
    setCustomSubject('');
    setCustomMessage('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Email Management</h3>
          <p className="text-sm text-gray-600">
            Send emails to participants using templates
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Mail className="h-3 w-3" />
          {participants.length} Participants
        </Badge>
      </div>

      <Tabs defaultValue="templates" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates">Email Templates</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          {/* Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Email Template</CardTitle>
              <CardDescription>
                Choose a template and customize the message
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category Filter */}
              <div>
                <Label>Filter by Category</Label>
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="welcome">Welcome</SelectItem>
                    <SelectItem value="reminder">Reminders</SelectItem>
                    <SelectItem value="update">Updates</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Template Selection */}
              <div>
                <Label>Email Template</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedCategory === 'all' ? "Select a template" : `Select a ${selectedCategory} template`} />
                  </SelectTrigger>
                  <SelectContent>
                    {getTemplatesByCategory(selectedCategory === 'all' ? undefined : selectedCategory).length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">
                        No templates available for this category
                      </div>
                    ) : (
                      getTemplatesByCategory(selectedCategory === 'all' ? undefined : selectedCategory).map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{template.name}</span>
                            <Badge variant="outline" className="ml-2">
                              {template.targetAudience === 'all' ? 'All' : 
                               template.targetAudience === 'submitted' ? 'Submitted' : 'Not Submitted'}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Template Description */}
              {selectedTemplate && (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      {EMAIL_TEMPLATES.find(t => t.id === selectedTemplate)?.description}
                    </p>
                  </div>
                  
                  {/* Participant Count Warning */}
                  <ParticipantCountWarning 
                    template={EMAIL_TEMPLATES.find(t => t.id === selectedTemplate)}
                    participants={participants}
                    poolId={poolId}
                    weekNumber={weekNumber}
                  />
                </div>
              )}

              {/* Custom Message Fields */}
              {selectedTemplate === 'custom-message' && (
                <div className="space-y-4">
                  <div>
                    <Label>Subject</Label>
                    <Input
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      placeholder="Enter email subject"
                    />
                  </div>
                  <div>
                    <Label>Message</Label>
                    <Textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder="Enter your custom message"
                      rows={6}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Send Button */}
          <Card>
            <CardContent className="pt-6">
              <Button
                onClick={handleSendEmails}
                disabled={!selectedTemplate || isSending}
                className="w-full flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                {isSending ? 'Sending...' : 'Send Emails'}
              </Button>
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> This will open your default email client with all participants in BCC. 
                  This ensures participants cannot see each other&apos;s email addresses.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Email Preview - Inline */}
          {showPreview && selectedTemplate && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Email Preview
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(false)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription>
                  Preview how the email will look to participants
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isPreviewLoading ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p>Generating preview...</p>
                  </div>
                ) : emailPreview.subject ? (
                  <>
                    <div>
                      <Label>Subject</Label>
                      <div className="p-3 bg-gray-50 rounded border">
                        {emailPreview.subject}
                      </div>
                    </div>
                    <div>
                      <Label>Message</Label>
                      <div className="p-3 bg-gray-50 rounded border whitespace-pre-wrap">
                        {emailPreview.body}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleCopyToClipboard(emailPreview.subject)}
                        className="flex items-center gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Copy Subject
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleCopyToClipboard(emailPreview.body)}
                        className="flex items-center gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Copy Message
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Select a template to preview the email</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="participants" className="space-y-6">
          {/* Participant Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{participants.length}</div>
                  <div className="text-sm text-gray-600">Total Participants</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{getTemplateCount('submitted')}</div>
                  <div className="text-sm text-gray-600">Submitted Templates</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{getTemplateCount('not_submitted')}</div>
                  <div className="text-sm text-gray-600">Reminder Templates</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Template Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Template Categories</CardTitle>
              <CardDescription>
                Available templates by target audience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {['all', 'submitted', 'not_submitted'].map((audience) => (
                <div key={audience} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="font-medium capitalize">
                      {audience.replace('_', ' ')} Participants
                    </span>
                  </div>
                  <Badge variant="outline">
                    {getTemplateCount(audience as 'all' | 'submitted' | 'not_submitted')} templates
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
