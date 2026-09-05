const { supabase } = require('../../config/supabase');

class SessionsService {
    static async createSession(ownerId, data) {
        const { 
            court_id, 
            name = 'Game Session', 
            match_format = 'doubles', 
            session_date,
            start_time,
            end_time,
            max_players = 16,
            fee_per_player = 0,
            notes 
        } = data;
        
        if (!court_id) throw new Error('Court ID is required');
        if (!name) throw new Error('Session name is required');
        if (!session_date) throw new Error('Session date is required');
        
        const dateObj = new Date(session_date);
        if (isNaN(dateObj.getTime())) {
            throw new Error('Invalid session date format');
        }
        
        const sessionData = {
            owner_id: ownerId,
            court_id,
            name,
            match_format,
            status: 'pending',
            session_date: session_date,
            expires_at: new Date(new Date(session_date).getTime() + 24 * 60 * 60 * 1000).toISOString(),
            max_players: parseInt(max_players) || 16,
            fee_per_player: parseFloat(fee_per_player) || 0,
        };
        
        if (start_time) {
            const startDateTime = new Date(`${session_date}T${start_time}:00`);
            if (!isNaN(startDateTime.getTime())) {
                sessionData.start_time = startDateTime.toISOString();
            }
        }
        
        if (end_time) {
            const endDateTime = new Date(`${session_date}T${end_time}:00`);
            if (!isNaN(endDateTime.getTime())) {
                sessionData.end_time = endDateTime.toISOString();
            }
        }
        
        if (notes) {
            sessionData.notes = notes;
        }
        
        const { data: session, error } = await supabase
            .from('sessions')
            .insert(sessionData)
            .select()
            .single();
        
        if (error) {
            throw new Error(error.message);
        }
        
        return session;
    }
    
    static async getSessions(filters = {}) {
        let query = supabase
            .from('sessions')
            .select(`
                *,
                courts!court_id(name, description),
                profiles!owner_id(full_name, username)
            `)
            .order('created_at', { ascending: false });
        
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.court_id) query = query.eq('court_id', filters.court_id);
        if (filters.session_date) query = query.eq('session_date', filters.session_date);
        
        if (filters.showExpired) {
            if (filters.expiredOnly) query = query.lt('expires_at', new Date().toISOString());
        } else {
            query = query.or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);
        }
        
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return data;
    }
    
    static async getSessionById(sessionId) {
        const { data, error } = await supabase
            .from('sessions')
            .select(`
                *,
                courts!court_id(*),
                profiles!owner_id(*),
                session_players(
                    id,
                    session_id,
                    player_id,
                    joined_at,
                    is_walkin,
                    booking_id
                )
            `)
            .eq('id', sessionId)
            .single();
        
        if (error) throw new Error(error.message);
        
        if (data && data.session_players && data.session_players.length > 0) {
            const playerIds = data.session_players.map(sp => sp.player_id);
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, username')
                .in('id', playerIds);
            
            if (!profilesError && profiles) {
                data.session_players = data.session_players.map(sp => {
                    const profile = profiles.find(p => p.id === sp.player_id);
                    return {
                        ...sp,
                        profile: profile || null,
                        full_name: profile?.full_name || 'Unknown Player',
                        username: profile?.username || 'No username'
                    };
                });
            }
        }
        
        return data;
    }
    
    static async addPlayerToSession(sessionId, playerId, bookingId = null, isWalkin = false) {
        const { data: existing, error: checkError } = await supabase
            .from('session_players')
            .select('id')
            .eq('session_id', sessionId)
            .eq('player_id', playerId)
            .maybeSingle();
        
        if (existing) {
            throw new Error('Player already in session');
        }
        
        const { data, error } = await supabase
            .from('session_players')
            .insert({
                session_id: sessionId,
                player_id: playerId,
                booking_id: bookingId,
                is_walkin: isWalkin || false,
            })
            .select()
            .single();
        
        if (error) throw new Error(error.message);
        return data;
    }
    
    static async removePlayerFromSession(sessionId, playerId) {
        const { error } = await supabase
            .from('session_players')
            .delete()
            .eq('session_id', sessionId)
            .eq('player_id', playerId);
        
        if (error) throw new Error(error.message);
        
        await supabase
            .from('queue_entries')
            .delete()
            .eq('session_id', sessionId)
            .eq('player_id', playerId);
        
        return { success: true };
    }
    
    static async updateSessionStatus(sessionId, status) {
        const validStatuses = ['pending', 'active', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            throw new Error('Invalid status');
        }
        
        const updates = { status };
        if (status === 'active') {
            updates.start_time = new Date().toISOString();
        }
        if (status === 'completed') {
            updates.end_time = new Date().toISOString();
        }
        
        const { data, error } = await supabase
            .from('sessions')
            .update(updates)
            .eq('id', sessionId)
            .select()
            .single();
        
        if (error) throw new Error(error.message);
        return data;
    }
    
    static async deleteSession(sessionId) {
        const { error } = await supabase
            .from('sessions')
            .delete()
            .eq('id', sessionId);
        
        if (error) throw new Error(error.message);
        return { success: true };
    }
    
    static async cleanupExpiredSessions() {
        const now = new Date().toISOString();
        
        const { data: expired, error: fetchError } = await supabase
            .from('sessions')
            .select('id')
            .not('expires_at', 'is', null)
            .lt('expires_at', now)
            .in('status', ['pending', 'completed', 'cancelled']);
        
        if (fetchError) throw new Error(fetchError.message);
        
        if (!expired || expired.length === 0) {
            return { deleted: 0 };
        }
        
        const ids = expired.map(s => s.id);
        
        const { error: deleteError } = await supabase
            .from('sessions')
            .delete()
            .in('id', ids);
        
        if (deleteError) throw new Error(deleteError.message);
        return { deleted: ids.length };
    }
}

module.exports = SessionsService;