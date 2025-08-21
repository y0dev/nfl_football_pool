import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, fullName } = body;

    // Validate required fields
    if (!email || !password || !fullName) {
      return NextResponse.json(
        { success: false, error: 'Email, password, and full name are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Check if admin already exists
    const { data: existingAdmin, error: checkError } = await supabase
      .from('admins')
      .select('id')
      .eq('email', email)
      .single();

    if (existingAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create admin
    const { data: admin, error: createError } = await supabase
      .from('admins')
      .insert({
        email,
        password_hash: hashedPassword,
        full_name: fullName,
        is_super_admin: false,
        is_active: true
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating admin:', createError);
      return NextResponse.json(
        { success: false, error: 'Failed to create admin' },
        { status: 500 }
      );
    }

    // Log the action
    await supabase
      .from('audit_logs')
      .insert({
        action: 'create_admin',
        admin_id: null, // Service role doesn't have specific admin ID
        entity: 'admins',
        entity_id: admin.id,
        details: { 
          admin_email: email,
          admin_name: fullName,
          action: 'admin_created'
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Admin created successfully',
      admin: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        is_super_admin: admin.is_super_admin,
        is_active: admin.is_active
      }
    });

  } catch (error) {
    console.error('Error in create admin API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
