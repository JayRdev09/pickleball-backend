const { supabase } = require('../../config/supabase');

class RevenueService {
    static async getSummary() {
        const { data, error } = await supabase
            .from('revenue_records')
            .select('amount, payment_status, recorded_at')
            .order('recorded_at', { ascending: false });
        
        if (error) throw new Error(error.message);
        
        const paid = data.filter(r => r.payment_status === 'paid');
        const total = paid.reduce((sum, record) => sum + Number(record.amount), 0);
        const count = paid.length;
        const average = count > 0 ? total / count : 0;
        
        return {
            total,
            count,
            average,
            pending: data.filter(r => r.payment_status === 'unpaid').length,
            records: data.slice(0, 100)
        };
    }
    
    static async getDailyRevenue(date) {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('revenue_records')
            .select('*')
            .eq('payment_status', 'paid')
            .gte('recorded_at', `${targetDate}T00:00:00`)
            .lt('recorded_at', `${targetDate}T23:59:59`);
        
        if (error) throw new Error(error.message);
        const total = data.reduce((sum, record) => sum + Number(record.amount), 0);
        return { date: targetDate, total, count: data.length, records: data };
    }
    
    static async getWeeklyRevenue() {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        const { data, error } = await supabase
            .from('revenue_records')
            .select('*')
            .eq('payment_status', 'paid')
            .gte('recorded_at', startDate.toISOString());
        
        if (error) throw new Error(error.message);
        const daily = {};
        data.forEach(record => {
            const date = record.recorded_at.split('T')[0];
            if (!daily[date]) daily[date] = { date, total: 0, count: 0 };
            daily[date].total += Number(record.amount);
            daily[date].count++;
        });
        return {
            start_date: startDate.toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0],
            daily: Object.values(daily),
            total: data.reduce((sum, r) => sum + Number(r.amount), 0)
        };
    }
    
    static async getMonthlyRevenue(month, year) {
        const targetMonth = month || new Date().getMonth() + 1;
        const targetYear = year || new Date().getFullYear();
        const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
        const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-31`;
        const { data, error } = await supabase
            .from('revenue_records')
            .select('*')
            .eq('payment_status', 'paid')
            .gte('recorded_at', `${startDate}T00:00:00`)
            .lte('recorded_at', `${endDate}T23:59:59`);
        
        if (error) throw new Error(error.message);
        const total = data.reduce((sum, record) => sum + Number(record.amount), 0);
        return { month: targetMonth, year: targetYear, total, count: data.length, records: data };
    }
    
    static async getSessionRevenue() {
        const { data, error } = await supabase
            .from('revenue_records')
            .select(`
                *,
                sessions!session_id(name, session_date)
            `)
            .eq('payment_status', 'paid')
            .order('recorded_at', { ascending: false });
        
        if (error) throw new Error(error.message);
        const sessionMap = {};
        data.forEach(record => {
            const sessionId = record.session_id;
            if (!sessionMap[sessionId]) {
                sessionMap[sessionId] = {
                    session_id: sessionId,
                    session_name: record.sessions?.name || 'Unknown',
                    session_date: record.sessions?.session_date,
                    total: 0,
                    count: 0
                };
            }
            sessionMap[sessionId].total += Number(record.amount);
            sessionMap[sessionId].count++;
        });
        return Object.values(sessionMap);
    }
    
    static async getTopPlayers(limit = 10) {
        const { data, error } = await supabase
            .from('revenue_records')
            .select(`
                player_id,
                amount,
                profiles!player_id(full_name, username)
            `)
            .eq('payment_status', 'paid')
            .order('recorded_at', { ascending: false })
            .limit(1000);
        
        if (error) throw new Error(error.message);
        const playerMap = {};
        data.forEach(record => {
            const playerId = record.player_id;
            if (!playerMap[playerId]) {
                playerMap[playerId] = {
                    player_id: playerId,
                    full_name: record.profiles?.full_name || 'Unknown',
                    username: record.profiles?.username || 'Unknown',
                    total_spent: 0,
                    visit_count: 0
                };
            }
            playerMap[playerId].total_spent += Number(record.amount);
            playerMap[playerId].visit_count++;
        });
        return Object.values(playerMap)
            .sort((a, b) => b.total_spent - a.total_spent)
            .slice(0, limit);
    }
    
    static async exportCSV() {
        const { data, error } = await supabase
            .from('revenue_records')
            .select(`
                *,
                profiles!player_id(full_name, username),
                sessions!session_id(name, session_date)
            `)
            .order('recorded_at', { ascending: false })
            .limit(10000);
        
        if (error) throw new Error(error.message);
        
        const headers = ['Date', 'Amount', 'Payment Status', 'Type', 'Description', 'Player', 'Username', 'Session', 'Transaction Ref'];
        const rows = data.map(record => [
            record.recorded_at,
            record.amount,
            record.payment_status,
            record.notes || '',
            record.notes || '',
            record.profiles?.full_name || '',
            record.profiles?.username || '',
            record.sessions?.name || '',
            record.transaction_ref || '',
        ]);
        
        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
}

module.exports = RevenueService;