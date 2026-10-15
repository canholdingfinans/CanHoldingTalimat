/**
 * Supabase Integration Module
 * Handles all database operations and API calls
 */

const SUPABASE_URL = 'https://wygkdtlbjvdkhvvhkvxc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5Z2tkdGxianZka2h2dmhrdnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjk1OTksImV4cCI6MjA5OTYwNTU5OX0.ynghEKXttrQUOwMyrxHguYU6nzYeylXdeElwVU1o0cE';

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
 * Bulk delete concurrency lock to prevent race conditions & double triggering
 */
let isBulkDeleteInProgress = false;

/**
 * Asenkron bir işlemi belirtilen süre içinde tamamlanmaya zorlar (Timeout Kalkanı)
 * Supabase thenable nesnelerini güvenle Promise'e sarar ve süre aşımında kontrollü hata fırlatır.
 * 
 * @param {Promise|Object} promise - Supabase sorgusu veya asenkron işlem
 * @param {number} ms - Zaman aşımı süresi (milisaniye, varsayılan: 10000ms = 10sn)
 * @param {string} label - Telemetri ve hata mesajı etiketi
 * @returns {Promise}
 */
const withTimeout = (promise, ms = 10000, label = 'Sorgu') => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`⏱️ [Timeout] ${label} ${ms / 1000} saniye içinde sunucudan yanıt alamadı.`));
        }, ms);
    });

    return Promise.race([
        Promise.resolve(promise).finally(() => clearTimeout(timeoutId)),
        timeoutPromise
    ]);
};

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
    async create(name, turu, department = 'ORTAK', vknTcNo = null, vergiDairesi = null, sgkSicilNo = null, sgkAdi = null) {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, returning mock data');
            return { id: Date.now(), name, turu, department, vkn_tc_no: vknTcNo, vergi_dairesi: vergiDairesi, sgk_sicil_no: sgkSicilNo, sgk_adi: sgkAdi };
        }
        
        const { data, error } = await supabaseClient
            .from('firms')
            .insert([{ name, turu, department, vkn_tc_no: vknTcNo, vergi_dairesi: vergiDairesi, sgk_sicil_no: sgkSicilNo, sgk_adi: sgkAdi }])
            .select()
            .single();

        if (error) {
            console.error('Firma eklenirken hata oluştu:', error.message);
            throw new Error(`Firma eklenemedi: ${error.message}`);
        }

        return data;
    },

    // Add multiple firms (Bulk Insert)
    async createBulk(firmsArray) {
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, skipping bulk insert');
            return [];
        }
        
        // Transform incoming data to match database columns
        const dbFirms = firmsArray.map(firm => ({
            name: firm.name,
            turu: firm.turu,
            department: firm.department || 'ORTAK',
            vkn_tc_no: firm.vknTcNo || null,
            vergi_dairesi: firm.vergiDairesi || null,
            sgk_sicil_no: firm.sgkSicilNo || null,
            sgk_adi: firm.sgkAdi || null
        }));

        const { data, error } = await supabaseClient
            .from('firms')
            .insert(dbFirms)
            .select();

        if (error) {
            console.error('Firmalar toplu eklenirken hata oluştu:', error.message);
            throw new Error(`Toplu ekleme başarısız: ${error.message}`);
        }

        return data;
    },

    // Update existing firm
    async update(id, name, turu, department = 'ORTAK', vknTcNo = null, vergiDairesi = null, sgkSicilNo = null, sgkAdi = null) {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, returning mock data');
            return { id, name, turu, department, vkn_tc_no: vknTcNo, vergi_dairesi: vergiDairesi, sgk_sicil_no: sgkSicilNo, sgk_adi: sgkAdi };
        }
        
        const { data, error } = await supabaseClient
            .from('firms')
            .update({ name, turu, department: department || 'ORTAK', vkn_tc_no: vknTcNo, vergi_dairesi: vergiDairesi, sgk_sicil_no: sgkSicilNo, sgk_adi: sgkAdi })
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
            if (error.message.includes('violates foreign key constraint')) {
                throw new Error('Bu firma geçmiş bir talimatta kullanıldığı için silinemez. Silmek için öncelikle bu firmaya ait geçmiş talimatları arşivden (veya veritabanından) kaldırmalısınız.');
            }
            throw new Error(`Firma silinemedi: ${error.message}`);
        }
    },

    // Delete multiple firms with Chunking and Race Condition Lock
    async deleteBulk(ids) {
        if (isBulkDeleteInProgress) {
            console.warn('⚠️ [BulkDelete] Zaten devam eden bir toplu silme işlemi var, mükerrer istek engellendi.');
            return { success: false, message: 'İşlem devam ediyor' };
        }

        if (!ids || ids.length === 0) {
            console.log('ℹ️ [BulkDelete] Silinecek ID listesi boş.');
            return { success: true, deletedIds: [], failedIds: [] };
        }

        // Convert string IDs to numbers for PostgreSQL bigint compatibility
        const numericIds = ids.map(id => Number(id)).filter(id => !isNaN(id));

        if (numericIds.length === 0) {
            console.warn('⚠️ [BulkDelete] Geçerli sayısal ID bulunamadı.');
            return { success: true, deletedIds: [], failedIds: [] };
        }

        isBulkDeleteInProgress = true;
        console.log('🚀 [BulkDelete] 1. Fonksiyon başladı. Toplam ID sayısı:', numericIds.length);

        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('⚠️ [BulkDelete] Supabase client başlatılamadı, işlem atlanıyor.');
            isBulkDeleteInProgress = false;
            return { success: true, deletedIds: numericIds, failedIds: [] };
        }

        try {
            const usedIdsSet = new Set();

            // 1. AŞAMA: ID'leri 20'şerli güvenli paketlere böl (Chunking)
            const CHUNK_SIZE = 20;
            const idChunks = [];
            for (let i = 0; i < numericIds.length; i += CHUNK_SIZE) {
                idChunks.push(numericIds.slice(i, i + CHUNK_SIZE));
            }
            console.log(`📦 [BulkDelete] ID'ler ${idChunks.length} adet güvenli pakete ayrıldı (Paket boyutu: ${CHUNK_SIZE}).`);

            // 2. AŞAMA: Gönderici Kontrolleri (Paket Paket Sıralı Sorgulama - Timeout Kalkanlı)
            console.log(`⏳ [BulkDelete] 2. Gönderici kontrolleri başlatılıyor (${idChunks.length} paket)...`);
            for (let i = 0; i < idChunks.length; i++) {
                const chunk = idChunks[i];
                console.log(`⏳ [BulkDelete] 2.${i + 1}. Gönderici paketi sorgulanıyor (${chunk.length} ID)...`);

                const { data, error } = await withTimeout(
                    supabaseClient
                        .from('payment_instructions')
                        .select('gonderici_firma_id')
                        .in('gonderici_firma_id', chunk),
                    10000,
                    `Gönderici Kontrolü (Paket ${i + 1})`
                );

                if (error) {
                    console.error(`❌ [BulkDelete] Gönderici paket ${i + 1} hatası:`, error.message);
                    throw new Error(`Talimat kontrolü yapılamadı: ${error.message}`);
                }

                (data || []).forEach(row => {
                    if (row.gonderici_firma_id != null) {
                        usedIdsSet.add(Number(row.gonderici_firma_id));
                    }
                });
                console.log(`✅ [BulkDelete] 2.${i + 1}. Gönderici paketi tamamlandı.`);
            }

            // 3. AŞAMA: Alıcı Kontrolleri (Paket Paket Sıralı Sorgulama - Timeout Kalkanlı)
            console.log(`⏳ [BulkDelete] 3. Alıcı kontrolleri başlatılıyor (${idChunks.length} paket)...`);
            for (let i = 0; i < idChunks.length; i++) {
                const chunk = idChunks[i];
                console.log(`⏳ [BulkDelete] 3.${i + 1}. Alıcı paketi sorgulanıyor (${chunk.length} ID)...`);

                const { data, error } = await withTimeout(
                    supabaseClient
                        .from('payment_instructions')
                        .select('alici_firma_id')
                        .in('alici_firma_id', chunk),
                    10000,
                    `Alıcı Kontrolü (Paket ${i + 1})`
                );

                if (error) {
                    console.error(`❌ [BulkDelete] Alıcı paket ${i + 1} hatası:`, error.message);
                    throw new Error(`Talimat kontrolü yapılamadı: ${error.message}`);
                }

                (data || []).forEach(row => {
                    if (row.alici_firma_id != null) {
                        usedIdsSet.add(Number(row.alici_firma_id));
                    }
                });
                console.log(`✅ [BulkDelete] 3.${i + 1}. Alıcı paketi tamamlandı.`);
            }

            // 4. AŞAMA: Ayrıştırma (Temiz vs Kullanımda Olanlar)
            const failedIds = numericIds.filter(id => usedIdsSet.has(id));
            const cleanIds = numericIds.filter(id => !usedIdsSet.has(id));
            console.log('📊 [BulkDelete] 4. Ayrıştırma tamamlandı. Temiz ID\'ler:', cleanIds, 'Talimatlı (Korumaya alınan) ID\'ler:', failedIds);

            // 5. AŞAMA: Temiz ID'lerin Sıralı Güvenli Silinmesi (Timeout Kalkanlı)
            const successfullyDeleted = [];
            if (cleanIds.length > 0) {
                console.log(`🗑️ [BulkDelete] 5. Sıralı Tekil Silme Başlatılıyor (${cleanIds.length} firma)...`);
                for (const cleanId of cleanIds) {
                    console.log(`⏳ [BulkDelete] 5a. Firma siliniyor: ID ${cleanId}...`);
                    const { error: deleteError } = await withTimeout(
                        supabaseClient
                            .from('firms')
                            .delete()
                            .eq('id', cleanId),
                        10000,
                        `Firma Silme (ID ${cleanId})`
                    );

                    if (deleteError) {
                        console.error(`❌ [BulkDelete] Firma ID ${cleanId} silinemedi:`, deleteError.message);
                        failedIds.push(cleanId);
                    } else {
                        console.log(`✅ [BulkDelete] 5b. Firma ID ${cleanId} başarıyla silindi.`);
                        successfullyDeleted.push(cleanId);
                    }
                }
                console.log('✅ [BulkDelete] 6. Silme işlemi tamamlandı. Başarılı:', successfullyDeleted, 'Başarısız:', failedIds);
            } else {
                console.log('ℹ️ [BulkDelete] Silinecek temiz firma bulunamadı, tüm seçilenler geçmiş talimatlarda kullanımda.');
            }

            return {
                success: true,
                deletedIds: successfullyDeleted,
                failedIds: failedIds
            };
        } catch (error) {
            console.error('❌ [BulkDelete] deleteBulk genel hatası:', error);
            throw error;
        } finally {
            isBulkDeleteInProgress = false;
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

    // Add multiple bank accounts (Bulk Insert)
    async createBulk(bankaDataArray) {
        if (!bankaDataArray || bankaDataArray.length === 0) return [];
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, skipping bulk insert');
            return [];
        }
        const { data, error } = await supabaseClient
            .from('bank_accounts')
            .insert(bankaDataArray)
            .select();
        if (error) {
            console.error('Bankalar toplu eklenirken hata oluştu:', error.message);
            throw new Error(`Toplu banka ekleme başarısız: ${error.message}`);
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

    // Create doviz instruction
    async createDoviz(instructionData) {
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
            console.error('Döviz talimatı kaydedilirken hata oluştu:', error.message);
            throw new Error(`Döviz talimatı kaydedilemedi: ${error.message}`);
        }

        return data;
    },

    // Check for duplicate doviz instruction
    async checkDuplicateDoviz(gondericiBankaHesapId, dovizIslemiTuru, tutar, talimatTarihi) {
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, skipping duplicate check');
            return false;
        }
        
        const { data, error } = await supabaseClient
            .from('payment_instructions')
            .select('id')
            .eq('talimat_turu', 'Döviz Alım/Satım')
            .eq('gonderici_banka_hesap_id', gondericiBankaHesapId)
            .eq('doviz_islemi_turu', dovizIslemiTuru) // Zaten toLowerCase ile gelecek
            .eq('tutar', tutar)
            .eq('talimat_tarihi', talimatTarihi)
            .limit(1);

        if (error) {
            console.error('Döviz duplike kontrol hatası:', error.message);
            throw new Error(`Döviz duplike kontrolü yapılamadı: ${error.message}`);
        }

        return data && data.length > 0;
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

    // Soft delete (cancel) payment instruction by ID
    async deleteById(id) {
        // Check if supabaseClient is properly initialized
        if (!supabaseClient || !supabaseClient.from) {
            console.warn('Supabase client not initialized, skipping cancel operation');
            return;
        }
        
        const { error } = await supabaseClient
            .from('payment_instructions')
            .update({ durum: 'iptal' })
            .eq('id', id);

        if (error) {
            console.error('Talimat iptal edilirken hata oluştu:', error.message);
            throw new Error(`Talimat iptal edilemedi: ${error.message}`);
        }
    }
};

export { supabaseClient };
