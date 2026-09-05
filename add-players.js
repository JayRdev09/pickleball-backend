const { supabaseAdmin } = require('./src/config/supabase');

const players = [
    { email: 'player6@test.com', full_name: 'Player 6', username: 'player6' },
    { email: 'player7@test.com', full_name: 'Player 7', username: 'player7' },
    { email: 'player8@test.com', full_name: 'Player 8', username: 'player8' },
    { email: 'player9@test.com', full_name: 'Player 9', username: 'player9' },
    { email: 'player10@test.com', full_name: 'Player 10', username: 'player10' },
    { email: 'player11@test.com', full_name: 'Player 11', username: 'player11' },
    { email: 'player12@test.com', full_name: 'Player 12', username: 'player12' },
    { email: 'player13@test.com', full_name: 'Player 13', username: 'player13' },
    { email: 'player14@test.com', full_name: 'Player 14', username: 'player14' },
    { email: 'player15@test.com', full_name: 'Player 15', username: 'player15' },
];

async function addPlayers() {
    console.log(`📝 Adding ${players.length} players...\n`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const player of players) {
        try {
            console.log(`🔄 Creating: ${player.email}...`);
            
            // Create auth user using admin API
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email: player.email,
                password: 'password123',
                email_confirm: true,
                user_metadata: {
                    full_name: player.full_name,
                    username: player.username,
                    role: 'player'
                }
            });
            
            if (authError) {
                console.error(`❌ Failed to create ${player.email}:`, authError.message);
                failCount++;
                continue;
            }
            
            const userId = authData.user.id;
            console.log(`✅ Created user: ${player.email} (${userId})`);
            
            // Profile is auto-created by the database trigger
            // Player skills is auto-created by the database trigger
            successCount++;
            
        } catch (error) {
            console.error(`❌ Error creating ${player.email}:`, error.message);
            failCount++;
        }
    }
    
    console.log('\n========================================');
    console.log(`✅ Successfully created: ${successCount} players`);
    console.log(`❌ Failed: ${failCount} players`);
    console.log('========================================');
    console.log('\n📋 Test Accounts:');
    console.log('Email: player6@test.com - player15@test.com');
    console.log('Password: password123');
    console.log('Role: player');
}

// Run the script
addPlayers();