/**
 * Firmalar (Companies) Module
 * Handles company management functionality
 */

import { firmaOperations } from './supabase-entegrasyonu.js';
import { validateFirmName } from './validasyon.js';

// Company data storage
let firmalar = [];

/**
 * Get all companies
 * @returns {Array} Array of companies
 */
export const getFirmalar = () => {
    return firmalar;
};

/**
 * Find company by ID
 * @param {string|number} id - Company ID
 * @returns {Object|null} Company object or null if not found
 */
export const findFirmaById = (id) => {
    return firmalar.find(f => f.id == id) || null;
};

/**
 * Fetch companies from database with optional filters
 * @param {string} searchTerm - Search term for company name
 * @param {string} filterType - Filter by company type ('all', 'grup', 'satıcı', 'müşteri')
 * @returns {Promise<Array>} Array of companies
 */
export const fetchFirmalar = async (searchTerm = '', filterType = 'all') => {
    try {
        const data = await firmaOperations.fetchAll(searchTerm, filterType);
        
        // Remove duplicates (same name, case-insensitive)
        const uniqueFirmalar = [];
        const seenNames = new Set();
        
        data.forEach(firma => {
            const lowerName = firma.name.toLowerCase();
            if (!seenNames.has(lowerName)) {
                seenNames.add(lowerName);
                uniqueFirmalar.push(firma);
            }
        });
        
        firmalar = uniqueFirmalar;
        return firmalar;
    } catch (error) {
        console.error('Firmalar çekilirken hata:', error);
        throw error;
    }
};

/**
 * Add new company
 * @param {string} name - Company name
 * @param {string} turu - Company type
 * @param {string} vknTcNo - Company tax number (optional)
 * @param {string} vergiDairesi - Company tax office (optional)
 * @param {string} sgkSicilNo - Company SGK registration number (optional)
 * @param {string} sgkAdi - Company SGK name (optional)
 * @returns {Promise<Object>} Created company object
 */
export const addFirma = async (name, turu, vknTcNo, vergiDairesi, sgkSicilNo, sgkAdi) => {
    try {
        // Validate inputs
        const nameValidation = validateFirmName(name);
        if (!nameValidation.isValid) {
            throw new Error(nameValidation.message);
        }

        if (!turu) {
            throw new Error('Firma türü seçilmelidir.');
        }

        // Validate tax number if provided
        if (vknTcNo && !isValidVknTcNo(vknTcNo)) {
            throw new Error('VKN/T.C. No 10 veya 11 haneli olmalıdır ve sadece rakam içermelidir.');
        }

        // Check for duplicates
        const isDuplicate = await firmaOperations.checkDuplicate(name);
        if (isDuplicate) {
            throw new Error(`"${name}" adında bir firma zaten mevcut. Lütfen farklı bir ad kullanın.`);
        }

        // Create company
        const data = await firmaOperations.create(name.trim(), turu, vknTcNo, vergiDairesi, sgkSicilNo, sgkAdi);
        
        // Add to local array
        data.bankalar = [];
        firmalar.push(data);
        
        return data;
    } catch (error) {
        console.error('Firma eklenirken hata:', error);
        throw error;
    }
};

/**
 * Update existing company
 * @param {string|number} id - Company ID
 * @param {string} name - Company name
 * @param {string} turu - Company type
 * @param {string} vknTcNo - Company tax number (optional)
 * @param {string} vergiDairesi - Company tax office (optional)
 * @returns {Promise<Object>} Updated company object
 */
export const updateFirma = async (id, name, turu, vknTcNo, vergiDairesi, sgkSicilNo, sgkAdi) => {
    try {
        // Validate inputs
        const nameValidation = validateFirmName(name);
        if (!nameValidation.isValid) {
            throw new Error(nameValidation.message);
        }

        if (!turu) {
            throw new Error('Firma türü seçilmelidir.');
        }

        // Validate tax number if provided
        if (vknTcNo && !isValidVknTcNo(vknTcNo)) {
            throw new Error('VKN/T.C. No 10 veya 11 haneli olmalıdır ve sadece rakam içermelidir.');
        }

        // Check for duplicates (excluding current company)
        const isDuplicate = await firmaOperations.checkDuplicate(name, id);
        if (isDuplicate) {
            throw new Error(`"${name}" adında bir firma zaten mevcut. Lütfen farklı bir ad kullanın.`);
        }

        // Update company
        const data = await firmaOperations.update(id, name.trim(), turu, vknTcNo, vergiDairesi, sgkSicilNo, sgkAdi);
        
        // Update local array
        const index = firmalar.findIndex(f => f.id == data.id);
        if (index !== -1) {
            firmalar[index].name = data.name;
            firmalar[index].turu = data.turu;
            firmalar[index].vkn_tc_no = data.vkn_tc_no;
            firmalar[index].vergi_dairesi = data.vergi_dairesi;
            firmalar[index].sgk_sicil_no = data.sgk_sicil_no;
            firmalar[index].sgk_adi = data.sgk_adi;
        }
        
        return data;
    } catch (error) {
        console.error('Firma güncellenirken hata:', error);
        throw error;
    }
};

/**
 * Delete company
 * @param {string|number} id - Company ID
 * @returns {Promise<void>}
 */
export const deleteFirma = async (id) => {
    try {
        await firmaOperations.delete(id);
        
        // Remove from local array
        const index = firmalar.findIndex(f => f.id == id);
        if (index > -1) {
            firmalar.splice(index, 1);
        }
    } catch (error) {
        console.error('Firma silinirken hata:', error);
        throw error;
    }
};

/**
 * Validate tax number (VKN/T.C. No)
 * @param {string} vknTcNo - Tax number to validate
 * @returns {boolean} True if valid, false otherwise
 */
const isValidVknTcNo = (vknTcNo) => {
    // Check if it's 10 or 11 digits only
    return /^[0-9]{10,11}$/.test(vknTcNo);
};

/**
 * Add bank account to company
 * @param {string|number} firmaId - Company ID
 * @param {Object} bankData - Bank account data
 */
export const addBankToFirma = (firmaId, bankData) => {
    const firma = findFirmaById(firmaId);
    if (firma) {
        if (!firma.bankalar) {
            firma.bankalar = [];
        }
        firma.bankalar.push(bankData);
    }
};

/**
 * Update bank account in company
 * @param {string|number} firmaId - Company ID
 * @param {Object} bankData - Updated bank account data
 */
export const updateBankInFirma = (firmaId, bankData) => {
    const firma = findFirmaById(firmaId);
    if (firma && firma.bankalar) {
        const index = firma.bankalar.findIndex(b => b.id == bankData.id);
        if (index !== -1) {
            firma.bankalar[index] = bankData;
        }
    }
};

/**
 * Remove bank account from company
 * @param {string|number} firmaId - Company ID
 * @param {string|number} bankId - Bank account ID
 */
export const removeBankFromFirma = (firmaId, bankId) => {
    const firma = findFirmaById(firmaId);
    if (firma && firma.bankalar) {
        const index = firma.bankalar.findIndex(b => b.id == bankId);
        if (index !== -1) {
            firma.bankalar.splice(index, 1);
        }
    }
};

/**
 * Get company types for dropdown
 * @returns {Array} Array of company types
 */
export const getFirmaTurleri = () => {
    return [
        { value: 'grup', label: 'Grup' },
        { value: 'satıcı', label: 'Satıcı' },
        { value: 'müşteri', label: 'Müşteri' }
    ];
};

/**
 * Filter companies by type
 * @param {string} type - Company type to filter by
 * @returns {Array} Filtered array of companies
 */
export const filterFirmalarByType = (type) => {
    if (type === 'all') {
        return firmalar;
    }
    return firmalar.filter(firma => firma.turu === type);
};

/**
 * Search companies by name
 * @param {string} searchTerm - Search term
 * @returns {Array} Filtered array of companies
 */
export const searchFirmalar = (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
        return firmalar;
    }
    
    const lowerSearch = searchTerm.toLowerCase();
    return firmalar.filter(firma => 
        firma.name.toLowerCase().includes(lowerSearch)
    );
};

/**
 * Get companies sorted by name
 * @returns {Array} Sorted array of companies
 */
export const getSortedFirmalar = () => {
    return [...firmalar].sort((a, b) => a.name.localeCompare(b.name));
};