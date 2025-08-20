'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, Loader2, Plus, Search, Users, Download, Upload, Edit, Save, X } from 'lucide-react';
import { getPoolParticipants, removeParticipantFromPool, addParticipantToPool, updateParticipantName } from '@/actions/adminActions';
import { AddUserDialog } from './add-user-dialog';
import { useToast } from '@/hooks/use-toast';

interface Participant {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
  is_active: boolean;
}

interface ParticipantManagementProps {
  poolId: string;
  poolName: string;
}

export function ParticipantManagement({ poolId, poolName }: ParticipantManagementProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [bulkAddDialogOpen, setBulkAddDialogOpen] = useState(false);
  const [bulkAddText, setBulkAddText] = useState('');
  const [bulkAddWithEmail, setBulkAddWithEmail] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadParticipants();
  }, [poolId]);

  useEffect(() => {
    // Filter participants based on search term
    const filtered = participants.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredParticipants(filtered);
  }, [participants, searchTerm]);

  const loadParticipants = async () => {
    setIsLoading(true);
    try {
      const data = await getPoolParticipants(poolId);
      setParticipants(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load participants",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveParticipant = async (participantId: string, participantName: string) => {
    if (!confirm(`Are you sure you want to remove ${participantName} from the pool?`)) {
      return;
    }

    try {
      await removeParticipantFromPool(participantId);
      toast({
        title: "Success",
        description: `${participantName} has been removed from the pool`,
      });
      loadParticipants(); // Refresh the list
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove participant",
        variant: "destructive",
      });
    }
  };

  const handleBulkRemove = async () => {
    if (selectedParticipants.length === 0) {
      toast({
        title: "Warning",
        description: "Please select participants to remove",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Are you sure you want to remove ${selectedParticipants.length} participant(s) from the pool?`)) {
      return;
    }

    try {
      for (const participantId of selectedParticipants) {
        await removeParticipantFromPool(participantId);
      }
      
      toast({
        title: "Success",
        description: `${selectedParticipants.length} participant(s) have been removed from the pool`,
      });
      
      setSelectedParticipants([]);
      loadParticipants(); // Refresh the list
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove some participants",
        variant: "destructive",
      });
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkAddText.trim()) {
      toast({
        title: "Error",
        description: "Please enter participant data",
        variant: "destructive",
      });
      return;
    }

    const lines = bulkAddText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      toast({
        title: "Error",
        description: "No valid data found",
        variant: "destructive",
      });
      return;
    }

    try {
      for (const line of lines) {
        if (bulkAddWithEmail) {
          // Format: "Name,email@example.com" or "Name email@example.com"
          const parts = line.includes(',') ? line.split(',') : line.split(' ');
          const name = parts[0]?.trim();
          const email = parts[1]?.trim() || '';
          
          if (name) {
            await addParticipantToPool(poolId, name, email);
          }
        } else {
          // Just names, one per line
          await addParticipantToPool(poolId, line, '');
        }
      }
      
      toast({
        title: "Success",
        description: `${lines.length} participant(s) have been added to the pool`,
      });
      
      setBulkAddText('');
      setBulkAddWithEmail(false);
      setBulkAddDialogOpen(false);
      loadParticipants(); // Refresh the list
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add some participants",
        variant: "destructive",
      });
    }
  };

  const handleStartEdit = (participant: Participant) => {
    setEditingParticipant(participant.id);
    setEditName(participant.name);
  };

  const handleCancelEdit = () => {
    setEditingParticipant(null);
    setEditName('');
  };

  const handleSaveEdit = async () => {
    if (!editingParticipant || !editName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid name",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUpdating(true);
      await updateParticipantName(editingParticipant, editName.trim());
      
      toast({
        title: "Success",
        description: "Participant name updated successfully",
      });
      
      setEditingParticipant(null);
      setEditName('');
      loadParticipants(); // Refresh the list
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update participant name",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedParticipants.length === filteredParticipants.length) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(filteredParticipants.map(p => p.id));
    }
  };

  const handleSelectParticipant = (participantId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(participantId) 
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    );
  };

  const exportParticipants = () => {
    const csvContent = [
      ['Name', 'Email', 'Joined Date', 'Status'],
      ...filteredParticipants.map(p => [
        p.name,
        p.email || '',
        new Date(p.created_at).toLocaleDateString(),
        p.is_active ? 'Active' : 'Inactive'
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${poolName}-participants.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const addTestParticipants = async () => {
    const testParticipants = [
      { name: 'John Smith', email: 'john.smith@example.com' },
      { name: 'Sarah Johnson', email: 'sarah.johnson@example.com' },
      { name: 'Mike Davis', email: 'mike.davis@example.com' },
      { name: 'Lisa Wilson', email: 'lisa.wilson@example.com' },
      { name: 'David Brown', email: 'david.brown@example.com' }
    ];

    try {
      for (const participant of testParticipants) {
        await addParticipantToPool(poolId, participant.name, participant.email);
      }
      
      toast({
        title: "Success",
        description: `Added ${testParticipants.length} test participants to the pool`,
      });
      
      loadParticipants(); // Refresh the list
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add some test participants",
        variant: "destructive",
      });
    }
  };

  const activeParticipants = filteredParticipants.filter(p => p.is_active);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Pool Participants</span>
              <Badge variant="secondary">{activeParticipants.length}</Badge>
            </CardTitle>
            <CardDescription>
              Manage participants in {poolName}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {process.env.NEXT_PUBLIC_NODE_ENV === 'development' && (
              <Button
                variant="outline"
                size="sm"
                onClick={addTestParticipants}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Add Test Data</span>
                <span className="sm:hidden">Test</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={exportParticipants}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
              <span className="sm:hidden">Export</span>
            </Button>
            <Dialog open={bulkAddDialogOpen} onOpenChange={setBulkAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Bulk Add</span>
                  <span className="sm:hidden">Bulk</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Bulk Add Participants</DialogTitle>
                  <DialogDescription>
                    Add multiple participants at once. Choose your format below.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="bulk-with-email"
                      checked={bulkAddWithEmail}
                      onChange={(e) => setBulkAddWithEmail(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="bulk-with-email">Include email addresses</Label>
                  </div>
                  <div>
                    <Label htmlFor="bulk-names">
                      {bulkAddWithEmail ? 'Participant Data (one per line)' : 'Participant Names (one per line)'}
                    </Label>
                    <textarea
                      id="bulk-names"
                      value={bulkAddText}
                      onChange={(e) => setBulkAddText(e.target.value)}
                      placeholder={
                        bulkAddWithEmail 
                          ? "John Doe,john@example.com\nJane Smith jane@example.com\nMike Johnson"
                          : "John Doe\nJane Smith\nMike Johnson"
                      }
                      className="w-full h-32 p-3 border rounded-md resize-none"
                    />
                    {bulkAddWithEmail && (
                      <p className="text-xs text-gray-500 mt-1">
                        Format: &quot;Name,email@example.com&quot; or &quot;Name email@example.com&quot;
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setBulkAddDialogOpen(false);
                    setBulkAddText('');
                    setBulkAddWithEmail(false);
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleBulkAdd}>
                    Add Participants
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <AddUserDialog 
              poolId={poolId} 
              poolName={poolName} 
              onUserAdded={loadParticipants}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search and Bulk Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search participants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {selectedParticipants.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkRemove}
              className="flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Remove Selected ({selectedParticipants.length})</span>
              <span className="sm:hidden">Remove {selectedParticipants.length}</span>
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedParticipants.length === filteredParticipants.length && filteredParticipants.length > 0}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">Name</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden md:table-cell">Email</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Joined</TableHead>
                  <TableHead className="text-xs sm:text-sm">Status</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeParticipants.map((participant) => (
                  <TableRow key={participant.id} className="group">
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedParticipants.includes(participant.id)}
                        onChange={() => handleSelectParticipant(participant.id)}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell className="font-medium text-xs sm:text-sm">
                      {editingParticipant === participant.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 text-xs sm:text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEdit();
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={isUpdating}
                            className="h-8 px-2"
                          >
                            {isUpdating ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                            className="h-8 px-2"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[120px] sm:max-w-none">{participant.name}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEdit(participant)}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs sm:text-sm">
                      {participant.email || (
                        <span className="text-gray-400 italic">No email</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs sm:text-sm">
                      {new Date(participant.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveParticipant(participant.id, participant.name)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="hidden sm:inline">Remove</span>
                        <span className="sm:hidden">X</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {activeParticipants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="space-y-4">
                        <div className="text-gray-500 text-sm">
                          {searchTerm ? 'No participants match your search.' : 'No participants yet.'}
                        </div>
                        {!searchTerm && (
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">
                              Add participants to your pool so they can make picks:
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2 justify-center">
                              <AddUserDialog 
                                poolId={poolId} 
                                poolName={poolName} 
                                onUserAdded={loadParticipants}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setBulkAddDialogOpen(true)}
                                className="flex items-center gap-2"
                              >
                                <Upload className="h-4 w-4" />
                                Bulk Add
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
