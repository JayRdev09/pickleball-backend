const { supabase } = require('../../config/supabase');

class BookingsService {
    static async createBooking(playerId, data) {
        const { 
            court_id, 
            booking_date, 
            preferred_time, 
            match_format = 'doubles', 
            fee = 0,
            notes,
            session_id
        } = data;
        
        const bookingData = {
            player_id: playerId,
            court_id,
            booking_date: booking_date || new Date().toISOString().split('T')[0],
            preferred_time,
            match_format,
            fee,
            notes,
            status: 'pending',
            payment_status: 'unpaid',
        };
        
        if (session_id) {
            const { data: session, error: sessionError } = await supabase
                .from('sessions')
                .select('id, status, session_date, fee_per_player')
                .eq('id', session_id)
                .single();
            
            if (sessionError || !session) {
                throw new Error('Session not found');
            }
            
            if (!booking_date && session.session_date) {
                bookingData.booking_date = session.session_date;
            }
            
            if (!fee && session.fee_per_player) {
                bookingData.fee = session.fee_per_player;
            }
            
            bookingData.session_id = session_id;
        }
        
        const { data: booking, error } = await supabase
            .from('bookings')
            .insert(bookingData)
            .select()
            .single();
        
        if (error) {
            throw new Error(error.message);
        }
        
        return booking;
    }
    
    static async getBookings(playerId, role, filters = {}) {
        let query = supabase
            .from('bookings')
            .select(`
                *,
                profiles!player_id(full_name, username),
                courts!court_id(name)
            `)
            .order('created_at', { ascending: false });
        
        if (role === 'player') {
            query = query.eq('player_id', playerId);
        }
        
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        if (filters.court_id) {
            query = query.eq('court_id', filters.court_id);
        }
        if (filters.booking_date) {
            query = query.eq('booking_date', filters.booking_date);
        }
        
        const { data, error } = await query;
        
        if (error) {
            throw new Error(error.message);
        }
        
        return data;
    }
    
    static async getBookingById(bookingId, playerId, role) {
        let query = supabase
            .from('bookings')
            .select(`
                *,
                profiles!player_id(full_name, username),
                courts!court_id(name)
            `)
            .eq('id', bookingId)
            .maybeSingle();
        
        if (role === 'player') {
            query = query.eq('player_id', playerId);
        }
        
        const { data, error } = await query;
        
        if (error) {
            throw new Error(error.message);
        }
        
        if (!data) {
            throw new Error('Booking not found');
        }
        
        return data;
    }
    
    static async cancelBooking(bookingId, playerId) {
        const { data: booking, error: checkError } = await supabase
            .from('bookings')
            .select('id, status, player_id, session_id')
            .eq('id', bookingId)
            .maybeSingle();
        
        if (checkError || !booking) {
            throw new Error('Booking not found');
        }
        
        if (booking.player_id !== playerId) {
            throw new Error('You can only cancel your own bookings');
        }
        
        if (booking.status === 'completed' || booking.status === 'cancelled') {
            throw new Error('Booking cannot be cancelled');
        }
        
        const { data, error } = await supabase
            .from('bookings')
            .update({ 
                status: 'cancelled',
                payment_status: 'refunded'
            })
            .eq('id', bookingId)
            .select()
            .single();
        
        if (error) {
            throw new Error(error.message);
        }
        
        if (booking.session_id) {
            await supabase
                .from('session_players')
                .delete()
                .eq('session_id', booking.session_id)
                .eq('player_id', playerId);
        }
        
        return data;
    }
    
    static async getPendingBookings() {
        const { data, error } = await supabase
            .from('bookings')
            .select(`
                *,
                profiles!player_id(full_name, username),
                courts!court_id(name)
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: true });
        
        if (error) {
            throw new Error(error.message);
        }
        
        return data;
    }
    
    static async updateBookingStatus(bookingId, status) {
        const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
        if (!validStatuses.includes(status)) {
            throw new Error('Invalid status');
        }
        
        const { data: booking, error: getError } = await supabase
            .from('bookings')
            .select('id, player_id, session_id, fee')
            .eq('id', bookingId)
            .maybeSingle();
        
        if (getError) {
            throw new Error(getError.message);
        }
        
        if (!booking) {
            throw new Error('Booking not found');
        }
        
        const updateData = { status };
        
        if (status === 'confirmed') {
            updateData.payment_status = 'paid';
        }
        
        if (status === 'cancelled') {
            updateData.payment_status = 'refunded';
        }
        
        const { data, error } = await supabase
            .from('bookings')
            .update(updateData)
            .eq('id', bookingId)
            .select()
            .single();
        
        if (error) {
            throw new Error(error.message);
        }
        
        if (status === 'confirmed' && booking.session_id) {
            const { error: spError } = await supabase
                .from('session_players')
                .upsert({
                    session_id: booking.session_id,
                    player_id: booking.player_id,
                    booking_id: bookingId,
                    is_walkin: false,
                }, {
                    onConflict: 'session_id, player_id'
                });
            
            if (spError) {
                console.warn('Failed to add player to session:', spError.message);
            }

            const { error: revenueError } = await supabase
                .from('revenue_records')
                .insert({
                    session_id: booking.session_id,
                    booking_id: bookingId,
                    player_id: booking.player_id,
                    amount: booking.fee || 0,
                    payment_status: 'paid',
                    notes: 'Auto-recorded on booking confirmation'
                });

            if (revenueError) {
                console.warn('Failed to create revenue record:', revenueError.message);
            }
        }
        
        if (status === 'cancelled' && booking.session_id) {
            await supabase
                .from('session_players')
                .delete()
                .eq('session_id', booking.session_id)
                .eq('player_id', booking.player_id);
        }
        
        return data;
    }
}

module.exports = BookingsService;