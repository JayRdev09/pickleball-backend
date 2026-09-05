const { supabase, supabaseAdmin } = require('../../config/supabase');

class PlayersService {
    static async getProfile(playerId) {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', playerId)
            .single();
        
        if (profileError) {
            throw new Error(profileError.message);
        }
        
        let email = null;
        try {
            const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(playerId);
            if (!authError && authUser) {
                email = authUser.user?.email || null;
            }
        } catch (authError) {
            console.log('Could not fetch auth user email');
        }
        
        const { data: skills, error: skillsError } = await supabase
            .from('player_skills')
            .select('*')
            .eq('player_id', playerId)
            .single();
        
        if (skillsError && skillsError.code !== 'PGRST116') {
            throw new Error(skillsError.message);
        }
        
        return {
            ...profile,
            email: email || profile.email || null,
            skills: skills || null,
        };
    }
    
    static async updateProfile(playerId, updates) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', playerId)
            .select()
            .single();
        
        if (error) {
            throw new Error(error.message);
        }
        
        return data;
    }
    
    static async updateSkills(playerId, skillTier, ratings = {}) {
        const validTiers = ['beginner', 'intermediate', 'advanced', 'professional'];
        if (!validTiers.includes(skillTier)) {
            throw new Error('Invalid skill tier. Must be: beginner, intermediate, advanced, professional');
        }
        
        const { data: existing, error: checkError } = await supabase
            .from('player_skills')
            .select('id')
            .eq('player_id', playerId)
            .single();
        
        const validRatings = {};
        if (ratings.serve_rating !== undefined && ratings.serve_rating >= 1 && ratings.serve_rating <= 10) {
            validRatings.serve_rating = ratings.serve_rating;
        }
        if (ratings.return_rating !== undefined && ratings.return_rating >= 1 && ratings.return_rating <= 10) {
            validRatings.return_rating = ratings.return_rating;
        }
        if (ratings.dink_rating !== undefined && ratings.dink_rating >= 1 && ratings.dink_rating <= 10) {
            validRatings.dink_rating = ratings.dink_rating;
        }
        if (ratings.volley_rating !== undefined && ratings.volley_rating >= 1 && ratings.volley_rating <= 10) {
            validRatings.volley_rating = ratings.volley_rating;
        }
        if (ratings.mobility_rating !== undefined && ratings.mobility_rating >= 1 && ratings.mobility_rating <= 10) {
            validRatings.mobility_rating = ratings.mobility_rating;
        }
        
        const updateData = {
            skill_tier: skillTier,
            ...validRatings,
        };
        
        let result;
        
        if (existing) {
            const { data, error } = await supabase
                .from('player_skills')
                .update(updateData)
                .eq('player_id', playerId)
                .select()
                .single();
            
            if (error) {
                throw new Error(error.message);
            }
            result = data;
        } else {
            const { data, error } = await supabase
                .from('player_skills')
                .insert({
                    player_id: playerId,
                    skill_tier: skillTier,
                    ...validRatings,
                })
                .select()
                .single();
            
            if (error) {
                throw new Error(error.message);
            }
            result = data;
        }
        
        return result;
    }
    
    static async getStats(playerId) {
        const { data: skills, error: skillsError } = await supabase
            .from('player_skills')
            .select('*')
            .eq('player_id', playerId)
            .single();
        
        if (skillsError && skillsError.code !== 'PGRST116') {
            throw new Error(skillsError.message);
        }
        
        const { data: matchPlayers, error: matchError } = await supabase
            .from('match_players')
            .select(`
                match_id,
                is_winner,
                matches!inner(
                    id,
                    session_id,
                    match_group,
                    created_at,
                    ended_at,
                    team1_score,
                    team2_score,
                    winner_team
                )
            `)
            .eq('player_id', playerId)
            .order('created_at', { ascending: false, foreignTable: 'matches' })
            .limit(20);
        
        if (matchError) {
            console.warn('Could not fetch match history:', matchError.message);
            return {
                games_played: skills?.total_games || 0,
                wins: skills?.total_wins || 0,
                losses: skills?.total_losses || 0,
                win_streak: skills?.current_win_streak || 0,
                win_rate: skills?.total_games > 0 
                    ? Math.round((skills.total_wins / skills.total_games) * 100) 
                    : 0,
                skill_score: skills?.skill_score || 1.00,
                skill_tier: skills?.skill_tier || 'beginner',
                recent_matches: [],
            };
        }
        
        return {
            games_played: skills?.total_games || 0,
            wins: skills?.total_wins || 0,
            losses: skills?.total_losses || 0,
            win_streak: skills?.current_win_streak || 0,
            win_rate: skills?.total_games > 0 
                ? Math.round((skills.total_wins / skills.total_games) * 100) 
                : 0,
            skill_score: skills?.skill_score || 1.00,
            skill_tier: skills?.skill_tier || 'beginner',
            recent_matches: matchPlayers || [],
        };
    }
    
    static async getAllPlayers() {
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'player')
            .order('full_name');
        
        if (profilesError) {
            throw new Error(profilesError.message);
        }
        
        return profiles;
    }
    
    static async getPlayerById(playerId) {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', playerId)
            .single();
        
        if (profileError) {
            throw new Error(profileError.message);
        }
        
        return profile;
    }
}

module.exports = PlayersService;