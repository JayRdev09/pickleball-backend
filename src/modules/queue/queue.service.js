const { supabase } = require('../../config/supabase');
const SmartQueue = require('../../utils/smartQueue');

class QueueService {
    static async getQueue(sessionId) {
        try {
            const { data: queueEntries, error: queueError } = await supabase
                .from('queue_entries')
                .select('*')
                .eq('session_id', sessionId)
                .order('position', { ascending: true });
            
            if (queueError) throw new Error(queueError.message);
            if (!queueEntries || queueEntries.length === 0) return [];
            
            const playerIds = queueEntries.map(entry => entry.player_id);
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, username')
                .in('id', playerIds);
            
            const profileMap = {};
            if (profiles) {
                profiles.forEach(profile => {
                    profileMap[profile.id] = profile;
                });
            }
            
            return queueEntries.map(entry => ({
                ...entry,
                player: profileMap[entry.player_id] || null,
                player_name: profileMap[entry.player_id]?.full_name || 'Unknown Player'
            }));
        } catch (error) {
            throw error;
        }
    }
    
    static async resetQueue(sessionId) {
        try {
            console.log(`🔄 Resetting queue for session: ${sessionId}`);
            
            const { error: deleteError } = await supabase
                .from('queue_entries')
                .delete()
                .eq('session_id', sessionId);
            
            if (deleteError) throw new Error(deleteError.message);
            
            await supabase
                .from('matches')
                .update({ winner_team: 1, ended_at: new Date().toISOString() })
                .eq('session_id', sessionId)
                .is('winner_team', null);
            
            console.log('✅ Queue reset successfully');
            return { success: true };
        } catch (error) {
            console.error('Reset queue error:', error);
            throw error;
        }
    }
    
    static async buildQueue(sessionId) {
        try {
            console.log(`🔨 Building queue for session: ${sessionId}`);
            
            // Reset queue first
            await this.resetQueue(sessionId);
            
            // Check current queue state after reset
            const { data: remainingQueue } = await supabase
                .from('queue_entries')
                .select('player_id')
                .eq('session_id', sessionId);
            
            if (remainingQueue && remainingQueue.length > 0) {
                console.log(`⚠️ Queue had ${remainingQueue.length} entries remaining after reset, clearing manually`);
                // Force clear any remaining entries
                const { error: clearError } = await supabase
                    .from('queue_entries')
                    .delete()
                    .eq('session_id', sessionId);
                if (clearError) throw new Error(clearError.message);
            }
            
            const { data: sessionPlayers, error: playersError } = await supabase
                .from('session_players')
                .select('*')
                .eq('session_id', sessionId);
            
            if (playersError) throw new Error(playersError.message);
            if (!sessionPlayers || sessionPlayers.length === 0) {
                throw new Error('No confirmed players in session to queue');
            }
            
            console.log(`📊 Found ${sessionPlayers.length} players in session`);
            
            const playerIds = sessionPlayers.map(sp => sp.player_id);
            
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, username')
                .in('id', playerIds);
            
            if (profilesError) throw new Error(profilesError.message);
            
            const profileMap = {};
            if (profiles) {
                profiles.forEach(profile => {
                    profileMap[profile.id] = profile;
                });
            }
            
            const { data: skillsData, error: skillsError } = await supabase
                .from('player_skills')
                .select('player_id, skill_tier, total_games, total_wins, total_losses, current_win_streak')
                .in('id', playerIds);
            
            const skillMap = {};
            if (skillsData) {
                skillsData.forEach(skill => {
                    skillMap[skill.player_id] = skill;
                });
            }
            
            const { data: session, error: sessionError } = await supabase
                .from('sessions')
                .select('match_format')
                .eq('id', sessionId)
                .single();
            
            if (sessionError) throw new Error(sessionError.message);
            
            console.log(`📋 Session format: ${session.match_format}`);
            
            const players = sessionPlayers
                .filter(sp => sp && sp.player_id)
                .map(sp => {
                    const profile = profileMap[sp.player_id];
                    const skills = skillMap[sp.player_id] || { 
                        skill_tier: 'beginner', 
                        total_games: 0,
                        total_wins: 0,
                        total_losses: 0,
                        current_win_streak: 0
                    };
                    
                    return {
                        player_id: sp.player_id,
                        player_name: profile?.full_name || 'Unknown Player',
                        full_name: profile?.full_name || 'Unknown Player',
                        skill_tier: skills.skill_tier || 'beginner',
                        skill_score: 1,
                        booked_at: sp.joined_at || new Date().toISOString(),
                        games_played_today: skills.total_games || 0,
                        username: profile?.username
                    };
                });
            
            console.log('🎯 Players:', players.map(p => p.full_name));
            
            const queueEntries = SmartQueue.buildQueue(players, session.match_format);
            
            console.log(`📋 Generated ${queueEntries.length} queue entries`);
            
            const validEntries = queueEntries.filter(entry => entry && entry.player_id);
            
            if (validEntries.length > 0) {
                const entriesToInsert = validEntries.map((entry, index) => ({
                    session_id: sessionId,
                    player_id: entry.player_id,
                    position: index + 1,
                    skill_tier: entry.skill_tier || 'beginner',
                    skill_score: entry.skill_score || 1,
                    booked_at: entry.booked_at || new Date().toISOString(),
                    status: 'waiting',
                    match_group: entry.match_group || null,
                    team: entry.team || null,
                    games_played: 0
                }));
                
                const { error: insertError } = await supabase
                    .from('queue_entries')
                    .insert(entriesToInsert);
                
                if (insertError) throw new Error(insertError.message);
                
                console.log(`✅ Queue built with ${validEntries.length} players`);
            }
            
            return validEntries;
        } catch (error) {
            console.error('Build queue error:', error);
            throw error;
        }
    }
    
    static async nextMatch(sessionId) {
        try {
            // ✅ FIRST: Check if there are completed players to recycle
            const { data: completedCheck } = await supabase
                .from('queue_entries')
                .select('*')
                .eq('session_id', sessionId)
                .eq('status', 'completed');
            
            if (completedCheck && completedCheck.length > 0) {
                console.log(`🔄 Found ${completedCheck.length} completed players, recycling them first...`);
                await this.recycleAllCompletedPlayers(sessionId);
            }
            
            // ✅ Get ALL waiting players
            const { data: waitingPlayers, error: queueError } = await supabase
                .from('queue_entries')
                .select('*')
                .eq('session_id', sessionId)
                .eq('status', 'waiting')
                .order('position', { ascending: true });
            
            if (queueError) throw new Error(queueError.message);
            
            console.log(`📊 ${waitingPlayers?.length || 0} waiting players`);
            
            // ✅ Log all queue entries for debugging
            const { data: allEntries } = await supabase
                .from('queue_entries')
                .select('*')
                .eq('session_id', sessionId)
                .order('position', { ascending: true });
            
            if (allEntries) {
                console.log('📊 All queue entries:', allEntries.map(e => ({
                    pos: e.position,
                    status: e.status,
                    match_group: e.match_group,
                    team: e.team,
                    player: e.player_id.substring(0, 8)
                })));
            }
            
            // ✅ Get session format
            const { data: session, error: sessionError } = await supabase
                .from('sessions')
                .select('match_format')
                .eq('id', sessionId)
                .single();
            
            if (sessionError) throw new Error(sessionError.message);
            
            const playersPerMatch = session.match_format === 'doubles' ? 4 : 2;
            
            console.log(`📋 Match format: ${session.match_format}, Players per match: ${playersPerMatch}`);
            
            if (!waitingPlayers || waitingPlayers.length < playersPerMatch) {
                // ✅ Try one more time to recycle
                const { data: completedPlayers } = await supabase
                    .from('queue_entries')
                    .select('*')
                    .eq('session_id', sessionId)
                    .eq('status', 'completed');
                
                if (completedPlayers && completedPlayers.length > 0) {
                    console.log(`🔄 Recycling ${completedPlayers.length} completed players (retry)`);
                    await this.recycleAllCompletedPlayers(sessionId);
                    return this.nextMatch(sessionId);
                }
                
                throw new Error(`Need ${playersPerMatch} players for ${session.match_format}, have ${waitingPlayers?.length || 0}`);
            }
            
            const matchPlayers = waitingPlayers.slice(0, playersPerMatch);
            const matchGroup = matchPlayers[matchPlayers.length - 1]?.match_group || 1;
            
            console.log(`🎯 Starting match with ${matchPlayers.length} players, group ${matchGroup}`);
            console.log(`📋 Players:`, matchPlayers.map(p => ({
                name: p.player_id.substring(0, 8),
                team: p.team,
                position: p.position
            })));
            
            for (const player of matchPlayers) {
                await supabase
                    .from('queue_entries')
                    .update({ 
                        status: 'in_match',
                        started_at: new Date().toISOString()
                    })
                    .eq('id', player.id);
            }
            
            const matchData = {
                session_id: sessionId,
                match_group: matchGroup,
                match_format: session.match_format,
                started_at: new Date().toISOString()
            };
            
            const { data: match, error: matchError } = await supabase
                .from('matches')
                .insert(matchData)
                .select()
                .single();
            
            if (matchError) throw new Error(matchError.message);
            
            const balancedPlayers = SmartQueue.assignTeams(matchPlayers, session.match_format);
            
            const matchPlayersInsert = balancedPlayers.map(player => ({
                match_id: match.id,
                player_id: player.player_id,
                team: player.team || 1,
                is_winner: false
            }));
            
            const { error: mpError } = await supabase
                .from('match_players')
                .insert(matchPlayersInsert);
            
            if (mpError) throw new Error(mpError.message);
            
            const playerIds = matchPlayers.map(p => p.player_id);
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', playerIds);
            
            const profileMap = {};
            if (profiles) {
                profiles.forEach(p => {
                    profileMap[p.id] = p;
                });
            }
            
            return {
                match,
                players: matchPlayers.map(p => ({
                    ...p,
                    player_name: profileMap[p.player_id]?.full_name || 'Unknown Player'
                }))
            };
        } catch (error) {
            console.error('Next match error:', error);
            throw error;
        }
    }
    
    // ✅ FIXED: Recycle ALL completed players
    static async recycleAllCompletedPlayers(sessionId) {
        try {
            console.log(`🔄 Recycling ALL completed players for session: ${sessionId}`);
            
            // First, find any stale in_match entries (not part of current active match)
            const { data: currentMatch } = await supabase
                .from('matches')
                .select('id, match_group')
                .eq('session_id', sessionId)
                .is('winner_team', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            const currentMatchGroup = currentMatch?.match_group;
            
            // Mark stale in_match entries as completed
            // Include entries with match_group: null (orphaned) AND entries not in current match group
            const staleQuery = supabase
                .from('queue_entries')
                .select('*')
                .eq('session_id', sessionId)
                .eq('status', 'in_match');
            
            if (currentMatchGroup !== null && currentMatchGroup !== undefined) {
                staleQuery.or(`match_group.is.null,match_group.neq.${currentMatchGroup}`);
            }
            
            const { data: staleEntries } = await staleQuery;
            
            if (staleEntries && staleEntries.length > 0) {
                console.log(`🔄 Found ${staleEntries.length} stale in_match entries, marking as completed`);
                for (const entry of staleEntries) {
                    await supabase
                        .from('queue_entries')
                        .update({ 
                            status: 'completed',
                            finished_at: new Date().toISOString()
                        })
                        .eq('id', entry.id);
                }
            }
            
            // Get ALL completed players
            const { data: completedEntries, error: completedError } = await supabase
                .from('queue_entries')
                .select('*')
                .eq('session_id', sessionId)
                .eq('status', 'completed')
                .order('finished_at', { ascending: true });
            
            if (completedError) {
                console.error('Error fetching completed entries:', completedError);
                return;
            }
            
            if (!completedEntries || completedEntries.length === 0) {
                console.log('ℹ️ No completed players to recycle');
                return;
            }
            
            console.log(`🔄 Found ${completedEntries.length} completed players to recycle`);
            
            // Get current max position
            const { data: maxPosData } = await supabase
                .from('queue_entries')
                .select('position')
                .eq('session_id', sessionId)
                .order('position', { ascending: false })
                .limit(1);
            
            let currentPos = (maxPosData && maxPosData.length > 0) ? maxPosData[0].position : 0;
            
            // Get session format
            const { data: session, error: sessionError } = await supabase
                .from('sessions')
                .select('match_format')
                .eq('id', sessionId)
                .single();
            
            if (sessionError) {
                console.error('Error fetching session:', sessionError);
                return;
            }
            
            const playersPerMatch = session.match_format === 'doubles' ? 4 : 2;
            
            // ✅ Move ALL completed players to the end with new positions
            for (let i = 0; i < completedEntries.length; i++) {
                const entry = completedEntries[i];
                const newPosition = currentPos + i + 1;
                const newMatchGroup = Math.ceil(newPosition / playersPerMatch);
                
                // Determine team based on position
                const posInGroup = (newPosition - 1) % playersPerMatch;
                let team = null;
                
                if (playersPerMatch === 4) {
                    if (posInGroup === 0 || posInGroup === 3) team = 1;
                    else if (posInGroup === 1 || posInGroup === 2) team = 2;
                } else {
                    if (posInGroup === 0) team = 1;
                    else if (posInGroup === 1) team = 2;
                }
                
                console.log(`🔄 Recycling ${entry.player_id.substring(0, 8)}: pos ${entry.position} → ${newPosition}, team ${team}, match_group ${newMatchGroup}`);
                
                await supabase
                    .from('queue_entries')
                    .update({
                        status: 'waiting',
                        position: newPosition,
                        match_group: newMatchGroup,
                        team: team,
                        games_played: (entry.games_played || 0) + 1,
                        started_at: null,
                        finished_at: null
                    })
                    .eq('id', entry.id);
            }
            
            // ✅ Reorder all entries to ensure contiguous positions
            const { data: allEntries, error: allError } = await supabase
                .from('queue_entries')
                .select('id')
                .eq('session_id', sessionId)
                .order('position', { ascending: true });
            
            if (!allError && allEntries) {
                for (let i = 0; i < allEntries.length; i++) {
                    await supabase
                        .from('queue_entries')
                        .update({ position: i + 1 })
                        .eq('id', allEntries[i].id);
                }
            }
            
            // ✅ Verify the result
            const { data: verifyData } = await supabase
                .from('queue_entries')
                .select('*')
                .eq('session_id', sessionId)
                .order('position', { ascending: true });
            
            if (verifyData) {
                console.log('📊 After recycling:');
                verifyData.forEach(e => {
                    console.log(`   Pos ${e.position}: ${e.player_id.substring(0, 8)} | Match ${e.match_group} | Team ${e.team} | Status ${e.status}`);
                });
            }
            
            console.log(`✅ Recycled ${completedEntries.length} players, total ${verifyData?.length || 0} players in queue`);
            
        } catch (error) {
            console.error('Recycle all completed players error:', error);
        }
    }
    
    static async completeMatchAndAdvance(matchId, team1Score, team2Score, winnerTeam) {
        try {
            console.log(`🏸 Completing match ${matchId}`);
            
            const { data: match, error: matchError } = await supabase
                .from('matches')
                .update({
                    team1_score: parseInt(team1Score),
                    team2_score: parseInt(team2Score),
                    winner_team: parseInt(winnerTeam),
                    ended_at: new Date().toISOString()
                })
                .eq('id', matchId)
                .select()
                .single();
            
            if (matchError) throw new Error(matchError.message);
            
            console.log('✅ Match updated:', match.id);
            
            const { data: matchPlayers, error: mpError } = await supabase
                .from('match_players')
                .select('*')
                .eq('match_id', matchId);
            
            if (mpError) throw new Error(mpError.message);
            
            console.log(`📊 Updating stats for ${matchPlayers.length} players`);
            
            const winnerTeamNum = parseInt(winnerTeam);
            
            for (const mp of matchPlayers) {
                const isWinner = mp.team === winnerTeamNum;
                const { data: currentSkills } = await supabase
                    .from('player_skills')
                    .select('*')
                    .eq('player_id', mp.player_id)
                    .single();
                
                const updateData = {};
                if (isWinner) {
                    updateData.total_wins = (currentSkills?.total_wins || 0) + 1;
                    updateData.total_games = (currentSkills?.total_games || 0) + 1;
                    updateData.current_win_streak = (currentSkills?.current_win_streak || 0) + 1;
                } else {
                    updateData.total_losses = (currentSkills?.total_losses || 0) + 1;
                    updateData.total_games = (currentSkills?.total_games || 0) + 1;
                    updateData.current_win_streak = 0;
                }
                
                await supabase
                    .from('player_skills')
                    .update(updateData)
                    .eq('player_id', mp.player_id);
                
                await supabase
                    .from('match_players')
                    .update({ is_winner: isWinner })
                    .eq('id', mp.id);
            }
            
            // ✅ Get completed players from queue
            const { data: completedEntries, error: qError } = await supabase
                .from('queue_entries')
                .select('*')
                .eq('session_id', match.session_id)
                .eq('status', 'in_match')
                .eq('match_group', match.match_group);
            
            if (qError) {
                console.error('Error fetching queue entries:', qError);
            } else if (completedEntries && completedEntries.length > 0) {
                console.log(`📊 Found ${completedEntries.length} queue entries to complete`);
                
                // ✅ Mark as completed
                for (const entry of completedEntries) {
                    await supabase
                        .from('queue_entries')
                        .update({ 
                            status: 'completed',
                            finished_at: new Date().toISOString()
                        })
                        .eq('id', entry.id);
                }
                
                // ✅ RECYCLE ALL completed players
                console.log('🔄 Recycling all completed players...');
                await this.recycleAllCompletedPlayers(match.session_id);
            }
            
            // ✅ Auto-advance to next match
            let nextMatchResult = null;
            try {
                console.log('🔄 Auto-advancing to next match...');
                
                const { data: waiting } = await supabase
                    .from('queue_entries')
                    .select('*')
                    .eq('session_id', match.session_id)
                    .eq('status', 'waiting');
                
                console.log(`📊 ${waiting?.length || 0} players waiting after recycling`);

                const { data: sessionInfo } = await supabase
                    .from('sessions')
                    .select('match_format')
                    .eq('id', match.session_id)
                    .single();

                const playersPerMatch = sessionInfo?.match_format === 'singles' ? 2 : 4;

                if (waiting && waiting.length >= playersPerMatch) {
                    nextMatchResult = await this.nextMatch(match.session_id);
                    console.log('✅ Next match started automatically');
                } else {
                    console.log(`ℹ️ Not enough players for next match (need ${playersPerMatch}, have ${waiting?.length || 0})`);
                    nextMatchResult = { 
                        match: null, 
                        players: [], 
                        message: `Not enough players for next match (need ${playersPerMatch}, have ${waiting?.length || 0})` 
                    };
                }
            } catch (nextError) {
                console.log('ℹ️ Auto-advance skipped:', nextError.message);
                nextMatchResult = { 
                    match: null, 
                    players: [], 
                    message: nextError.message 
                };
            }
        
            return {
                completed_match: match,
                next_match: nextMatchResult
            };
        } catch (error) {
            console.error('Complete match error:', error);
            throw error;
        }
    }
    
    static async getCurrentMatch(sessionId) {
        try {
            const { data: match, error } = await supabase
                .from('matches')
                .select(`
                    *,
                    match_players(
                        *,
                        profiles!player_id(full_name, username)
                    )
                `)
                .eq('session_id', sessionId)
                .is('winner_team', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            if (error) return null;
            return match || null;
        } catch (error) {
            return null;
        }
    }
    
    static async insertPlayer(sessionId, playerId, position) {
        try {
            const { data: skills, error: skillsError } = await supabase
                .from('player_skills')
                .select('skill_tier')
                .eq('player_id', playerId)
                .single();
            
            if (skillsError) throw new Error(skillsError.message);
            
            if (position) {
                await supabase
                    .from('queue_entries')
                    .update({ position: supabase.sql`position + 1` })
                    .eq('session_id', sessionId)
                    .gte('position', position);
            }
            
            const { data, error } = await supabase
                .from('queue_entries')
                .insert({
                    session_id: sessionId,
                    player_id: playerId,
                    position: position || 1,
                    skill_tier: skills.skill_tier || 'beginner',
                    status: 'waiting',
                    booked_at: new Date().toISOString(),
                    games_played: 0
                })
                .select()
                .single();
            
            if (error) throw new Error(error.message);
            return data;
        } catch (error) {
            throw error;
        }
    }
    
    static async removePlayer(entryId) {
        const { error } = await supabase
            .from('queue_entries')
            .delete()
            .eq('id', entryId);
        if (error) throw new Error(error.message);
        return { success: true };
    }
    
    static async reorderQueue(sessionId, newOrder) {
        for (let i = 0; i < newOrder.length; i++) {
            const { error } = await supabase
                .from('queue_entries')
                .update({ position: i + 1 })
                .eq('id', newOrder[i])
                .eq('session_id', sessionId);
            if (error) throw new Error(error.message);
        }
        return { success: true };
    }
    
    static async getPlayerStatus(sessionId, playerId) {
        const { data, error } = await supabase
            .from('queue_entries')
            .select('*')
            .eq('session_id', sessionId)
            .eq('player_id', playerId)
            .maybeSingle();
        if (error && error.code !== 'PGRST116') throw new Error(error.message);
        return data || null;
    }
    
    static async buildTournamentQueue(sessionId, tournamentOptions = {}) {
        try {
            console.log(`🏆 Building tournament queue for session: ${sessionId}`);
            
            await this.resetQueue(sessionId);
            
            const { data: sessionPlayers, error: playersError } = await supabase
                .from('session_players')
                .select('*')
                .eq('session_id', sessionId);
            
            if (playersError) throw new Error(playersError.message);
            if (!sessionPlayers || sessionPlayers.length === 0) {
                throw new Error('No confirmed players in session for tournament');
            }
            
            const playerIds = sessionPlayers.map(sp => sp.player_id);
            
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, username')
                .in('id', playerIds);
            
            if (profilesError) throw new Error(profilesError.message);
            
            const profileMap = {};
            if (profiles) {
                profiles.forEach(profile => {
                    profileMap[profile.id] = profile;
                });
            }
            
            const { data: skillsData } = await supabase
                .from('player_skills')
                .select('player_id, skill_tier, total_games, total_wins, total_losses, current_win_streak')
                .in('id', playerIds);
            
            const skillMap = {};
            if (skillsData) {
                skillsData.forEach(skill => {
                    skillMap[skill.player_id] = skill;
                });
            }
            
            const { data: session, error: sessionError } = await supabase
                .from('sessions')
                .select('match_format')
                .eq('id', sessionId)
                .single();
            
            if (sessionError) throw new Error(sessionError.message);
            
            const players = sessionPlayers
                .filter(sp => sp && sp.player_id)
                .map(sp => {
                    const profile = profileMap[sp.player_id];
                    const skills = skillMap[sp.player_id] || { skill_tier: 'beginner' };
                    return {
                        player_id: sp.player_id,
                        player_name: profile?.full_name || 'Unknown Player',
                        full_name: profile?.full_name || 'Unknown Player',
                        skill_tier: skills.skill_tier || 'beginner',
                        skill_score: 1,
                        booked_at: sp.joined_at || new Date().toISOString(),
                        username: profile?.username
                    };
                });
            
            const queueEntries = SmartQueue.buildQueue(players, session.match_format, {
                tournament: true,
                tournamentOptions: tournamentOptions,
            });
            
            console.log(`🏆 Tournament generated ${queueEntries.length} queue entries`);
            
            const validEntries = queueEntries.filter(entry => entry && entry.player_id);
            
            if (validEntries.length > 0) {
                const entriesToInsert = validEntries.map((entry, index) => ({
                    session_id: sessionId,
                    player_id: entry.player_id,
                    position: index + 1,
                    skill_tier: entry.skill_tier || 'beginner',
                    skill_score: entry.skill_score || 1,
                    booked_at: entry.booked_at || new Date().toISOString(),
                    status: 'waiting',
                    match_group: entry.match_group || null,
                    team: entry.team || null,
                    games_played: 0
                }));
                
                const { error: insertError } = await supabase
                    .from('queue_entries')
                    .insert(entriesToInsert);
                
                if (insertError) throw new Error(insertError.message);
            }
            
            return validEntries;
        } catch (error) {
            console.error('Build tournament queue error:', error);
            throw error;
        }
    }
    
    static async getTournamentBracket(sessionId) {
        try {
            const { data: queueEntries, error: queueError } = await supabase
                .from('queue_entries')
                .select('*')
                .eq('session_id', sessionId)
                .order('position', { ascending: true });
            
            if (queueError) throw new Error(queueError.message);
            if (!queueEntries || queueEntries.length === 0) return { rounds: [], players: [] };
            
            const playerIds = queueEntries.map(e => e.player_id);
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, username')
                .in('id', playerIds);
            
            const profileMap = {};
            if (profiles) {
                profiles.forEach(p => { profileMap[p.id] = p; });
            }
            
            const enriched = queueEntries.map(entry => ({
                ...entry,
                player_name: profileMap[entry.player_id]?.full_name || 'Unknown Player',
                username: profileMap[entry.player_id]?.username || null,
            }));
            
            // Group into matches by match_group
            const matchGroups = {};
            enriched.forEach(entry => {
                const mg = entry.match_group || 'unassigned';
                if (!matchGroups[mg]) matchGroups[mg] = [];
                matchGroups[mg].push(entry);
            });
            
            const { data: matches } = await supabase
                .from('matches')
                .select('*, match_players(*)')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true });
            
            return {
                rounds: Object.entries(matchGroups)
                    .filter(([key]) => key !== 'unassigned')
                    .map(([groupNum, players]) => ({
                        match_group: parseInt(groupNum),
                        team1: players.filter(p => p.team === 1),
                        team2: players.filter(p => p.team === 2),
                        status: players.every(p => p.status === 'completed') ? 'completed'
                            : players.some(p => p.status === 'in_match') ? 'in_progress'
                            : 'pending',
                    })),
                unassigned: matchGroups['unassigned'] || [],
                matches: matches || [],
                players: enriched,
            };
        } catch (error) {
            console.error('Get tournament bracket error:', error);
            throw error;
        }
    }
}

module.exports = QueueService;