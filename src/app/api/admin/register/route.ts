import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { emailService } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    console.log('Admin registration started');
    const { email, password, fullName } = await request.json();
    console.log('Registration data received:', { email, fullName });

    // Validate input
    if (!email || !password || !fullName) {
      console.log('Validation failed: missing fields');
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      console.log('Validation failed: password too short');
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    console.log('Supabase service client created');

    // Check if user exists in Supabase Auth
    console.log('Checking if user exists in Supabase Auth...');
    const { data: authUser, error: authCheckError } = await supabase.auth.admin.listUsers();
    
    if (authCheckError) {
      console.error('Error checking auth users:', authCheckError);
      return NextResponse.json(
        { success: false, error: 'Failed to check existing users. Please ensure you have the correct service role key configured.' },
        { status: 500 }
      );
    }

    const existingAuthUser = authUser.users.find(user => user.email === email);
    
    let userId: string;
    
    if (existingAuthUser) {
      console.log('Auth user found:', existingAuthUser.id);
      userId = existingAuthUser.id;
    } else {
      console.log('User does not exist in Supabase Auth, creating new user...');
      
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
        console.error('Error creating auth user:', createAuthError);
        return NextResponse.json(
          { success: false, error: `Failed to create user: ${createAuthError.message}` },
          { status: 500 }
        );
      }

      console.log('Auth user created successfully:', newAuthUser.user.id);
      userId = newAuthUser.user.id;
    }

    // Create admin record in admins table using the user's ID
    console.log('Creating admin record...');
    const { data: newAdmin, error: createError } = await supabase
      .from('admins')
      .insert({
        id: userId, // Use the existing or newly created auth user's ID
        email,
        password_hash: '', // No need to store password hash since we use Supabase Auth
        full_name: fullName,
        is_super_admin: false, // Regular admin by default
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating admin record:', createError);
      
      // If we created a new auth user, try to clean it up
      if (!existingAuthUser) {
        console.log('Cleaning up newly created auth user...');
        try {
          await supabase.auth.admin.deleteUser(userId);
          console.log('Auth user cleanup successful');
        } catch (cleanupError) {
          console.error('Failed to cleanup auth user:', cleanupError);
        }
      }
      
      return NextResponse.json(
        { success: false, error: `Failed to create admin account: ${createError.message}` },
        { status: 500 }
      );
    }

    console.log('Admin record created successfully');

    // Log the admin creation
    try {
      console.log('Logging to audit_logs...');
      await supabase
        .from('audit_logs')
        .insert({
          action: 'create_admin',
          user_id: newAdmin.id,
          entity: 'admin',
          entity_id: newAdmin.id,
          details: JSON.stringify({ email: email, full_name: fullName }),
          created_at: new Date().toISOString()
        });
      console.log('Audit log created successfully');
    } catch (auditError) {
      console.warn('Failed to log admin creation to audit_logs:', auditError);
      // Don't fail the registration if audit logging fails
    }

    // Send email notification to the newly created admin
    try {
      console.log('Sending email notification...');
      const emailSent = await emailService.sendAdminCreationNotification(
        newAdmin.email,
        newAdmin.full_name || 'Unknown',
        'System' // For now, we'll use 'System' as the creator
      );
      
      if (!emailSent) {
        console.warn('Email notification failed, but admin account was created successfully');
      } else {
        console.log('Email notification sent successfully');
      }
    } catch (error) {
      console.error('Failed to send admin creation notification:', error);
      // Don't fail the registration if email fails - just log the error
    }

    console.log('Registration completed successfully, returning success response');
    return NextResponse.json({
      success: true,
      message: existingAuthUser ? 'Admin account created successfully for existing user' : 'Admin account created successfully',
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        full_name: newAdmin.full_name,
        is_super_admin: newAdmin.is_super_admin
      },
      redirect: '/admin/dashboard'
    });

  } catch (error) {
    console.error('Admin registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
