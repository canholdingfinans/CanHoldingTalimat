/**
 * Validation Module
 * Contains all form validation functions
 */

/**
 * IBAN Validation
 * @param {string} iban - IBAN number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const validateIBAN = (iban) => {
    if (!iban) return false;
    
    // Remove spaces and convert to uppercase
    const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
    
    // Check length (26 characters for Turkish IBAN)
    if (cleanIban.length !== 26) {
        return false;
    }
    
    // Check if starts with TR
    if (!cleanIban.startsWith('TR')) {
        return false;
    }
    
    // Basic format check (TR followed by 24 digits)
    const ibanPattern = /^TR\d{24}$/;
    return ibanPattern.test(cleanIban);
};

/**
 * Extended IBAN Validation (Supports TR and Foreign IBANs)
 * @param {string} iban - IBAN number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const validateIBANExtended = (iban) => {
    if (!iban) return false;
    const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
    if (cleanIban.startsWith('TR')) {
        return cleanIban.length === 26 && /^TR\d{24}$/.test(cleanIban);
    }
    // Yabancı IBAN: ISO 13616 aralığı — 2 harf ülke kodu + 2 rakam + 11-30 alfanümerik
    return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(cleanIban);
};

/**
 * Validate required form fields
 * @param {Object} fields - Object containing field names and values
 * @returns {Object} - {isValid: boolean, errors: string[]}
 */
export const validateRequiredFields = (fields) => {
    const errors = [];
    
    Object.entries(fields).forEach(([fieldName, value]) => {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
            errors.push(`${fieldName} alanı boş bırakılamaz.`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validate currency match between sender and receiver accounts
 * @param {Object} gondericiHesap - Sender account object
 * @param {Object} aliciHesap - Receiver account object
 * @returns {Object} - {isValid: boolean, message: string}
 */
export const validateCurrencyMatch = (gondericiHesap, aliciHesap) => {
    if (!gondericiHesap || !aliciHesap) {
        return {
            isValid: false,
            message: 'Gönderici ve alıcı hesap bilgileri eksik.'
        };
    }
    
    if (gondericiHesap.para_birimi !== aliciHesap.para_birimi) {
        return {
            isValid: false,
            message: `Para birimi uyuşmazlığı!\n\nGönderici Hesap: ${gondericiHesap.para_birimi}\nAlıcı Hesap: ${aliciHesap.para_birimi}\n\nLütfen aynı para birimine sahip hesaplar arasında işlem yapınız.`
        };
    }
    
    return {
        isValid: true,
        message: 'Para birimleri uyumlu.'
    };
};

/**
 * Validate amount input
 * @param {string|number} amount - Amount to validate
 * @returns {Object} - {isValid: boolean, message: string}
 */
export const validateAmount = (amount) => {
    if (!amount) {
        return {
            isValid: false,
            message: 'Tutar alanı boş bırakılamaz.'
        };
    }
    
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount)) {
        return {
            isValid: false,
            message: 'Geçersiz tutar formatı.'
        };
    }
    
    if (numAmount <= 0) {
        return {
            isValid: false,
            message: 'Tutar sıfırdan büyük olmalıdır.'
        };
    }
    
    if (numAmount > 999999999.99) {
        return {
            isValid: false,
            message: 'Tutar çok yüksek.'
        };
    }
    
    return {
        isValid: true,
        message: 'Tutar geçerli.'
    };
};

/**
 * Validate date input
 * @param {string} dateString - Date string to validate (YYYY-MM-DD format)
 * @returns {Object} - {isValid: boolean, message: string}
 */
export const validateDate = (dateString) => {
    if (!dateString) {
        return {
            isValid: false,
            message: 'Tarih alanı boş bırakılamaz.'
        };
    }
    
    const date = new Date(dateString);
    const today = new Date();
    
    if (isNaN(date.getTime())) {
        return {
            isValid: false,
            message: 'Geçersiz tarih formatı.'
        };
    }
    
    // Check if date is not too far in the past (more than 1 year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    
    if (date < oneYearAgo) {
        return {
            isValid: false,
            message: 'Tarih çok eski olamaz (1 yıldan fazla geçmiş).'
        };
    }
    
    // Check if date is not too far in the future (more than 1 year)
    const oneYearLater = new Date();
    oneYearLater.setFullYear(today.getFullYear() + 1);
    
    if (date > oneYearLater) {
        return {
            isValid: false,
            message: 'Tarih çok gelecekte olamaz (1 yıldan fazla ileri).'
        };
    }
    
    return {
        isValid: true,
        message: 'Tarih geçerli.'
    };
};

/**
 * Validate firm name
 * @param {string} name - Firm name to validate
 * @returns {Object} - {isValid: boolean, message: string}
 */
export const validateFirmName = (name) => {
    if (!name || name.trim() === '') {
        return {
            isValid: false,
            message: 'Firma adı boş bırakılamaz.'
        };
    }
    
    if (name.length < 2) {
        return {
            isValid: false,
            message: 'Firma adı en az 2 karakter olmalıdır.'
        };
    }
    
    if (name.length > 100) {
        return {
            isValid: false,
            message: 'Firma adı en fazla 100 karakter olmalıdır.'
        };
    }
    
    // Check for invalid characters (basic validation)
    const invalidChars = /[<>]/;
    if (invalidChars.test(name)) {
        return {
            isValid: false,
            message: 'Firma adı geçersiz karakterler içeriyor.'
        };
    }
    
    return {
        isValid: true,
        message: 'Firma adı geçerli.'
    };
};

/**
 * Validate bank name
 * @param {string} bankName - Bank name to validate
 * @returns {Object} - {isValid: boolean, message: string}
 */
export const validateBankName = (bankName) => {
    if (!bankName || bankName.trim() === '') {
        return {
            isValid: false,
            message: 'Banka adı boş bırakılamaz.'
        };
    }
    
    if (bankName.length < 2) {
        return {
            isValid: false,
            message: 'Banka adı en az 2 karakter olmalıdır.'
        };
    }
    
    return {
        isValid: true,
        message: 'Banka adı geçerli.'
    };
};

/**
 * Validate tax identification number
 * @param {string} vergiKimlikNo - Tax ID to validate
 * @returns {Object} - {isValid: boolean, message: string}
 */
export const validateTaxId = (vergiKimlikNo) => {
    if (!vergiKimlikNo || vergiKimlikNo.trim() === '') {
        return {
            isValid: false,
            message: 'Vergi kimlik numarası boş bırakılamaz.'
        };
    }
    
    // Remove spaces and non-digit characters
    const cleanTaxId = vergiKimlikNo.replace(/\D/g, '');
    
    // Check length (10 or 11 digits for Turkish tax IDs)
    if (cleanTaxId.length !== 10 && cleanTaxId.length !== 11) {
        return {
            isValid: false,
            message: 'Vergi kimlik numarası 10 veya 11 haneli olmalıdır.'
        };
    }
    
    return {
        isValid: true,
        message: 'Vergi kimlik numarası geçerli.'
    };
};

/**
 * Comprehensive form validation for Havale/EFT
 * @param {Object} formData - Form data object
 * @returns {Object} - {isValid: boolean, errors: string[]}
 */
export const validateHavaleEFTForm = (formData) => {
    const errors = [];
    
    // Required fields validation
    const requiredValidation = validateRequiredFields({
        'Gönderici Firma': formData.gondericiFirma,
        'Gönderici Hesap': formData.gondericiBanka,
        'Alıcı Firma': formData.aliciFirma,
        'Alıcı Hesap': formData.aliciBanka,
        'Tutar': formData.tutar,
        'Talimat Tarihi': formData.talimatTarihi
    });
    
    if (!requiredValidation.isValid) {
        errors.push(...requiredValidation.errors);
    }
    
    // Amount validation
    if (formData.tutar) {
        const amountValidation = validateAmount(formData.tutar);
        if (!amountValidation.isValid) {
            errors.push(amountValidation.message);
        }
    }
    
    // Date validation
    if (formData.talimatTarihi) {
        const dateValidation = validateDate(formData.talimatTarihi);
        if (!dateValidation.isValid) {
            errors.push(dateValidation.message);
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Comprehensive form validation for Vergi payments
 * @param {Object} formData - Form data object
 * @returns {Object} - {isValid: boolean, errors: string[]}
 */
export const validateVergiForm = (formData) => {
    const errors = [];
    
    // Required fields validation
    const requiredValidation = validateRequiredFields({
        'Gönderici Firma': formData.gondericiFirma,
        'Gönderici Hesap': formData.gondericiBanka,
        'Vergi Türü': formData.vergiTuru,
        'Vergi Dairesi': formData.vergiDairesi,
        'Vergi Kimlik No': formData.vergiKimlikNo,
        'Tutar': formData.tutar,
        'Talimat Tarihi': formData.talimatTarihi
    });
    
    if (!requiredValidation.isValid) {
        errors.push(...requiredValidation.errors);
    }
    
    // Amount validation
    if (formData.tutar) {
        const amountValidation = validateAmount(formData.tutar);
        if (!amountValidation.isValid) {
            errors.push(amountValidation.message);
        }
    }
    
    // Date validation
    if (formData.talimatTarihi) {
        const dateValidation = validateDate(formData.talimatTarihi);
        if (!dateValidation.isValid) {
            errors.push(dateValidation.message);
        }
    }
    
    // Tax ID validation
    if (formData.vergiKimlikNo) {
        const taxIdValidation = validateTaxId(formData.vergiKimlikNo);
        if (!taxIdValidation.isValid) {
            errors.push(taxIdValidation.message);
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validate SWIFT code format
 * @param {string} swiftCode - SWIFT/BIC code to validate
 * @returns {Object} - {isValid: boolean, message: string}
 */
export const validateSWIFTCode = (swiftCode) => {
    // SWIFT code is optional, so empty values are valid
    if (!swiftCode || swiftCode.trim() === '') {
        return {
            isValid: true,
            message: 'SWIFT kodu opsiyoneldir.'
        };
    }
    
    // Remove spaces and convert to uppercase
    const cleanSwift = swiftCode.replace(/\s+/g, '').toUpperCase();
    
    // SWIFT codes can ONLY be exactly 8 or 11 characters
    if (cleanSwift.length !== 8 && cleanSwift.length !== 11) {
        return {
            isValid: false,
            message: 'SWIFT kodu sadece 8 veya 11 haneli olabilir.'
        };
    }
    
    // Check format: only alphanumeric characters allowed
    const swiftPattern = /^[A-Z0-9]+$/;
    if (!swiftPattern.test(cleanSwift)) {
        return {
            isValid: false,
            message: 'SWIFT kodu sadece büyük harf ve rakam içerebilir.'
        };
    }
    
    return {
        isValid: true,
        message: 'SWIFT kodu geçerli.'
    };
};

/**
 * Validate company type requirements for instruction types
 * @param {Object} gondericiFirma - Sender company object
 * @param {Object} aliciFirma - Receiver company object (optional for some types)
 * @param {string} instructionType - Type of instruction ('İç Transfer', 'Dış Transfer', etc.)
 * @returns {Object} - {isValid: boolean, message: string}
 */
export const validateCompanyTypeRequirements = (gondericiFirma, aliciFirma, instructionType) => {
    // For all transfer types, sender must be a 'grup' type company
    if (!gondericiFirma || gondericiFirma.turu !== 'grup') {
        return {
            isValid: false,
            message: 'Gönderici firma "Grup" türünde olmalıdır.'
        };
    }
    
    // For internal transfers, receiver must also be a 'grup' type company
    if (instructionType === 'İç Transfer') {
        if (!aliciFirma || aliciFirma.turu !== 'grup') {
            return {
                isValid: false,
                message: 'İç transferde alıcı firma da "Grup" türünde olmalıdır.'
            };
        }
    }
    
    // For external transfers, receiver can be any type
    // No additional validation needed
    
    return {
        isValid: true,
        message: 'Firma türleri uygun.'
    };
};