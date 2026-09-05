const { supabase, supabaseAdmin } = require('../../config/supabase');
const jwt = require('jsonwebtoken');
const config = require('../../config/env');

class AuthService {
    /**
     * Register a new user
     */
    static async register(email, password, fullName, username, role = 'player', phone = null) {
        // Validate role
        if (!['player', 'owner'].includes(role)) {
            throw new Error('Invalid role. Must be player or owner');
        }
        
        // Check if username is taken
        const { data: existingUser, error: checkError } = await supabase
            .from('profiles')
            .select('username')
            .eq('username', username)
            .single();
        
        if (existingUser) {
            throw new Error('Username already taken');
        }
        
        // Register with Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { 
                full_name: fullName, 
                username: username,
                role: role 
            },
        });
        
        if (authError) {
            console.error('Supabase auth error:', authError);
            throw new Error(authError.message);
        }
        
        const userId = authData.user.id;
        
        // Create profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: userId,
                full_name: fullName,
                username,
                role,
                phone,
                is_active: true,
            })
            .select()
            .single();
        
        if (profileError) {
            console.error('Profile creation error:', profileError);
            // Rollback - delete auth user if profile creation fails
            await supabaseAdmin.auth.admin.deleteUser(userId);
            throw new Error(profileError.message);
        }
        
        return profile;
    }
    
    /**
     * Login user with email and password
     */
    static async login(email, password) {
        console.log(`🔐 Login attempt for: ${email}`);
        
        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            
            if (authError) {
                console.error('❌ Supabase auth error:', authError.message);
                console.error('❌ Error details:', authError);
                throw new Error(authError.message);
            }
            
            console.log('✅ Supabase auth successful for:', authData.user.email);
            console.log('👤 User ID:', authData.user.id);
            
            // Get user profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authData.user.id)
                .single();
            
            if (profileError) {
                console.error('❌ Profile fetch error:', profileError.message);
                // If profile doesn't exist, create one
                if (profileError.code === 'PGRST116') {
                    console.log('⚠️ Profile not found, creating one...');
                    const newProfile = {
                        id: authData.user.id,
                        email: authData.user.email,
                        full_name: authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0] || 'User',
                        username: authData.user.user_metadata?.username || authData.user.email?.split('@')[0] || `user_${authData.user.id.substring(0, 8)}`,
                        role: authData.user.user_metadata?.role || 'player',
                        is_active: true,
                    };
                    
                    const { data: createdProfile, error: createError } = await supabase
                        .from('profiles')
                        .insert(newProfile)
                        .select()
                        .single();
                    
                    if (createError) {
                        console.error('❌ Failed to create profile:', createError);
                        // Still allow login with basic info
                        const token = jwt.sign(
                            {
                                id: authData.user.id,
                                email: authData.user.email,
                                role: newProfile.role,
                            },
                            config.jwt.secret,
                            { expiresIn: '7d' }
                        );
                        
                        return {
                            user: {
                                id: authData.user.id,
                                email: authData.user.email,
                                full_name: newProfile.full_name,
                                username: newProfile.username,
                                role: newProfile.role,
                            },
                            access_token: authData.session.access_token,
                            refresh_token: authData.session.refresh_token,
                            token,
                        };
                    }
                    
                    console.log('✅ Profile created successfully');
                    
                    // Create player_skills
                    await supabase
                        .from('player_skills')
                        .insert({
                            player_id: authData.user.id,
                            skill_tier: 'beginner',
                            total_games: 0,
                            total_wins: 0,
                            total_losses: 0,
                            current_win_streak: 0,
                            skill_score: 1.00,
                        });
                    
                    const token = jwt.sign(
                        {
                            id: authData.user.id,
                            email: authData.user.email,
                            role: createdProfile.role,
                        },
                        config.jwt.secret,
                        { expiresIn: '7d' }
                    );
                    
                    return {
                        user: {
                            id: authData.user.id,
                            email: authData.user.email,
                            ...createdProfile,
                        },
                        access_token: authData.session.access_token,
                        refresh_token: authData.session.refresh_token,
                        token,
                    };
                }
                
                throw new Error(profileError.message);
            }
            
            console.log('✅ Profile found for user:', profile.full_name);
            
            // Create JWT token
            const tokenPayload = {
                id: authData.user.id,
                email: authData.user.email,
                role: profile.role,
            };
            
            console.log('📦 JWT Payload:', tokenPayload);
            
            const token = jwt.sign(
                tokenPayload,
                config.jwt.secret,
                { expiresIn: '7d' }
            );
            
            console.log('✅ JWT created successfully');
            
            return {
                user: {
                    id: authData.user.id,
                    email: authData.user.email,
                    ...profile,
                },
                access_token: authData.session.access_token,
                refresh_token: authData.session.refresh_token,
                token,
            };
        } catch (error) {
            console.error('❌ Login error:', error.message);
            throw error;
        }
    }
    
    /**
     * Get current user profile
     */
    static async getProfile(userId) {
        console.log(`👤 Getting profile for user: ${userId}`);
        
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (profileError) {
            console.error('❌ Profile fetch error:', profileError);
            throw new Error(profileError.message);
        }
        
        // Get email from auth users
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (authError) {
            console.warn('Could not fetch auth user:', authError);
            return profile;
        }
        
        return {
            ...profile,
            email: authUser.user?.email || null,
        };
    }
    
    /**
     * Logout user
     */
    static async logout() {
        return { message: 'Logged out successfully' };
    }
}

module.exports = AuthService;