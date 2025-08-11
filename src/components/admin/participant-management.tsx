'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, Loader2 } from 'lucide-react';
import { getPoolParticipants, removeParticipantFromPool } from '@/actions/adminActions';
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
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadParticipants();
  }, [poolId]);

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

  const activeParticipants = participants.filter(p => p.is_active);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <span>Pool Participants</span>
              <Badge variant="secondary">{activeParticipants.length}</Badge>
            </CardTitle>
            <CardDescription>
              Manage participants in {poolName}
            </CardDescription>
          </div>
          <AddUserDialog 
            poolId={poolId} 
            poolName={poolName} 
            onUserAdded={loadParticipants}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">Name</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Email</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Joined</TableHead>
                  <TableHead className="text-xs sm:text-sm">Status</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeParticipants.map((participant) => (
                  <TableRow key={participant.id}>
                    <TableCell className="font-medium text-xs sm:text-sm">
                      {participant.name}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs sm:text-sm">
                      {participant.email || (
                        <span className="text-gray-400 italic">No email</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs sm:text-sm">
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
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500 text-sm">
                      No participants yet. Add some users to get started!
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
