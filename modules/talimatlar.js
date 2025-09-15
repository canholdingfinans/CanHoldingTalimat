/**
 * Talimatlar (Instructions) Module
 * Handles payment instruction creation and management
 */

import { talimatOperations } from './supabase-entegrasyonu.js';
import { validateHavaleEFTForm, validateVergiForm, validateCurrencyMatch } from './validasyon.js';
import { findFirmaById } from './firmalar.js';
import { findBankById, checkCurrencyCompatibility } from './bankalar.js';
import { getCurrentInstructionType } from './ui-etkilesimleri.js';

// Instruction type configurations (moved from main script)
export const instructionTypes = {
    // Havale/EFT Types
    'havale-ic': {
        title: 'İç Transfer',
        category: 'havale',
        formFields: ['gonderici', 'alici', 'tutar', 'aciklama'],
        dbType: 'Havale/EFT',
        subType: 'İç Transfer'
    },
    'havale-dis': {
        title: 'Dış Transfer', 
        category: 'havale',
        formFields: ['gonderici', 'alici', 'tutar', 'aciklama', 'swift'],
        dbType: 'Havale/EFT',
        subType: 'Dış Transfer'
    },
    
    // Tax Payment Types
    'vergi-kdv1': {
        title: 'KDV-1',
        category: 'vergi',
        formFields: ['gonderici', 'vergi_turu', 'vergi_dairesi', 'vergi_kimlik_no', 'tutar', 'aciklama', 'tahakkuk_no', 'donem'],
        dbType: 'Vergi Ödemesi', 
        subType: 'KDV-1'
    },
    'vergi-kdv2': {
        title: 'KDV-2 - Tevkifat',
        category: 'vergi',
        formFields: ['gonderici', 'vergi_turu', 'vergi_dairesi', 'vergi_kimlik_no', 'tutar', 'aciklama', 'tahakkuk_no', 'donem'],
        dbType: 'Vergi Ödemesi',
        subType: 'KDV-2 - Tevkifat'
    },
    'vergi-muhtasar-hizmet': {
        title: 'Muhtasar Hizmet',
        category: 'vergi',
        formFields: ['gonderici', 'vergi_turu', 'vergi_dairesi', 'vergi_kimlik_no', 'tutar', 'aciklama', 'tahakkuk_no', 'donem'],
        dbType: 'Vergi Ödemesi',
        subType: 'Muhtasar Hizmet'
    },
    'vergi-muhtasar-ucret': {
        title: 'Muhtasar Ücret',
        category: 'vergi',
        formFields: ['gonderici', 'vergi_turu', 'vergi_dairesi', 'vergi_kimlik_no', 'tutar', 'aciklama', 'tahakkuk_no', 'donem'],
        dbType: 'Vergi Ödemesi',
        subType: 'Muhtasar Ücret'
    },
    'vergi-kurum-gecici': {
        title: 'Kurumlar Geçici',
        category: 'vergi',
        formFields: ['gonderici', 'vergi_turu', 'vergi_dairesi', 'vergi_kimlik_no', 'tutar', 'aciklama', 'tahakkuk_no', 'donem'],
        dbType: 'Vergi Ödemesi',
        subType: 'Kurumlar Geçici'
    },
    'vergi-damga': {
        title: 'Damga Vergisi',
        category: 'vergi',
        formFields: ['gonderici', 'vergi_turu', 'vergi_dairesi', 'vergi_kimlik_no', 'tutar', 'aciklama', 'tahakkuk_no', 'donem'],
        dbType: 'Vergi Ödemesi',
        subType: 'Damga Vergisi'
    },
    'vergi-gekap': {
        title: 'Gekap',
        category: 'vergi',
        formFields: ['gonderici', 'vergi_turu', 'vergi_dairesi', 'vergi_kimlik_no', 'tutar', 'aciklama', 'tahakkuk_no', 'donem'],
        dbType: 'Vergi Ödemesi',
        subType: 'Gekap'
    },
    
    // SGK Payment Types
    'sgk-prim': {
        title: 'SGK Primi',
        category: 'sgk',
        formFields: ['gonderici', 'sgk_sicil_no', 'tutar', 'aciklama', 'prim_donem'],
        dbType: 'SGK Ödemesi',
        subType: 'SGK Primi'
    },
    
    // Customs Payment Types
    'gumruk-vergi': {
        title: 'Gümrük Vergisi',
        category: 'gumruk',
        formFields: ['gonderici', 'gumruk_beyanname_no', 'tutar', 'aciklama', 'gtip_kodu'],
        dbType: 'Gümrük Ödemesi',
        subType: 'Gümrük Vergisi'
    },
    'gumruk-otv': {
        title: 'ÖTV Ödemesi',
        category: 'gumruk',
        formFields: ['gonderici', 'gumruk_beyanname_no', 'tutar', 'aciklama', 'otv_orani'],
        dbType: 'Gümrük Ödemesi',
        subType: 'ÖTV Ödemesi'
    },
    'gumruk-harc': {
        title: 'İthalat Harcı',
        category: 'gumruk',
        formFields: ['gonderici', 'gumruk_beyanname_no', 'tutar', 'aciklama', 'harc_turu'],
        dbType: 'Gümrük Ödemesi',
        subType: 'İthalat Harcı'
    },
    
    // Current Account Payment Types (NEW)
    'cari-satici': {
        title: 'Satıcı Ödemesi',
        category: 'cari',
        formFields: ['gonderici', 'alici', 'tutar', 'aciklama'],
        dbType: 'Cari Hesap Ödemesi',
        subType: 'Satıcı Ödemesi'
    },
    'cari-musteri': {
        title: 'Müşteri Ödemesi',
        category: 'cari',
        formFields: ['gonderici', 'alici', 'tutar', 'aciklama'],
        dbType: 'Cari Hesap Ödemesi',
        subType: 'Müşteri Ödemesi'
    }
};

/**
 * Create Havale/EFT instruction
 * @param {Object} formData - Form data object
 * @returns {Promise<Object>} Created instruction object
 */
export const createHavaleEFTInstruction = async (formData) => {
    try {
        // Get company and bank data
        const gondericiFirma = findFirmaById(formData.gondericiFirma);
        const gondericiBanka = gondericiFirma?.bankalar.find(b => b.id == formData.gondericiBanka);
        const aliciFirma = findFirmaById(formData.aliciFirma);
        const aliciBanka = aliciFirma?.bankalar.find(b => b.id == formData.aliciBanka);
        
        // DEBUG: Log the bank selection process for SWIFT code debugging
        console.log('=== HAVALE INSTRUCTION DEBUG ===');
        console.log('Form Data - Alıcı Firma ID:', formData.aliciFirma);
        console.log('Form Data - Alıcı Banka ID:', formData.aliciBanka);
        console.log('Found Alıcı Firma:', aliciFirma);
        console.log('Found Alıcı Banka:', aliciBanka);
        if (aliciFirma && aliciFirma.bankalar) {
            console.log('Alıcı Firma Bankalar Array:', aliciFirma.bankalar);
            aliciFirma.bankalar.forEach((banka, index) => {
                console.log(`Bank ${index}:`, {
                    id: banka.id,
                    banka_adi: banka.banka_adi,
                    swift_kodu: banka.swift_kodu,
                    hasSwift: !!banka.swift_kodu
                });
            });
        }
        console.log('===============================');
        
        if (!gondericiFirma || !gondericiBanka || !aliciFirma || !aliciBanka) {
            throw new Error('Gönderici veya alıcı bilgileri eksik.');
        }
        
        // Validate form data
        const validation = validateHavaleEFTForm({
            gondericiFirma: gondericiFirma.id,
            gondericiBanka: gondericiBanka.id,
            aliciFirma: aliciFirma.id,
            aliciBanka: aliciBanka.id,
            tutar: formData.tutar,
            talimatTarihi: formData.talimatTarihi
        });
        
        if (!validation.isValid) {
            throw new Error(validation.errors.join('\n'));
        }
        
        // Check currency compatibility
        const currencyCheck = validateCurrencyMatch(gondericiBanka, aliciBanka);
        if (!currencyCheck.isValid) {
            throw new Error(currencyCheck.message);
        }
        
        // Check for duplicates
        const isDuplicate = await talimatOperations.checkDuplicateHavale(
            gondericiFirma.id,
            aliciFirma.id,
            formData.tutar,
            formData.aciklama || ''
        );
        
        if (isDuplicate) {
            throw new Error('Bu talimat daha önce oluşturulmuş. Mükerrer kayıt yapılamaz.');
        }
        
        // Get next instruction number
        const nextNumber = await talimatOperations.getNextInstructionNumber();
        
        // Prepare instruction data
        const instructionData = {
            gonderici_firma_id: gondericiFirma.id,
            gonderici_banka_hesap_id: gondericiBanka.id,
            alici_firma_id: aliciFirma.id,
            alici_banka_hesap_id: aliciBanka.id,
            tutar: parseFloat(formData.tutar),
            para_birimi: gondericiBanka.para_birimi,
            aciklama: formData.aciklama || '',
            talimat_tarihi: formData.talimatTarihi,
            talimat_turu: 'Havale/EFT',
            instruction_number: nextNumber
        };
        
        // Create instruction
        const data = await talimatOperations.createHavaleEFT(instructionData);
        
        return {
            instruction: data,
            gondericiFirma,
            gondericiBanka,
            aliciFirma,
            aliciBanka
        };
    } catch (error) {
        console.error('Havale/EFT talimatı oluşturulurken hata:', error);
        throw error;
    }
};

/**
 * Create cari payment instruction
 * @param {Object} formData - Form data object
 * @returns {Promise<Object>} Created instruction object
 */
export const createCariInstruction = async (formData) => {
    try {
        // Get company and bank data
        const gondericiFirma = findFirmaById(formData.gondericiFirma);
        const gondericiBanka = gondericiFirma?.bankalar.find(b => b.id == formData.gondericiBanka);
        const aliciFirma = findFirmaById(formData.aliciFirma);
        const aliciBanka = aliciFirma?.bankalar.find(b => b.id == formData.aliciBanka);
        
        if (!gondericiFirma || !gondericiBanka || !aliciFirma || !aliciBanka) {
            throw new Error('Gönderici veya alıcı bilgileri eksik.');
        }
        
        // Validate form data
        const validation = validateHavaleEFTForm({
            gondericiFirma: gondericiFirma.id,
            gondericiBanka: gondericiBanka.id,
            aliciFirma: aliciFirma.id,
            aliciBanka: aliciBanka.id,
            tutar: formData.tutar,
            talimatTarihi: formData.talimatTarihi
        });
        
        if (!validation.isValid) {
            throw new Error(validation.errors.join('\n'));
        }
        
        // Check currency compatibility
        const currencyCheck = validateCurrencyMatch(gondericiBanka, aliciBanka);
        if (!currencyCheck.isValid) {
            throw new Error(currencyCheck.message);
        }
        
        // Check for duplicates
        const isDuplicate = await talimatOperations.checkDuplicateCari(
            gondericiFirma.id,
            aliciFirma.id,
            formData.tutar,
            formData.aciklama || ''
        );
        
        if (isDuplicate) {
            throw new Error('Bu talimat daha önce oluşturulmuş. Mükerrer kayıt yapılamaz.');
        }
        
        // Get next instruction number
        const nextNumber = await talimatOperations.getNextInstructionNumber();
        
        // Prepare instruction data
        const instructionData = {
            gonderici_firma_id: gondericiFirma.id,
            gonderici_banka_hesap_id: gondericiBanka.id,
            alici_firma_id: aliciFirma.id,
            alici_banka_hesap_id: aliciBanka.id,
            tutar: parseFloat(formData.tutar),
            para_birimi: gondericiBanka.para_birimi,
            aciklama: formData.aciklama || '',
            talimat_tarihi: formData.talimatTarihi,
            talimat_turu: 'Cari Hesap Ödemesi',
            instruction_number: nextNumber
        };
        
        // Create instruction
        const data = await talimatOperations.createCari(instructionData);
        
        return {
            instruction: data,
            gondericiFirma,
            gondericiBanka,
            aliciFirma,
            aliciBanka
        };
    } catch (error) {
        console.error('Cari talimatı oluşturulurken hata:', error);
        throw error;
    }
};

/**
 * Create tax payment instruction
 * @param {Object} formData - Form data object
 * @returns {Promise<Object>} Created instruction object
 */
export const createVergiInstruction = async (formData) => {
    try {
        // Get company and bank data
        const gondericiFirma = findFirmaById(formData.gondericiFirma);
        const gondericiBanka = gondericiFirma?.bankalar.find(b => b.id == formData.gondericiBanka);
        
        if (!gondericiFirma || !gondericiBanka) {
            throw new Error('Gönderici firma veya hesap bilgileri eksik.');
        }
        
        // Validate form data
        // Check if this is an SGK instruction
        const currentInstructionType = getCurrentInstructionType();
        const instructionConfig = getInstructionTypeConfig(currentInstructionType);
        
        if (instructionConfig && instructionConfig.category === 'sgk') {
            // For SGK instructions, validate SGK specific fields
            if (!formData.tutar || !formData.talimatTarihi || !formData.tahakkukNo || !formData.sgkDonem) {
                throw new Error('Tüm alanlar doldurulmalıdır.');
            }
        } else if (instructionConfig && instructionConfig.category === 'gumruk') {
            // For Customs instructions, validate Customs specific fields
            // Different customs subtypes have different required fields
            if (!formData.tutar || !formData.talimatTarihi || !formData.gumrukBeyannameNo) {
                throw new Error('Tüm alanlar doldurulmalıdır.');
            }
        } else {
            // For other tax instructions, validate tax specific fields
            if (!formData.tutar || !formData.talimatTarihi || !formData.tahakkukNo || !formData.vergiDonem) {
                throw new Error('Tüm alanlar doldurulmalıdır.');
            }
        }
        
        // Check for duplicates
        const isDuplicate = await talimatOperations.checkDuplicateVergi(
            gondericiFirma.id,
            formData.tutar,
            formData.aciklama || '',
            getCurrentInstructionType(), // Use current instruction type instead of formData.vergiTuru
            gondericiFirma.vergi_dairesi || '',
            gondericiFirma.vkn_tc_no || ''
        );
        
        if (isDuplicate) {
            throw new Error('Bu vergi talimatı daha önce oluşturulmuş. Mükerrer kayıt yapılamaz.');
        }
        
        // Prepare instruction data
        const instructionData = {
            gonderici_firma_id: gondericiFirma.id,
            gonderici_banka_hesap_id: gondericiBanka.id,
            alici_firma_id: null,
            alici_banka_hesap_id: null,
            tutar: parseFloat(formData.tutar),
            para_birimi: gondericiBanka.para_birimi,
            aciklama: formData.aciklama || '',
            talimat_tarihi: formData.talimatTarihi,
            talimat_turu: 'Vergi Ödemesi',
            vergi_turu: getCurrentInstructionType(), // Use current instruction type
            vergi_dairesi: gondericiFirma.vergi_dairesi || '',
            vergi_kimlik_no: gondericiFirma.vkn_tc_no || '',
            tahakkuk_no: formData.tahakkukNo?.trim() || null,
            vergi_donem: (instructionConfig && instructionConfig.category === 'sgk') ? 
                         formData.sgkDonem?.trim() || null : 
                         (instructionConfig && instructionConfig.category === 'gumruk') ?
                         formData.gtipKodu || formData.otvOrani || formData.harcTuru || '' :
                         formData.vergiDonem?.trim() || null
        };
        
        // Create instruction
        const data = await talimatOperations.createVergi(instructionData);
        
        return {
            instruction: data,
            gondericiFirma,
            gondericiBanka
        };
    } catch (error) {
        console.error('Vergi talimatı oluşturulurken hata:', error);
        throw error;
    }
};

/**
 * Generate formatted instruction number for display
 * @param {number} instructionNumber - Raw instruction number
 * @returns {string} Formatted instruction number
 */
export const formatInstructionNumber = (instructionNumber) => {
    if (typeof instructionNumber === 'number') {
        const currentYear = new Date().getFullYear();
        return `${currentYear}-${instructionNumber.toString().padStart(4, '0')}`;
    }
    return instructionNumber.toString();
};

/**
 * Format currency amount for display
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted amount
 */
export const formatCurrency = (amount, currency = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', { 
        style: 'currency', 
        currency: currency, 
        minimumFractionDigits: 2 
    }).format(amount);
};

/**
 * Format date for display
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date in DD.MM.YYYY format
 */
export const formatDate = (dateString) => {
    if (!dateString) return '';
    
    const dateParts = dateString.split('-');
    if (dateParts.length !== 3) return dateString;
    
    return `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;
};

/**
 * Get instruction category info by category name
 * @param {string} category - Category name
 * @returns {Object} Category info object
 */
export const getCategoryInfo = (category) => {
    const categoryMap = {
        'havale': {
            name: 'Havale/EFT',
            icon: 'fas fa-university',
            color: 'primary'
        },
        'vergi': {
            name: 'Vergi Ödemeleri',
            icon: 'fas fa-receipt',
            color: 'success'
        },
        'sgk': {
            name: 'SGK Ödemeleri',
            icon: 'fas fa-user-shield',
            color: 'info'
        },
        'gumruk': {
            name: 'Gümrük Ödemeleri',
            icon: 'fas fa-truck',
            color: 'warning'
        },
        'cari': {
            name: 'Cari Hesap Ödemesi',
            icon: 'fas fa-exchange-alt',
            color: 'secondary'
        }
    };
    
    return categoryMap[category] || {
        name: 'Talimat',
        icon: 'fas fa-file-invoice',
        color: 'secondary'
    };
};

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} Today's date
 */
export const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

/**
 * Validate instruction type key
 * @param {string} typeKey - Instruction type key
 * @returns {boolean} True if valid, false otherwise
 */
export const isValidInstructionType = (typeKey) => {
    return typeKey && instructionTypes.hasOwnProperty(typeKey);
};

/**
 * Get instruction type configuration
 * @param {string} typeKey - Instruction type key
 * @returns {Object|null} Instruction type config or null if not found
 */
export const getInstructionTypeConfig = (typeKey) => {
    return instructionTypes[typeKey] || null;
};

/**
 * Get all instruction types by category
 * @param {string} category - Category name
 * @returns {Array} Array of instruction types in the category
 */
export const getInstructionTypesByCategory = (category) => {
    return Object.entries(instructionTypes)
        .filter(([key, config]) => config.category === category)
        .map(([key, config]) => ({ key, ...config }));
};

/**
 * Print instruction (utility function)
 * @param {string} content - HTML content to print
 * @param {string} title - Print window title
 */
export const printInstruction = (content, title = 'Talimat Yazdır') => {
    if (!content || content.trim() === "") {
        throw new Error("Yazdırmak için önce bir talimat oluşturmalısınız.");
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>${title}</title>
            <link rel="stylesheet" href="style.css" type="text/css" media="print">
            <style>
                @media print { 
                    body { 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact; 
                    } 
                    .talimat-table th { 
                        background-color: #f2f2f2 !important; 
                    } 
                }
            </style>
        </head>
        <body>
            ${content}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };
};