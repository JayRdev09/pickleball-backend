const { supabase } = require('../../config/supabase');

class CourtsService {
    static async getAllCourts() {
        const { data, error } = await supabase
            .from('courts')
            .select('*')
            .order('name', { ascending: true });
        
        if (error) {
            throw new Error(error.message);
        }
        
        return data;
    }
    
    static async getCourtById(courtId) {
        const { data, error } = await supabase
            .from('courts')
            .select('*')
            .eq('id', courtId)
            .single();
        
        if (error) {
            throw new Error(error.message);
        }
        
        return data;
    }
    
    static async createCourt(data) {
        const { name, description, is_active = true } = data;
        
        const { data: court, error } = await supabase
            .from('courts')
            .insert({
                name,
                description,
                is_active,
            })
            .select()
            .single();
        
        if (error) {
            throw new Error(error.message);
        }
        
        return court;
    }
    
    static async updateCourt(courtId, data) {
        const { name, description, is_active } = data;
        
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (is_active !== undefined) updates.is_active = is_active;
        
        const { data: court, error } = await supabase
            .from('courts')
            .update(updates)
            .eq('id', courtId)
            .select()
            .single();
        
        if (error) {
            throw new Error(error.message);
        }
        
        return court;
    }
    
    static async deleteCourt(courtId) {
        const { error } = await supabase
            .from('courts')
            .delete()
            .eq('id', courtId);
        
        if (error) {
            throw new Error(error.message);
        }
        
        return { success: true };
    }
}

module.exports = CourtsService;