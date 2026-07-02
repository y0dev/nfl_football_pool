import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { emailService } from '@/lib/email';
import { debugLog, debugError, debugWarn } from '@/lib/utils';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    debugLog('Admin registration started');
    const { email, password, fullName } = await request.json();
    debugLog('Registration data received:', { email, fullName });

    // Validate input
    if (!email || !password || !fullName) {
      debugLog('Validation failed: missing fields');
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      debugLog('Validation failed: password too short');
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    debugLog('Supabase service client created');

    // Check if user exists in Supabase Auth
    debugLog('Checking if user exists in Supabase Auth...');
    const { data: authUser, error: authCheckError } = await supabase.auth.admin.listUsers();
    
    if (authCheckError) {
      debugError('Error checking auth users:', authCheckError);
      return NextResponse.json(
        { success: false, error: 'Failed to check existing users. Please ensure you have the correct service role key configured.' },
        { status: 500 }
      );
    }

    const existingAuthUser = authUser.users.find(user => user.email === email);
    
    let userId: string;
    
    if (existingAuthUser) {
      debugLog('Auth user found:', existingAuthUser.id);
      userId = existingAuthUser.id;
    } else {
      debugLog('User does not exist in Supabase Auth, creating new user...');
      
      // Create user in Supabase Auth
      const { data: newAuthUser, error: createAuthError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: fullName,
          role: 'admin'
        }
      });

      if (createAuthError) {
        debugError('Error creating auth user:', createAuthError);
        return NextResponse.json(
          { success: false, error: `Failed to create user: ${createAuthError.message}` },
          { status: 500 }
        );
      }

      debugLog('Auth user created successfully:', newAuthUser.user.id);
      userId = newAuthUser.user.id;
    }

    // Create admin record in admins table using the user's ID
    debugLog('Creating admin record...');
    const { data: newAdmin, error: createError } = await supabase
      .from('admins')
      .insert({
        id: userId, // Use the existing or newly created auth user's ID
        email,
        password_hash: '', // No need to store password hash since we use Supabase Auth
        full_name: fullName,
        is_super_admin: false, // Regular commissioner by default
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      debugError('Error creating admin record:', createError);
      
      // If we created a new auth user, try to clean it up
      if (!existingAuthUser) {
        debugLog('Cleaning up newly created auth user...');
        try {
          await supabase.auth.admin.deleteUser(userId);
          debugLog('Auth user cleanup successful');
        } catch (cleanupError) {
          debugError('Failed to cleanup auth user:', cleanupError);
        }
      }
      
      return NextResponse.json(
        { success: false, error: `Failed to create commissioner account: ${createError.message}` },
        { status: 500 }
      );
    }

    debugLog('Admin record created successfully');

    // Set plan fields — non-critical, silently skipped if columns don't exist yet
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);
    await supabase.from('admins')
      .update({ plan: 'free', trial_ends_at: trialEndsAt.toISOString() })
      .eq('id', newAdmin.id);

    // Log the admin creation
    try {
      debugLog('Logging to audit_logs...');
      await supabase
        .from('audit_logs')
        .insert({
          action: 'create_admin',
          admin_id: newAdmin.id,
          entity: 'admin',
          entity_id: newAdmin.id,
          details: { email: email, full_name: fullName }
        });
      debugLog('Audit log created successfully');
    } catch (auditError) {
      debugWarn('Failed to log admin creation to audit_logs:', auditError);
      // Don't fail the registration if audit logging fails
    }

    // Send email notification to the newly created admin
    try {
      debugLog('Sending email notification...');
      const emailSent = await emailService.sendAdminCreationNotification(
        newAdmin.email,
        newAdmin.full_name || 'Unknown',
        'System' // For now, we'll use 'System' as the creator
      );
      
      if (!emailSent) {
        debugWarn('Email notification failed, but commissioner account was created successfully');
      } else {
        debugLog('Email notification sent successfully');
      }
    } catch (error) {
      debugError('Failed to send admin creation notification:', error);
      // Don't fail the registration if email fails - just log the error
    }

    debugLog('Registration completed successfully, returning success response');
    return NextResponse.json({
      success: true,
                message: existingAuthUser ? 'Commissioner account created successfully for existing user' : 'Commissioner account created successfully',
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        full_name: newAdmin.full_name,
        is_super_admin: newAdmin.is_super_admin
      },
      redirect: '/admin/dashboard'
    });

  } catch (error) {
    debugError('Admin registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
