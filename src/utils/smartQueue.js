// SmartQueue utility with enhanced stacking and tournament mode
class SmartQueue {
    /**
     * Build a queue for matches.
     * @param {Array} players - List of player objects.
     * @param {string} format - 'doubles' or 'singles'.
     * @param {Object} options - Optional flags. { tournament: boolean, tournamentOptions: Object }
     * @returns {Array} Queue entries ready for consumption.
     */
    static buildQueue(players, format = 'doubles', options = {}) {
        if (!players || players.length === 0) {
            return [];
        }

        // Filter out any invalid player records
        const validPlayers = players.filter(p => p && p.player_id);
        if (validPlayers.length === 0) return [];

        // If tournament mode requested, delegate to dedicated builder
        if (options.tournament) {
            return this.buildTournamentQueue(validPlayers, format, options.tournamentOptions || {});
        }

        // Normal queue building – ensure full matches only (loop stacking)
        const { matches, leftovers } = this.generateMatches(validPlayers, format);
        const queue = [];
        let position = 1;
        let matchGroup = 1;

        console.log(`🎯 Building queue with ${validPlayers.length} players (${format}), ${matches.length} full matches`);

        // Process full matches
        for (const match of matches) {
            const matchPlayers = match.filter(p => p && p.player_id);
            matchPlayers.forEach(player => {
                queue.push({
                    player_id: player.player_id,
                    position: position++,
                    skill_tier: player.skill_tier || 'beginner',
                    skill_score: player.skill_score || 1,
                    booked_at: player.booked_at || new Date().toISOString(),
                    status: 'waiting',
                    match_group: matchGroup,
                    team: player.team || 1,
                    games_played: 0,
                });
            });
            matchGroup++;
        }

        // Process leftovers – they stay ungrouped
        leftovers.filter(p => p && p.player_id).forEach(player => {
            queue.push({
                player_id: player.player_id,
                position: position++,
                skill_tier: player.skill_tier || 'beginner',
                skill_score: player.skill_score || 1,
                booked_at: player.booked_at || new Date().toISOString(),
                status: 'waiting',
                match_group: null,
                team: null,
                games_played: 0,
            });
        });

        console.log(`✅ Queue built: ${queue.length} entries, ${matchGroup - 1} full matches`);
        return queue;
    }

    /** Generate full match groups and leftover players */
    static generateMatches(players, format) {
        const playersPerMatch = format === 'doubles' ? 4 : 2;
        const sorted = [...players].sort((a, b) => new Date(a.booked_at) - new Date(b.booked_at));
        const matches = [];
        const leftovers = [];

        for (let i = 0; i < sorted.length; i += playersPerMatch) {
            const chunk = sorted.slice(i, i + playersPerMatch);
            if (chunk.length === playersPerMatch) {
                const balanced = this.assignTeams(chunk, format);
                matches.push(balanced);
            } else {
                leftovers.push(...chunk);
            }
        }

        return { matches, leftovers };
    }

    /** Assign teams to a set of players for a match */
    static assignTeams(players, format) {
        const valid = players.filter(p => p && p.player_id);
        if (valid.length === 0) return [];

        const sorted = valid.slice().sort((a, b) => this.getSkillValue(b) - this.getSkillValue(a));

        if (format === 'singles' || sorted.length < 4) {
            return sorted.map((p, idx) => ({ ...p, team: idx % 2 === 0 ? 1 : 2 }));
        }

        // Doubles – snake draft (1-2-1-2) with 4 players
        const team1 = [sorted[0], sorted[2]].filter(Boolean);
        const team2 = [sorted[1], sorted[3]].filter(Boolean);

        const withTeam = [];
        team1.forEach(p => withTeam.push({ ...p, team: 1 }));
        team2.forEach(p => withTeam.push({ ...p, team: 2 }));

        // Preserve original order within the match for deterministic logs
        return withTeam.sort((a, b) => {
            const idxA = players.findIndex(p => p.player_id === a.player_id);
            const idxB = players.findIndex(p => p.player_id === b.player_id);
            return idxA - idxB;
        });
    }

    /** Build a tournament queue (single-elimination or round-robin) */
    static buildTournamentQueue(players, format = 'doubles', tournamentOptions = {}) {
        const type = tournamentOptions.type || 'single_elimination';
        const seedMethod = tournamentOptions.seedMethod || 'skill';
        const validPlayers = (players || []).filter(p => p && p.player_id);
        const seeded = this.seedPlayers(validPlayers, seedMethod);
        const playersPerMatch = format === 'doubles' ? 4 : 2;
        const matches = [];
        const byes = [];

        if (type === 'single_elimination') {
            const total = seeded.length;
            const fullMatchCount = Math.floor(total / playersPerMatch);

            if (format === 'doubles') {
                // For doubles (4 players per match): pair high & low seeds
                for (let i = 0; i < fullMatchCount; i++) {
                    const matchPlayers = [
                        seeded[i * 2],
                        seeded[i * 2 + 1],
                        seeded[total - 1 - (i * 2 + 1)],
                        seeded[total - 1 - (i * 2)],
                    ].filter(Boolean);

                    if (matchPlayers.length === 4) {
                        const balanced = this.assignTeams(matchPlayers, 'doubles');
                        matches.push(balanced);
                    }
                }
                // Remaining players become byes
                const assignedIds = new Set(matches.flat().map(p => p.player_id));
                seeded.forEach(p => {
                    if (!assignedIds.has(p.player_id)) {
                        byes.push(p);
                    }
                });
            } else {
                // Singles (2 players per match): 1 vs last, 2 vs second last, etc.
                for (let i = 0; i < fullMatchCount; i++) {
                    const pair = [seeded[i], seeded[total - 1 - i]].filter(Boolean);
                    if (pair.length === 2) {
                        const balanced = this.assignTeams(pair, 'singles');
                        matches.push(balanced);
                    }
                }
                if (total % 2 !== 0) {
                    byes.push(seeded[Math.floor(total / 2)]);
                }
            }
        } else if (type === 'round_robin') {
            // Generate all combinations of required size
            if (seeded.length >= playersPerMatch) {
                const combos = this.combinations(seeded, playersPerMatch);
                combos.forEach(combo => {
                    const balanced = this.assignTeams(combo, format);
                    matches.push(balanced);
                });
            } else {
                byes.push(...seeded);
            }
        } else {
            console.warn(`Unsupported tournament type: ${type}`);
        }

        const queue = [];
        let position = 1;
        let matchGroup = 1;

        // Add full matches
        matches.forEach(match => {
            const validMatchPlayers = (match || []).filter(p => p && p.player_id);
            if (validMatchPlayers.length === playersPerMatch) {
                validMatchPlayers.forEach(p => {
                    queue.push({
                        player_id: p.player_id,
                        position: position++,
                        skill_tier: p.skill_tier || 'beginner',
                        skill_score: p.skill_score || 1,
                        booked_at: p.booked_at || new Date().toISOString(),
                        status: 'waiting',
                        match_group: matchGroup,
                        team: p.team || 1,
                        games_played: 0,
                    });
                });
                matchGroup++;
            }
        });

        // Add byes / standbys (match_group: null, team: null)
        byes.filter(p => p && p.player_id).forEach(p => {
            queue.push({
                player_id: p.player_id,
                position: position++,
                skill_tier: p.skill_tier || 'beginner',
                skill_score: p.skill_score || 1,
                booked_at: p.booked_at || new Date().toISOString(),
                status: 'waiting',
                match_group: null,
                team: null,
                games_played: 0,
            });
        });

        console.log(`🗂️ Tournament queue built: ${queue.length} entries, ${matchGroup - 1} full matches, ${byes.length} byes`);
        return queue;
    }

    /** Seed players for tournament brackets */
    static seedPlayers(players, method) {
        const valid = (players || []).filter(p => p && p.player_id);
        if (method === 'random') {
            return [...valid].sort(() => Math.random() - 0.5);
        }
        return [...valid].sort((a, b) => this.getSkillValue(b) - this.getSkillValue(a));
    }

    /** Generate all combinations of `size` elements from `array` */
    static combinations(array, size) {
        const results = [];
        function combine(start, combo) {
            if (combo.length === size) {
                results.push([...combo]);
                return;
            }
            for (let i = start; i < array.length; i++) {
                combo.push(array[i]);
                combine(i + 1, combo);
                combo.pop();
            }
        }
        combine(0, []);
        return results;
    }

    static getSkillValue(player) {
        if (!player) return 1;
        if (player.skill_score) return player.skill_score;
        const tierMap = { beginner: 1, intermediate: 2, advanced: 3, professional: 4 };
        return tierMap[player.skill_tier] || 1;
    }

    static calculateSkillGap(matchPlayers) {
        const valid = (matchPlayers || []).filter(p => p && p.player_id);
        const team1 = valid.filter(p => p.team === 1);
        const team2 = valid.filter(p => p.team === 2);
        const sum1 = team1.reduce((s, p) => s + this.getSkillValue(p), 0);
        const sum2 = team2.reduce((s, p) => s + this.getSkillValue(p), 0);
        const avg1 = team1.length > 0 ? sum1 / team1.length : 0;
        const avg2 = team2.length > 0 ? sum2 / team2.length : 0;
        return Math.abs(avg1 - avg2);
    }

    static getNextMatch(queueEntries, format = 'doubles') {
        const playersPerMatch = format === 'doubles' ? 4 : 2;
        const waiting = (queueEntries || []).filter(e => e && e.player_id && e.status === 'waiting');
        if (waiting.length < playersPerMatch) {
            return { match: null, remaining: queueEntries };
        }
        const matchPlayers = waiting.slice(0, playersPerMatch);
        const remaining = queueEntries.filter(e => !matchPlayers.some(m => m.player_id === e.player_id));
        return { match: matchPlayers, remaining };
    }
}

module.exports = SmartQueue;