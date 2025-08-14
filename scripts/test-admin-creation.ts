import { getSupabaseClient } from '../src/lib/supabase';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

async function testAdminCreation() {
  console.log('🧪 Testing Admin Creation...');
  console.log('');

  try {
    const supabase = getSupabaseClient();

    // Test data
    const testAdmin = {
      email: 'testadmin@example.com',
      password: 'testpassword123',
      fullName: 'Test Admin User'
    };

    console.log('📝 Test Admin Data:');
    console.log(`  Email: ${testAdmin.email}`);
    console.log(`  Name: ${testAdmin.fullName}`);
    console.log(`  Password: ${testAdmin.password}`);
    console.log('');

    // Check if admin already exists
    console.log('🔍 Checking if admin already exists...');
    const { data: existingAdmin, error: checkError } = await supabase
      .from('admins')
      .select('id, email, full_name, is_active')
      .eq('email', testAdmin.email)
      .single();

    if (existingAdmin) {
      console.log('⚠️  Admin already exists:');
      console.log(`  ID: ${existingAdmin.id}`);
      console.log(`  Name: ${existingAdmin.full_name}`);
      console.log(`  Active: ${existingAdmin.is_active}`);
      console.log('');
      
      // Test updating the admin
      console.log('🔄 Testing admin update...');
      const { error: updateError } = await supabase
        .from('admins')
        .update({ 
          full_name: testAdmin.fullName + ' (Updated)',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAdmin.id);

      if (updateError) {
        console.log('❌ Failed to update admin:', updateError.message);
      } else {
        console.log('✅ Admin updated successfully');
      }
    } else {
      console.log('✅ Admin does not exist, proceeding with creation...');
      console.log('');

      // Hash password
      console.log('🔐 Hashing password...');
      const passwordHash = await bcrypt.hash(testAdmin.password, 12);
      console.log('✅ Password hashed successfully');
      console.log('');

      // Create admin account
      console.log('👤 Creating admin account...');
      const { data: newAdmin, error: createError } = await supabase
        .from('admins')
        .insert({
          id: randomUUID(),
          email: testAdmin.email,
          password_hash: passwordHash,
          full_name: testAdmin.fullName,
          is_super_admin: false,
          is_active: true,
        })
        .select()
        .single();

      if (createError) {
        console.log('❌ Failed to create admin:', createError.message);
        return;
      }

      console.log('✅ Admin created successfully:');
      console.log(`  ID: ${newAdmin.id}`);
      console.log(`  Email: ${newAdmin.email}`);
      console.log(`  Name: ${newAdmin.full_name}`);
      console.log(`  Super Admin: ${newAdmin.is_super_admin}`);
      console.log(`  Active: ${newAdmin.is_active}`);
      console.log('');

      // Test password verification
      console.log('🔐 Testing password verification...');
      const isValidPassword = await bcrypt.compare(testAdmin.password, newAdmin.password_hash);
      console.log(`  Password valid: ${isValidPassword ? '✅ Yes' : '❌ No'}`);
      console.log('');

      // Log the admin creation
      console.log('📝 Logging admin creation...');
      const { error: logError } = await supabase
        .from('audit_logs')
        .insert({
          action: 'test_create_admin',
          admin_id: newAdmin.id,
          entity: 'admin',
          entity_id: newAdmin.id,
          details: `Test admin creation for ${testAdmin.email}`
        });

      if (logError) {
        console.log('⚠️  Failed to log admin creation:', logError.message);
      } else {
        console.log('✅ Admin creation logged successfully');
      }
      console.log('');

      // Test admin login simulation
      console.log('🔑 Testing admin login simulation...');
      const { data: loginAdmin, error: loginError } = await supabase
        .from('admins')
        .select('id, email, full_name, is_active')
        .eq('email', testAdmin.email)
        .eq('is_active', true)
        .single();

      if (loginError || !loginAdmin) {
        console.log('❌ Login simulation failed:', loginError?.message || 'Admin not found');
      } else {
        console.log('✅ Login simulation successful:');
        console.log(`  Logged in as: ${loginAdmin.full_name}`);
        console.log(`  Email: ${loginAdmin.email}`);
      }
    }

    console.log('');
    console.log('🎉 Admin creation test completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('  1. Test the admin login at /admin/login');
    console.log('  2. Verify email notification was sent');
    console.log('  3. Test admin dashboard access');
    console.log('  4. Test pool management functionality');

  } catch (error) {
    console.error('❌ Fatal error during admin creation test:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('🧪 Admin Creation Test - Help');
  console.log('');
  console.log('Usage: npm run test-admin-creation');
  console.log('');
  console.log('This script tests:');
  console.log('  • Admin account creation');
  console.log('  • Password hashing and verification');
  console.log('  • Database operations');
  console.log('  • Audit logging');
  console.log('  • Login simulation');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h    Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  npm run test-admin-creation');
  console.log('  npm run test-admin-creation -- --help');
  process.exit(0);
}

// Run the test
testAdminCreation();
