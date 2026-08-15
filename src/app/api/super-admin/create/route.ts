import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import bcrypt from 'bcryptjs';
import { debugError } from '@/lib/utils';
import { validateEmail } from '@/lib/email-validation';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

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

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { success: false, error: emailCheck.error },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Despite the route name/path, this always creates a commissioner
    // (dev-only debug tooling — duplicates create-commissioner).
    const { data: existingAdmin, error: checkError } = await supabase
      .from('commissioners')
      .select('id')
      .eq('email', email)
      .single();

    if (existingAdmin) {
      return NextResponse.json(
        { success: false, error: 'Commissioner with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create commissioner
    const { data: admin, error: createError } = await supabase
      .from('commissioners')
      .insert({
        email,
        password_hash: hashedPassword,
        full_name: fullName,
        is_active: true
      })
      .select()
      .single();

    if (createError) {
      debugError('Error creating admin:', createError);
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
        is_super_admin: false,
        is_active: admin.is_active
      }
    });

  } catch (error) {
    debugError('Error in create admin API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
