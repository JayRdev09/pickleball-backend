const templates = [
    {
        id: 1,
        name: 'Morning Doubles',
        description: 'Casual morning doubles play',
        match_format: 'doubles',
        max_players: 16,
        fee_per_player: 10,
        duration_minutes: 90,
    },
    {
        id: 2,
        name: 'Competitive Singles',
        description: 'Competitive singles matches',
        match_format: 'singles',
        max_players: 8,
        fee_per_player: 15,
        duration_minutes: 120,
    },
];

exports.getTemplates = (req, res) => {
    res.json({ data: templates });
};

exports.createTemplate = async (req, res) => {
    const { name, description, match_format, max_players, fee_per_player, duration_minutes } = req.body;
    const newTemplate = {
        id: templates.length + 1,
        name,
        description,
        match_format,
        max_players,
        fee_per_player,
        duration_minutes,
    };
    templates.push(newTemplate);
    res.status(201).json({ data: newTemplate });
};

exports.deleteTemplate = (req, res) => {
    const { id } = req.params;
    const index = templates.findIndex(t => t.id === parseInt(id));
    if (index !== -1) {
        templates.splice(index, 1);
    }
    res.json({ success: true });
};