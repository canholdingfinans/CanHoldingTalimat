/**
 * Bankalar (Banks) Module
 * Handles bank account management functionality
 */

import { bankaOperations } from './supabase-entegrasyonu.js';
import { validateIBAN, validateBankName, validateSWIFTCode, validateIBANExtended } from './validasyon.js';
import { findFirmaById, addBankToFirma, updateBankInFirma, removeBankFromFirma, getFirmalar } from './firmalar.js';

/**
 * Get available currency options
 * @returns {Array} Array of currency objects
 */
export const getCurrencies = () => {
    return [
        { code: 'TRY', name: 'Türk Lirası' },
        { code: 'EUR', name: 'Euro' },
        { code: 'USD', name: 'Amerikan Doları' },
        { code: 'GBP', name: 'İngiliz Sterlini' },
        { code: 'CHF', name: 'İsviçre Frangı' }
    ];
};

/**
 * Find bank account by ID across all companies
 * @param {string|number} bankId - Bank account ID
 * @returns {Object|null} Bank account object with company info or null if not found
 */
export const findBankById = (bankId) => {
    const firmalar = getFirmalar();

    for (const firma of firmalar) {
        if (firma.bankalar) {
            const bank = firma.bankalar.find(b => b.id == bankId);
            if (bank) {
                return {
                    ...bank,
                    firma: firma
                };
            }
        }
    }
    return null;
};

/**
 * Get bank accounts for a specific company
 * @param {string|number} firmaId - Company ID
 * @returns {Array} Array of bank accounts
 */
export const getBanksForFirma = (firmaId) => {
    const firma = findFirmaById(firmaId);
    return firma?.bankalar || [];
};

/**
 * Check if IBAN already exists (excluding specific bank ID)
 * @param {string} iban - IBAN to check
 * @param {string|number} excludeBankId - Bank ID to exclude from check
 * @returns {boolean} True if IBAN exists, false otherwise
 */
export const checkIBANExists = (iban, excludeBankId = null) => {
    const firmalar = getFirmalar();

    return firmalar.some(firma =>
        (firma.bankalar || []).some(banka =>
            banka.iban?.toUpperCase() === iban?.toUpperCase() && banka.id != excludeBankId
        )
    );
};

/**
 * Add new bank account
 * @param {Object} bankData - Bank account data
 * @returns {Promise<Object>} Created bank account object
 */
export const addBanka = async (bankData) => {
    try {
        // Validate required fields
        if (!bankData.firm_id) {
            throw new Error('Firma seçilmelidir.');
        }

        const nameValidation = validateBankName(bankData.banka_adi);
        if (!nameValidation.isValid) {
            throw new Error(nameValidation.message);
        }

        const firma = findFirmaById(bankData.firm_id);
        const isGrup = firma?.turu === 'grup';

        if (isGrup && !bankData.sube_adi?.trim()) {
            throw new Error('Grup firmaları için Şube Adı zorunludur.');
        }

        if (isGrup && !bankData.sube_il?.trim()) {
            throw new Error('Grup firmaları için Şube İli zorunludur.');
        }

        if (!bankData.para_birimi) {
            throw new Error('Para birimi seçilmelidir.');
        }

        // Validate and clean IBAN
        const cleanIban = bankData.iban.replace(/\s+/g, '');
        const ibanValidation = validateIBAN(cleanIban);
        if (!ibanValidation) {
            throw new Error('IBAN numarası 26 haneli olmalıdır.');
        }

        // Check for duplicate IBAN
        const isIbanDuplicate = checkIBANExists(cleanIban);
        if (isIbanDuplicate) {
            throw new Error('Bu IBAN numarası sistemde zaten kayıtlı. Lütfen kontrol ediniz.');
        }

        // Validate SWIFT code if provided
        if (bankData.swift_kodu) {
            const swiftValidation = validateSWIFTCode(bankData.swift_kodu);
            if (!swiftValidation.isValid) {
                throw new Error(swiftValidation.message);
            }
        }

        // Prepare clean data
        const cleanBankData = {
            ...bankData,
            banka_adi: bankData.banka_adi.trim(),
            sube_adi: bankData.sube_adi?.trim() || null,
            sube_il: bankData.sube_il?.trim() || null,
            iban: cleanIban,
            hesap_no: bankData.hesap_no?.trim() || null,
            swift_kodu: bankData.swift_kodu?.trim().toUpperCase() || null
        };

        // Create bank account
        const data = await bankaOperations.create(cleanBankData);

        // Add to local company data
        addBankToFirma(bankData.firm_id, data);

        return data;
    } catch (error) {
        console.error('Banka hesabı eklenirken hata:', error);
        throw error;
    }
};

/**
 * Update existing bank account
 * @param {string|number} bankId - Bank account ID
 * @param {Object} bankData - Updated bank account data
 * @returns {Promise<Object>} Updated bank account object
 */
export const updateBanka = async (bankId, bankData) => {
    try {
        // Validate required fields
        const nameValidation = validateBankName(bankData.banka_adi);
        if (!nameValidation.isValid) {
            throw new Error(nameValidation.message);
        }

        const firma = findFirmaById(bankData.firm_id);
        const isGrup = firma?.turu === 'grup';

        if (isGrup && !bankData.sube_adi?.trim()) {
            throw new Error('Grup firmaları için Şube Adı zorunludur.');
        }

        if (isGrup && !bankData.sube_il?.trim()) {
            throw new Error('Grup firmaları için Şube İli zorunludur.');
        }

        if (!bankData.para_birimi) {
            throw new Error('Para birimi seçilmelidir.');
        }

        // Validate and clean IBAN
        const cleanIban = bankData.iban.replace(/\s+/g, '');
        const ibanValidation = validateIBAN(cleanIban);
        if (!ibanValidation) {
            throw new Error('IBAN numarası 26 haneli olmalıdır.');
        }

        // Check for duplicate IBAN (excluding current account)
        const isIbanDuplicate = checkIBANExists(cleanIban, bankId);
        if (isIbanDuplicate) {
            throw new Error('Bu IBAN numarası sistemde zaten kayıtlı. Lütfen kontrol ediniz.');
        }

        // Validate SWIFT code if provided
        if (bankData.swift_kodu) {
            const swiftValidation = validateSWIFTCode(bankData.swift_kodu);
            if (!swiftValidation.isValid) {
                throw new Error(swiftValidation.message);
            }
        }

        // Prepare clean data
        const cleanBankData = {
            banka_adi: bankData.banka_adi.trim(),
            sube_adi: bankData.sube_adi?.trim() || null,
            sube_il: bankData.sube_il?.trim() || null,
            iban: cleanIban,
            para_birimi: bankData.para_birimi,
            hesap_no: bankData.hesap_no?.trim() || null,
            swift_kodu: bankData.swift_kodu?.trim().toUpperCase() || null,
            firm_id: bankData.firm_id
        };

        // Update bank account
        const data = await bankaOperations.update(bankId, cleanBankData);

        // Update local company data
        updateBankInFirma(data.firm_id, data);

        return data;
    } catch (error) {
        console.error('Banka hesabı güncellenirken hata:', error);
        throw error;
    }
};

/**
 * Add multiple bank accounts (Bulk Upload)
 * @param {Array} bankaSatirlari - Array of bank account row objects from Excel
 * @param {Map} firmaMap - Map<firmaAdiLowercase, {id, turu, name, yeni}>
 * @returns {Promise<Object>} { eklenen: Array, atlanan: Array, hatali: Array }
 */
export const addBankaBulk = async (bankaSatirlari, firmaMap) => {
    const eklenen = [];
    const atlanan = [];
    const hatali = [];
    const gecerliSatirlar = [];
    const gorulenIbanlar = new Set();

    for (const satir of bankaSatirlari) {
        const key = satir.firmaAdi.toLowerCase().trim();
        const firma = firmaMap.get(key);

        if (!firma) {
            hatali.push({ satirNo: satir.satirNo, sebep: `Firma bulunamadı: ${satir.firmaAdi}` });
            continue;
        }
        if (!satir.banka_adi || satir.banka_adi.trim() === '') {
            hatali.push({ satirNo: satir.satirNo, sebep: 'Banka Adı zorunludur.' });
            continue;
        }
        const isGrup = firma.turu === 'grup';
        if (isGrup && (!satir.sube_adi?.trim() || !satir.sube_il?.trim())) {
            hatali.push({ satirNo: satir.satirNo, sebep: 'Grup firmaları için Şube Adı ve Şube İli zorunludur.' });
            continue;
        }
        const gecerliParaBirimleri = ['TRY', 'USD', 'EUR', 'GBP', 'CHF'];
        const paraBirimi = satir.para_birimi?.trim().toUpperCase();
        if (!gecerliParaBirimleri.includes(paraBirimi)) {
            hatali.push({ satirNo: satir.satirNo, sebep: `Geçersiz para birimi: ${satir.para_birimi}` });
            continue;
        }
        const cleanIban = (satir.iban || '').replace(/\s+/g, '').toUpperCase();
        if (!validateIBANExtended(cleanIban)) {
            hatali.push({ satirNo: satir.satirNo, sebep: 'IBAN formatı geçersiz.' });
            continue;
        }
        if (checkIBANExists(cleanIban) || gorulenIbanlar.has(cleanIban)) {
            atlanan.push({ satirNo: satir.satirNo, sebep: 'Bu IBAN zaten kayıtlı.' });
            continue;
        }
        if (satir.swift_kodu) {
            const swiftValidation = validateSWIFTCode(satir.swift_kodu);
            if (!swiftValidation.isValid) {
                hatali.push({ satirNo: satir.satirNo, sebep: swiftValidation.message });
                continue;
            }
        }

        gorulenIbanlar.add(cleanIban);
        gecerliSatirlar.push({
            firm_id: firma.id,
            banka_adi: satir.banka_adi.trim(),
            sube_adi: satir.sube_adi?.trim() || null,
            sube_il: satir.sube_il?.trim() || null,
            iban: cleanIban,
            para_birimi: paraBirimi,
            hesap_no: satir.hesap_no?.trim() || null,
            swift_kodu: satir.swift_kodu?.trim().toUpperCase() || null,
            _satirNo: satir.satirNo
        });
    }

    if (gecerliSatirlar.length > 0) {
        const dbHazir = gecerliSatirlar.map(({ _satirNo, ...rest }) => rest);
        const data = await bankaOperations.createBulk(dbHazir);
        data.forEach(d => {
            addBankToFirma(d.firm_id, d);
            eklenen.push(d);
        });
    }

    return { eklenen, atlanan, hatali };
};

/**
 * Delete bank account
 * @param {string|number} bankId - Bank account ID
 * @param {string|number} firmaId - Company ID
 * @returns {Promise<void>}
 */
export const deleteBanka = async (bankId, firmaId) => {
    try {
        await bankaOperations.delete(bankId);

        // Remove from local company data
        removeBankFromFirma(firmaId, bankId);
    } catch (error) {
        console.error('Banka hesabı silinirken hata:', error);
        throw error;
    }
};

/**
 * Get bank accounts by currency
 * @param {string} currency - Currency code (e.g., 'TRY', 'EUR')
 * @returns {Array} Array of bank accounts with that currency
 */
export const getBanksByCurrency = (currency) => {
    const firmalar = getFirmalar();
    const banks = [];

    firmalar.forEach(firma => {
        if (firma.bankalar) {
            firma.bankalar.forEach(banka => {
                if (banka.para_birimi === currency) {
                    banks.push({
                        ...banka,
                        firma: firma
                    });
                }
            });
        }
    });

    return banks;
};

/**
 * Get all bank accounts across all companies
 * @returns {Array} Array of all bank accounts with company info
 */
export const getAllBanks = () => {
    const firmalar = getFirmalar();
    const allBanks = [];

    firmalar.forEach(firma => {
        if (firma.bankalar) {
            firma.bankalar.forEach(banka => {
                allBanks.push({
                    ...banka,
                    firma: firma
                });
            });
        }
    });

    return allBanks;
};

/**
 * Get bank statistics
 * @returns {Object} Statistics about bank accounts
 */
export const getBankStatistics = () => {
    const allBanks = getAllBanks();
    const stats = {
        total: allBanks.length,
        byCurrency: {},
        byBank: {},
        companiesWithBanks: 0,
        companiesWithoutBanks: 0
    };

    // Count by currency and bank name
    allBanks.forEach(bank => {
        // By currency
        stats.byCurrency[bank.para_birimi] = (stats.byCurrency[bank.para_birimi] || 0) + 1;

        // By bank name
        stats.byBank[bank.banka_adi] = (stats.byBank[bank.banka_adi] || 0) + 1;
    });

    // Count companies with/without banks
    const firmalar = getFirmalar();
    firmalar.forEach(firma => {
        if (firma.bankalar && firma.bankalar.length > 0) {
            stats.companiesWithBanks++;
        } else {
            stats.companiesWithoutBanks++;
        }
    });

    return stats;
};

/**
 * Format IBAN for display (with spaces every 4 characters)
 * @param {string} iban - IBAN to format
 * @returns {string} Formatted IBAN
 */
export const formatIBAN = (iban) => {
    if (!iban) return '';

    // Remove existing spaces
    const cleanIban = iban.replace(/\s/g, '');

    // Add spaces every 4 characters
    return cleanIban.replace(/(.{4})/g, '$1 ').trim();
};

/**
 * Get bank account display name
 * @param {Object} bank - Bank account object
 * @returns {string} Display name for bank account
 */
export const getBankDisplayName = (bank) => {
    if (!bank) return '';

    return `${bank.banka_adi} - ${bank.para_birimi}`;
};

/**
 * Check currency compatibility between two bank accounts
 * @param {Object} bank1 - First bank account
 * @param {Object} bank2 - Second bank account
 * @returns {boolean} True if currencies match, false otherwise
 */
export const checkCurrencyCompatibility = (bank1, bank2) => {
    if (!bank1 || !bank2) return false;

    return bank1.para_birimi === bank2.para_birimi;
};