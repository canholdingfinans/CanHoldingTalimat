/**
 * Supabase Integration Module
 * Handles all database operations and API calls
 */

const SUPABASE_URL = 'https://fvyjbfesakzhquxrfyvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2eWpiZmVzYWt6aHF1eHJmeXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMDMzMTQsImV4cCI6MjA3MTg3OTMxNH0.q3SVC9tUhYqLwyVZOJkQtfE_gcZ1Xrf2Eq-TuyJsg5A';

// Initialize Supabase client with error handling
let supabaseClient;

if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.warn('Supabase client could not be initialized. Make sure the Supabase library is loaded.');
    // Create a mock client for development
    supabaseClient = {
        from: () => ({
            select: () => ({ error: null, data: [] }),
            insert: () => ({ error: null, data: [] }),
            update: () => ({ error: null, data: [] }),
            delete: () => ({ error: null }),
            eq: () => ({ error: null, data: [] }),
            ilike: () => ({ error: null, data: [] }),
            neq: () => ({ error: null, data: [] }),
            order: () => ({ error: null, data: [] }),
            limit: () => ({ error: null, data: [] })
        })
    };
}

/**
 * Firma operations
 */
export const firmaOperations = {
    // Fetch all firms with their bank accounts
    async fetchAll(searchTerm = '', filterType = 'all') {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, returning empty array');
            return [];
        }
        
        let query = supabaseClient.from('firms').select('*, bank_accounts(*)');

        // Apply search filter (minimum 3 characters)
        if (searchTerm.length >= 3) {
            query = query.ilike('name', `%${searchTerm}%`);
        }

        // Apply type filter
        if (filterType !== 'all') {
            query = query.eq('turu', filterType);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Veri çekerken hata oluştu:', error.message);
            throw new Error(`Firma verisi çekilemedi: ${error.message}`);
        }

        return data.map(firma => ({ ...firma, bankalar: firma.bank_accounts || [] }));
    },

    // Add new firm
    async create(name, turu, vknTcNo = null, vergiDairesi = null, sgkSicilNo = null, sgkAdi = null) {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, returning mock data');
            return { id: Date.now(), name, turu, vkn_tc_no: vknTcNo, vergi_dairesi: vergiDairesi, sgk_sicil_no: sgkSicilNo, sgk_adi: sgkAdi };
        }
        
        const { data, error } = await supabaseClient
            .from('firms')
            .insert([{ name, turu, vkn_tc_no: vknTcNo, vergi_dairesi: vergiDairesi, sgk_sicil_no: sgkSicilNo, sgk_adi: sgkAdi }])
            .select()
            .single();

        if (error) {
            console.error('Firma eklenirken hata oluştu:', error.message);
            throw new Error(`Firma eklenemedi: ${error.message}`);
        }

        return data;
    },

    // Update existing firm
    async update(id, name, turu, vknTcNo = null, vergiDairesi = null, sgkSicilNo = null, sgkAdi = null) {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, returning mock data');
            return { id, name, turu, vkn_tc_no: vknTcNo, vergi_dairesi: vergiDairesi, sgk_sicil_no: sgkSicilNo, sgk_adi: sgkAdi };
        }
        
        const { data, error } = await supabaseClient
            .from('firms')
            .update({ name, turu, vkn_tc_no: vknTcNo, vergi_dairesi: vergiDairesi, sgk_sicil_no: sgkSicilNo, sgk_adi: sgkAdi })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Firma güncellenirken hata oluştu:', error.message);
            throw new Error(`Firma güncellenemedi: ${error.message}`);
        }

        return data;
    },

    // Delete firm
    async delete(id) {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, skipping delete operation');
            return;
        }
        
        const { error } = await supabaseClient.from('firms').delete().eq('id', id);

        if (error) {
            console.error('Firma silinirken hata oluştu:', error.message);
            throw new Error(`Firma silinemedi: ${error.message}`);
        }
    },

    // Check for duplicate firm names
    async checkDuplicate(name, excludeId = null) {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, skipping duplicate check');
            return false;
        }
        
        let query = supabaseClient
            .from('firms')
            .select('id, name')
            .ilike('name', name);

        if (excludeId) {
            query = query.neq('id', excludeId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Duplike kontrol hatası:', error.message);
            throw new Error(`Duplike kontrolü yapılamadı: ${error.message}`);
        }

        return data && data.length > 0;
    }
};

/**
 * Bank account operations
 */
export const bankaOperations = {
    // Add new bank account
    async create(bankaData) {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, returning mock data');
            return { id: Date.now(), ...bankaData };
        }
        
        const { data, error } = await supabaseClient
            .from('bank_accounts')
            .insert([bankaData])
            .select()
            .single();

        if (error) {
            console.error('Banka hesabı eklenirken hata oluştu:', error.message);
            throw new Error(`Banka hesabı eklenemedi: ${error.message}`);
        }

        return data;
    },

    // Update existing bank account
    async update(id, bankaData) {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, returning mock data');
            return { id, ...bankaData };
        }
        
        const { data, error } = await supabaseClient
            .from('bank_accounts')
            .update(bankaData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Banka hesabı güncellenirken hata oluştu:', error.message);
            throw new Error(`Banka hesabı güncellenemedi: ${error.message}`);
        }

        return data;
    },

    // Delete bank account
    async delete(id) {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, skipping delete operation');
            return;
        }
        
        const { error } = await supabaseClient.from('bank_accounts').delete().eq('id', id);

        if (error) {
            console.error('Banka hesabı silinirken hata oluştu:', error.message);
            throw new Error(`Banka hesabı silinemedi: ${error.message}`);
        }
    }
};

/**
 * Payment instruction operations
 */
export const talimatOperations = {
    // Get next instruction number
    async getNextInstructionNumber() {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, returning default number');
            return 1;
        }
        
        const { data: lastInstruction, error: lastError } = await supabaseClient
            .from('payment_instructions')
            .select('instruction_number')
            .order('instruction_number', { ascending: false })
            .limit(1);
            
        let nextNumber = 1;
        if (!lastError && lastInstruction && lastInstruction.length > 0) {
            nextNumber = lastInstruction[0].instruction_number + 1;
        }

        return nextNumber;
    },

    // Create havale/EFT instruction
    async createHavaleEFT(instructionData) {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, returning mock data');
            return { id: Date.now(), ...instructionData };
        }
        
        const { data, error } = await supabaseClient
            .from('payment_instructions')
            .insert([instructionData])
            .select()
            .single();

        if (error) {
            console.error('Talimat kaydedilirken hata oluştu:', error.message);
            throw new Error(`Talimat kaydedilemedi: ${error.message}`);
        }

        return data;
    },

    // Create vergi payment instruction
    async createVergi(instructionData) {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, returning mock data');
            return { id: Date.now(), ...instructionData };
        }
        
        const { data, error } = await supabaseClient
            .from('payment_instructions')
            .insert([instructionData])
            .select()
            .single();

        if (error) {
            console.error('Vergi talimatı kaydedilirken hata oluştu:', error.message);
            throw new Error(`Vergi talimatı kaydedilemedi: ${error.message}`);
        }

        return data;
    },

    // Create cari payment instruction (same as Havale/EFT for now)
    async createCari(instructionData) {
        // For now, we'll use the same function as Havale/EFT since the data structure is similar
        return await this.createHavaleEFT(instructionData);
    },

    // Check for duplicate havale/EFT instruction
    async checkDuplicateHavale(gondericiFirmaId, aliciFirmaId, tutar, aciklama) {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, skipping duplicate check');
            return false;
        }
        
        const { data, error } = await supabaseClient
            .from('payment_instructions')
            .select('id')
            .eq('gonderici_firma_id', gondericiFirmaId)
            .eq('alici_firma_id', aliciFirmaId)
            .eq('tutar', tutar)
            .eq('aciklama', aciklama || '')
            .eq('talimat_turu', 'Havale/EFT');

        if (error) {
            console.error('Duplike kontrol hatası:', error.message);
            throw new Error(`Duplike kontrolü yapılamadı: ${error.message}`);
        }

        return data && data.length > 0;
    },

    // Check for duplicate vergi instruction
    async checkDuplicateVergi(gondericiFirmaId, tutar, aciklama, vergiTuru, vergiDairesi, vergiKimlikNo) {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, skipping duplicate check');
            return false;
        }
        
        const { data, error } = await supabaseClient
            .from('payment_instructions')
            .select('id')
            .eq('gonderici_firma_id', gondericiFirmaId)
            .eq('tutar', tutar)
            .eq('aciklama', aciklama || '')
            .eq('talimat_turu', 'Vergi Ödemesi')
            .eq('vergi_turu', vergiTuru)
            .eq('vergi_dairesi', vergiDairesi || '')
            .eq('vergi_kimlik_no', vergiKimlikNo || '');

        if (error) {
            console.error('Vergi duplike kontrol hatası:', error.message);
            throw new Error(`Vergi duplike kontrolü yapılamadı: ${error.message}`);
        }

        return data && data.length > 0;
    },

    // Check for duplicate cari instruction
    async checkDuplicateCari(gondericiFirmaId, aliciFirmaId, tutar, aciklama) {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, skipping duplicate check');
            return false;
        }
        
        const { data, error } = await supabaseClient
            .from('payment_instructions')
            .select('id')
            .eq('gonderici_firma_id', gondericiFirmaId)
            .eq('alici_firma_id', aliciFirmaId)
            .eq('tutar', tutar)
            .eq('aciklama', aciklama || '')
            .eq('talimat_turu', 'Cari Hesap Ödemesi');

        if (error) {
            console.error('Cari duplike kontrol hatası:', error.message);
            throw new Error(`Cari duplike kontrolü yapılamadı: ${error.message}`);
        }

        return data && data.length > 0;
    },

    // Fetch all payment instructions with related data
    async fetchAll() {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, returning empty array');
            return [];
        }
        
        const { data, error } = await supabaseClient
            .from('payment_instructions')
            .select(`
                *,
                gonderici_firma:firms!payment_instructions_gonderici_firma_id_fkey(name),
                alici_firma:firms!payment_instructions_alici_firma_id_fkey(name),
                gonderici_banka:bank_accounts!payment_instructions_gonderici_banka_hesap_id_fkey(banka_adi, sube_adi, iban),
                alici_banka:bank_accounts!payment_instructions_alici_banka_hesap_id_fkey(banka_adi, sube_adi, iban)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Talimatlar çekilirken hata oluştu:', error.message);
            throw new Error(`Talimat verisi çekilemedi: ${error.message}`);
        }

        return data;
    },

    // Delete payment instruction by ID
    async deleteById(id) {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, skipping delete operation');
            return;
        }
        
        const { error } = await supabaseClient
            .from('payment_instructions')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Talimat silinirken hata oluştu:', error.message);
            throw new Error(`Talimat silinemedi: ${error.message}`);
        }
    }
};
