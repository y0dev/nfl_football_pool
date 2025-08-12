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
import { Mail, Users, Send, Copy, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EMAIL_TEMPLATES, EmailTemplate, getTemplatesByCategory } from '@/lib/email-templates';
import { processTemplate, getDefaultVariables, TemplateVariables } from '@/lib/template-processor';
import { loadUsers } from '@/actions/loadUsers';
import { getUsersWhoSubmitted } from '@/actions/checkUserSubmission';
import { sendTemplatedEmails } from '@/actions/sendTemplatedEmails';

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
  const [emailPreview, setEmailPreview] = useState({ subject: '', body: '' });
  const { toast } = useToast();

  useEffect(() => {
    loadParticipants();
  }, [poolId, weekNumber]);

  useEffect(() => {
    if (selectedTemplate) {
      updatePreview();
    }
  }, [selectedTemplate, customSubject, customMessage, selectedParticipants]);

  const loadParticipants = async () => {
    try {
      setIsLoading(true);
      const allParticipants = await loadUsers();
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
      const submittedIds = await getUsersWhoSubmitted(poolId, weekNumber);
      
      if (targetAudience === 'submitted') {
        return participants.filter(p => submittedIds.includes(p.id));
      } else {
        return participants.filter(p => !submittedIds.includes(p.id));
      }
    } catch (error) {
      console.error('Error filtering participants:', error);
      return participants;
    }
  };

  const updatePreview = async () => {
    if (!selectedTemplate) return;

    const template = EMAIL_TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) return;

    const filteredParticipants = await getFilteredParticipants(template.targetAudience);
    if (filteredParticipants.length === 0) return;

    const sampleParticipant = filteredParticipants[0];
    const variables = getDefaultVariables(poolName, poolId, weekNumber, 'Pool Administrator');
    variables.participantName = sampleParticipant.name;

    // Handle custom template
    if (template.id === 'custom-message') {
      variables.customSubject = customSubject;
      variables.customMessage = customMessage;
    }

    const subject = processTemplate(template.subject, variables);
    const body = processTemplate(template.body, variables);

    setEmailPreview({ subject, body });
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (template?.id === 'custom-message') {
      setCustomSubject('Message from Pool Administrator');
      setCustomMessage('This is a custom message from the pool administrator.');
    }
  };

  const handleSendEmails = async () => {
    if (!selectedTemplate) {
      toast({
        title: 'Error',
        description: 'Please select a template',
        variant: 'destructive',
      });
      return;
    }

    const template = EMAIL_TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) return;

    try {
      setIsSending(true);
      
      const customVariables: Partial<TemplateVariables> = {};
      
      // Handle custom template
      if (template.id === 'custom-message') {
        customVariables.customSubject = customSubject;
        customVariables.customMessage = customMessage;
      }

      const result = await sendTemplatedEmails({
        poolId,
        poolName,
        weekNumber,
        adminId,
        template,
        customVariables
      });

      if (result.success) {
        toast({
          title: 'Success',
          description: `Emails sent to ${result.totalSent} participants${(result.totalFailed || 0) > 0 ? ` (${result.totalFailed} failed)` : ''}`,
        });

        // Reset form
        setSelectedTemplate('');
        setCustomSubject('');
        setCustomMessage('');
        setSelectedParticipants([]);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to send emails',
          variant: 'destructive',
        });
      }

    } catch (error) {
      console.error('Error sending emails:', error);
      toast({
        title: 'Error',
        description: 'Failed to send emails',
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="templates">Email Templates</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
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
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
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
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {getTemplatesByCategory(selectedCategory).map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{template.name}</span>
                          <Badge variant="outline" className="ml-2">
                            {template.targetAudience === 'all' ? 'All' : 
                             template.targetAudience === 'submitted' ? 'Submitted' : 'Not Submitted'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template Description */}
              {selectedTemplate && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    {EMAIL_TEMPLATES.find(t => t.id === selectedTemplate)?.description}
                  </p>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          {/* Email Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Email Preview
              </CardTitle>
              <CardDescription>
                Preview how the email will look to participants
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {emailPreview.subject ? (
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
                    {getTemplateCount(audience as any)} templates
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
