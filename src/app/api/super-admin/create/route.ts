import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName } = await request.json();

    // Validate input
    if (!email || !password || !fullName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Check if admin already exists
    const { data: existingAdmin, error: checkError } = await supabase
      .from('admins')
      .select('id')
      .eq('email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing admin:', checkError);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }

    if (existingAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create super admin account
    const { data: newAdmin, error: createError } = await supabase
      .from('admins')
      .insert({
        id: randomUUID(),
        email,
        password_hash: passwordHash,
        full_name: fullName,
        is_super_admin: true, // Super admin
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating super admin:', createError);
      return NextResponse.json(
        { success: false, error: 'Failed to create super admin account' },
        { status: 500 }
      );
    }

    // Log the super admin creation
    await supabase
      .from('audit_logs')
      .insert({
        action: 'create_super_admin',
        admin_id: newAdmin.id,
        entity: 'admin',
        entity_id: newAdmin.id,
        details: `Created super admin account for ${email}`
      });

    return NextResponse.json({
      success: true,
      message: 'Super admin account created successfully',
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        full_name: newAdmin.full_name,
        is_super_admin: newAdmin.is_super_admin
      }
    });

  } catch (error) {
    console.error('Super admin creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
