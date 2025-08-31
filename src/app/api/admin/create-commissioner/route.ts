import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { emailService } from '@/lib/email';
import { debugLog } from '@/lib/utils';

export async function POST(request: NextRequest) {
    try {
    debugLog('Create commissioner started');
    const { email, password, fullName } = await request.json();
    debugLog('Commissioner data received:', { email, fullName });

    // Validate input
    if (!email || !password || !fullName) {
      debugLog('Validation failed: missing fields');
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      debugLog('Validation failed: password too short');
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    debugLog('Supabase service client created');

    // Check if user exists in Supabase Auth
    debugLog('Checking if user exists in Supabase Auth...');
    const { data: authUser, error: authCheckError } = await supabase.auth.admin.listUsers();
    
    if (authCheckError) {
      console.error('Error checking auth users:', authCheckError);
      return NextResponse.json(
        { success: false, error: 'Failed to check existing users. Please ensure you have the correct service role key configured.' },
        { status: 500 }
      );
    }

    const existingAuthUser = authUser.users.find(user => user.email === email);
    
    if (existingAuthUser) {
      debugLog('User already exists in Supabase Auth');
      return NextResponse.json(
        { success: false, error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    debugLog('User does not exist in Supabase Auth, creating new user...');
    
    // Create user in Supabase Auth
    const { data: newAuthUser, error: createAuthError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
        role: 'commissioner'
      }
    });

    if (createAuthError) {
      console.error('Error creating auth user:', createAuthError);
      return NextResponse.json(
        { success: false, error: `Failed to create user: ${createAuthError.message}` },
        { status: 500 }
      );
    }

    console.log('Auth user created successfully:', newAuthUser.user.id);

    // Create admin record in admins table using the user's ID
    console.log('Creating admin record...');
    const { data: newAdmin, error: createError } = await supabase
      .from('admins')
      .insert({
        id: newAuthUser.user.id,
        email,
        password_hash: '', // No need to store password hash since we use Supabase Auth
        full_name: fullName,
        is_super_admin: false, // Regular commissioner
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating admin record:', createError);
      
      // Clean up the newly created auth user
      console.log('Cleaning up newly created auth user...');
      try {
        await supabase.auth.admin.deleteUser(newAuthUser.user.id);
        console.log('Auth user cleanup successful');
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError);
      }
      
      return NextResponse.json(
        { success: false, error: `Failed to create commissioner account: ${createError.message}` },
        { status: 500 }
      );
    }

    console.log('Admin record created successfully');

    // Log the commissioner creation
    try {
      console.log('Logging to audit_logs...');
      await supabase
        .from('audit_logs')
        .insert({
          action: 'create_commissioner',
          admin_id: newAdmin.id,
          entity: 'admin',
          entity_id: newAdmin.id,
          details: { email: email, full_name: fullName }
        });
      console.log('Audit log created successfully');
    } catch (auditError) {
      console.warn('Failed to log commissioner creation to audit_logs:', auditError);
      // Don't fail the creation if audit logging fails
    }

    // Send email notification to the newly created commissioner
    try {
      console.log('Sending email notification...');
      const emailSent = await emailService.sendAdminCreationNotification(
        newAdmin.email,
        newAdmin.full_name || 'Unknown',
        'System' // For now, we'll use 'System' as the creator
      );
      
      if (!emailSent) {
        console.warn('Email notification failed, but commissioner account was created successfully');
      } else {
        console.log('Email notification sent successfully');
      }
    } catch (error) {
      console.error('Failed to send commissioner creation notification:', error);
      // Don't fail the creation if email fails - just log the error
    }

    console.log('Commissioner creation completed successfully, returning success response');
    return NextResponse.json({
      success: true,
      message: 'Commissioner created successfully',
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        full_name: newAdmin.full_name,
        is_super_admin: newAdmin.is_super_admin
      }
    });

  } catch (error) {
    console.error('Create commissioner error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
