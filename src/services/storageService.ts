import { supabase } from '../lib/supabase';
import { ModelItem, Category } from '../../types';

export interface StoredModel extends ModelItem {
    uploadedAt: number;
}

export const storageService = {
    // --- Categories ---
    async getCategories(): Promise<Category[]> {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching categories:', error);
            return [];
        }

        // Map DB snake_case to App camelCase
        return data.map((item: any) => ({
            id: item.id,
            name: item.name,
            displayName: item.display_name,
            icon: item.icon
        })) as Category[];
    },

    async addCategory(category: Category): Promise<void> {
        // Map App camelCase to DB snake_case
        const dbRecord = {
            id: category.id,
            name: category.name,
            display_name: category.displayName,
            icon: category.icon
        };

        const { error } = await supabase
            .from('categories')
            .insert([dbRecord]);

        if (error) console.error('Error adding category:', error);
    },

    async deleteCategory(id: string): Promise<void> {
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) console.error('Error deleting category:', error);
    },

    // --- Models ---
    async getModels(): Promise<ModelItem[]> {
        const { data, error } = await supabase
            .from('models')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching models:', error);
            return [];
        }

        // Map database fields back to application ModelItem shape if needed
        return data.map((item: any) => ({
            id: item.id,
            name: item.name,
            file: item.file_url, // URL from bucket
            categoryId: item.category_id,
            thumbnail: item.thumbnail_url || '',
            config: item.config || {},
            uploadedAt: new Date(item.created_at).getTime() // Convert timestamp to ms number or keep as is? App expects number.
        })) as ModelItem[];
    },

    async addModel(model: ModelItem): Promise<void> {
        // Prepare record for DB
        const dbRecord = {
            id: model.id,
            name: model.name,
            category_id: model.categoryId,
            file_url: model.file,
            thumbnail_url: model.thumbnail,
            config: model.config
        };

        const { error } = await supabase
            .from('models')
            .insert([dbRecord]);

        if (error) console.error('Error adding model:', error);
    },

    async deleteModel(id: string): Promise<void> {
        // 1. Get model to find file path? 
        // For simplicity, just delete query. Supabase bucket cleanup might be separate or triggered.
        const { error } = await supabase
            .from('models')
            .delete()
            .eq('id', id);

        if (error) console.error('Error deleting model:', error);
    },

    async getModel(id: string): Promise<ModelItem | null> {
        const { data, error } = await supabase
            .from('models')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching model:', error);
            return null;
        }

        return {
            id: data.id,
            name: data.name,
            file: data.file_url,
            categoryId: data.category_id,
            thumbnail: data.thumbnail_url || '',
            config: data.config || {},
            uploadedAt: new Date(data.created_at).getTime()
        };
    },

    async updateModel(model: ModelItem): Promise<void> {
        const dbRecord = {
            name: model.name,
            category_id: model.categoryId,
            file_url: model.file,
            thumbnail_url: model.thumbnail,
            config: model.config
        };

        const { error } = await supabase
            .from('models')
            .update(dbRecord)
            .eq('id', model.id);

        if (error) console.error('Error updating model:', error);
    },

    // --- Storage ---
    async uploadFile(file: File): Promise<string | null> {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('models')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Error uploading file:', uploadError);
            return null;
        }

        // Get Public URL
        const { data } = supabase.storage
            .from('models')
            .getPublicUrl(filePath);

        return data.publicUrl;
    },

    // --- Legacy / Helpers ---
    async initialize(defaultCategories: Category[], defaultModels: any[]) {
        // Initialize logic for DB is different. 
        // We probably only want to seed if DB is empty.
        const cats = await this.getCategories();
        if (cats.length === 0) {
            console.log('Seeding Supabase Categories...');
            for (const cat of defaultCategories) {
                await this.addCategory(cat);
            }
        }
    },
};
