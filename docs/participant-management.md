# Participant Management Guide

## Overview

The Participant Management system allows admins to efficiently manage participants in their NFL Confidence Pools. This feature is accessible through the Admin Dashboard under the "Participants" tab.

## Features

### 1. Individual Participant Management

#### Adding a Single Participant
- Click the **"Add User"** button in the Participants tab
- Fill in the participant's name (required)
- Optionally add an email address
- Click **"Add User"** to save

#### Removing a Participant
- Find the participant in the list
- Click the **"Remove"** button next to their name
- Confirm the removal in the popup dialog

### 2. Bulk Operations

#### Bulk Add Participants
- Click the **"Bulk Add"** button
- Enter participant names, one per line:
  ```
  John Doe
  Jane Smith
  Mike Johnson
  ```
- Click **"Add Participants"** to add all at once

#### Bulk Remove Participants
- Use the checkboxes to select multiple participants
- Click **"Remove Selected (X)"** button
- Confirm the bulk removal

#### Select All/None
- Use the checkbox in the table header to select/deselect all visible participants

### 3. Search and Filter

#### Search Participants
- Use the search box to find participants by name or email
- Search is case-insensitive and works in real-time
- Results update as you type

### 4. Export Functionality

#### Export Participant List
- Click the **"Export"** button to download a CSV file
- The file includes: Name, Email, Joined Date, and Status
- File is named: `{PoolName}-participants.csv`

## User Interface

### Table Columns
- **Checkbox**: Select participants for bulk operations
- **Name**: Participant's full name
- **Email**: Participant's email address (if provided)
- **Joined**: Date when participant was added to the pool
- **Status**: Active/Inactive status
- **Actions**: Remove button for individual participants

### Status Indicators
- **Active**: Participant is currently in the pool
- **Inactive**: Participant has been removed from the pool

## Best Practices

### Adding Participants
1. **Use clear, consistent naming**: Use full names for easy identification
2. **Include emails when possible**: Helps with communication and account recovery
3. **Bulk add for large groups**: Use the bulk add feature for adding multiple participants at once

### Managing Participants
1. **Search before adding**: Check if a participant already exists
2. **Use bulk operations**: Select multiple participants for efficient management
3. **Export regularly**: Keep backups of your participant lists

### Removing Participants
1. **Confirm before removing**: Double-check participant names before removal
2. **Use bulk remove carefully**: Verify all selected participants before bulk removal
3. **Consider deactivation**: Participants are marked as inactive rather than deleted

## Technical Details

### Database Operations
- Participants are stored in the `participants` table
- Removal sets `is_active = false` rather than deleting records
- All operations are logged in the `audit_logs` table

### Security
- Only admins can add/remove participants
- All actions are logged for audit purposes
- Row-level security ensures data protection

### Performance
- Search is performed client-side for fast results
- Bulk operations are processed sequentially to avoid database conflicts
- Export generates CSV files in the browser for immediate download

## Troubleshooting

### Common Issues

**"Failed to add participant"**
- Check if the name is already in use
- Ensure the pool ID is valid
- Verify database connection

**"Failed to remove participant"**
- Check if participant has active picks
- Ensure you have admin permissions
- Verify the participant ID is valid

**Search not working**
- Clear the search box and try again
- Check for extra spaces in search terms
- Ensure the participant list has loaded

### Getting Help
- Check the browser console for error messages
- Verify your admin permissions
- Contact your super administrator if issues persist

## API Endpoints

The participant management uses the following API endpoints:

- `GET /api/admin/participants/{poolId}` - Get pool participants
- `POST /api/admin/participants` - Add participant to pool
- `DELETE /api/admin/participants/{participantId}` - Remove participant from pool

All endpoints require admin authentication and proper authorization.
