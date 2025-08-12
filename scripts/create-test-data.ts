import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
  console.error('');
  console.error('Please check your .env.local file and ensure these variables are set.');
  process.exit(1);
}

// Create Supabase client using the service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface AdminUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  avatar_url?: string;
  is_super_admin: boolean;
  is_active: boolean;
}

interface Participant {
  id: string;
  pool_id: string;
  name: string;
  email: string;
  is_active: boolean;
}

interface Pool {
  id: string;
  name: string;
  logo_url?: string;
  created_by: string;
  season: number;
  is_active: boolean;
}

// Test data configuration
const TEST_CONFIG = {
  admins: [
    {
      email: 'admin@test.com',
      password: 'admin123',
      full_name: 'Test Admin',
      is_super_admin: true
    },
    {
      email: 'superadmin@test.com',
      password: 'super123',
      full_name: 'Super Admin',
      is_super_admin: true
    },
    {
      email: 'pooladmin@test.com',
      password: 'pool123',
      full_name: 'Pool Admin',
      is_super_admin: false
    }
  ],
  pools: [
    {
      name: 'Test Pool 2025',
      season: 2025,
      created_by: 'admin@test.com'
    },
    {
      name: 'Family Pool',
      season: 2025,
      created_by: 'admin@test.com'
    },
    {
      name: 'Work Pool',
      season: 2025,
      created_by: 'pooladmin@test.com'
    }
  ],
  participants: [
    // Test Pool 2025 participants (including admin)
    { name: 'Test Admin', email: 'admin@test.com', pool_name: 'Test Pool 2025' },
    { name: 'John Smith', email: 'john.smith@test.com', pool_name: 'Test Pool 2025' },
    { name: 'Jane Doe', email: 'jane.doe@test.com', pool_name: 'Test Pool 2025' },
    { name: 'Mike Johnson', email: 'mike.johnson@test.com', pool_name: 'Test Pool 2025' },
    { name: 'Sarah Wilson', email: 'sarah.wilson@test.com', pool_name: 'Test Pool 2025' },
    { name: 'David Brown', email: 'david.brown@test.com', pool_name: 'Test Pool 2025' },
    
    // Family Pool participants (including admin)
    { name: 'Test Admin', email: 'admin@test.com', pool_name: 'Family Pool' },
    { name: 'Dad', email: 'dad@family.com', pool_name: 'Family Pool' },
    { name: 'Mom', email: 'mom@family.com', pool_name: 'Family Pool' },
    { name: 'Son', email: 'son@family.com', pool_name: 'Family Pool' },
    { name: 'Daughter', email: 'daughter@family.com', pool_name: 'Family Pool' },
    { name: 'Uncle Bob', email: 'uncle.bob@family.com', pool_name: 'Family Pool' },
    
    // Work Pool participants (including pool admin)
    { name: 'Pool Admin', email: 'pooladmin@test.com', pool_name: 'Work Pool' },
    { name: 'Alice Manager', email: 'alice.manager@work.com', pool_name: 'Work Pool' },
    { name: 'Bob Developer', email: 'bob.developer@work.com', pool_name: 'Work Pool' },
    { name: 'Carol Designer', email: 'carol.designer@work.com', pool_name: 'Work Pool' },
    { name: 'Dave QA', email: 'dave.qa@work.com', pool_name: 'Work Pool' },
    { name: 'Eve Product', email: 'eve.product@work.com', pool_name: 'Work Pool' }
  ]
};

async function createTestData() {
  console.log('🧪 Creating test data for NFL Confidence Pool...');
  console.log('');

  try {
    // Step 1: Create admin users with password hashes
    console.log('👥 Creating admin users...');
    const adminUsers: AdminUser[] = [];
    
    for (const adminData of TEST_CONFIG.admins) {
      const passwordHash = await bcrypt.hash(adminData.password, 10);
      
      const adminUser: AdminUser = {
        id: randomUUID(),
        email: adminData.email,
        password_hash: passwordHash,
        full_name: adminData.full_name,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${adminData.email}`,
        is_super_admin: adminData.is_super_admin,
        is_active: true
      };
      
      const { error } = await supabase
        .from('admins')
        .upsert(adminUser, { onConflict: 'email' });
      
      if (error) {
        console.error(`❌ Error creating admin ${adminData.email}:`, error);
      } else {
        adminUsers.push(adminUser);
        console.log(`✅ Created admin: ${adminData.full_name} (${adminData.email}) - Password: ${adminData.password}`);
      }
    }
    
    console.log(`📊 Created ${adminUsers.length} admin users`);
    console.log('');

    // Step 2: Create pools
    console.log('🏈 Creating pools...');
    const pools: Pool[] = [];
    
    for (const poolData of TEST_CONFIG.pools) {
      const pool: Pool = {
        id: randomUUID(),
        name: poolData.name,
        logo_url: `https://api.dicebear.com/7.x/shapes/svg?seed=${poolData.name}`,
        created_by: poolData.created_by,
        season: poolData.season,
        is_active: true
      };
      
      const { error } = await supabase
        .from('pools')
        .insert(pool);
      
      if (error) {
        console.error(`❌ Error creating pool ${poolData.name}:`, error);
      } else {
        pools.push(pool);
        console.log(`✅ Created pool: ${poolData.name} (Season ${poolData.season})`);
      }
    }
    
    console.log(`📊 Created ${pools.length} pools`);
    console.log('');

    // Step 3: Create admin_pools relationships
    console.log('🔗 Linking admins to pools...');
    let adminPoolCount = 0;
    
    for (const pool of pools) {
      const adminUser = adminUsers.find(admin => admin.email === pool.created_by);
      if (adminUser) {
        const { error } = await supabase
          .from('admin_pools')
          .insert({
            admin_id: adminUser.id,
            pool_id: pool.id,
            is_owner: true
          });
        
        if (error) {
          console.error(`❌ Error linking admin to pool ${pool.name}:`, error);
        } else {
          adminPoolCount++;
          console.log(`✅ Linked ${adminUser.full_name} to ${pool.name}`);
        }
      }
    }
    
    console.log(`📊 Created ${adminPoolCount} admin-pool relationships`);
    console.log('');

    // Step 4: Create participants (including admins as participants)
    console.log('👤 Creating participants...');
    const participants: Participant[] = [];
    
    for (const participantData of TEST_CONFIG.participants) {
      const pool = pools.find(p => p.name === participantData.pool_name);
      if (!pool) {
        console.error(`❌ Pool not found: ${participantData.pool_name}`);
        continue;
      }
      
      const participant: Participant = {
        id: randomUUID(),
        pool_id: pool.id,
        name: participantData.name,
        email: participantData.email,
        is_active: true
      };
      
      const { error } = await supabase
        .from('participants')
        .insert(participant);
      
      if (error) {
        console.error(`❌ Error creating participant ${participantData.email}:`, error);
      } else {
        participants.push(participant);
        console.log(`✅ Created participant: ${participantData.name} (${participantData.email}) in ${participantData.pool_name}`);
      }
    }
    
    console.log(`📊 Created ${participants.length} participants`);
    console.log('');

    // Step 5: Summary
    console.log('🎉 Test data creation complete!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`   👥 Admin Users: ${adminUsers.length}`);
    console.log(`   🏈 Pools: ${pools.length}`);
    console.log(`   🔗 Admin-Pool Links: ${adminPoolCount}`);
    console.log(`   👤 Participants: ${participants.length}`);
    console.log('');
    console.log('🔑 Admin Login Credentials:');
    adminUsers.forEach(admin => {
      const adminData = TEST_CONFIG.admins.find(a => a.email === admin.email);
      console.log(`   📧 ${admin.email} (${admin.is_super_admin ? 'Super Admin' : 'Admin'})`);
      console.log(`      Password: ${adminData?.password}`);
    });
    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Start the application: npm run dev');
    console.log('   2. Login with any admin email and password above');
    console.log('   3. Navigate to the admin dashboard');
    console.log('   4. Test participant management and pool features');
    console.log('   5. Admins can also participate in their pools!');
    console.log('');
    console.log('💡 Note: All test data uses placeholder emails. In a real application,');
    console.log('   you would want to use real email addresses for notifications.');

  } catch (error) {
    console.error('❌ Fatal error during test data creation:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('🧪 Test Data Creator - Help');
  console.log('');
  console.log('Usage: npm run create-test-data');
  console.log('');
  console.log('This script creates:');
  console.log('  • 3 admin users (2 super admins, 1 regular admin) with passwords');
  console.log('  • 3 pools (Test Pool, Family Pool, Work Pool)');
  console.log('  • 18 participants across the pools (including admins as participants)');
  console.log('  • Admin-pool relationships');
  console.log('');
  console.log('Admin Passwords:');
  console.log('  • admin@test.com: admin123');
  console.log('  • superadmin@test.com: super123');
  console.log('  • pooladmin@test.com: pool123');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h    Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  npm run create-test-data');
  console.log('  npm run create-test-data -- --help');
  process.exit(0);
}

// Run the script
createTestData();
