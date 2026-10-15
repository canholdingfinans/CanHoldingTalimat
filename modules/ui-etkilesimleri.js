/**
 * UI Etkileşimleri (UI Interactions) Module
 * Handles all DOM manipulation and user interface interactions
 */
import { getFirmalar, findFirmaById, deleteFirmalarBulk } from './firmalar.js';
import { getBanksForFirma, getBankDisplayName, formatIBAN, checkCurrencyCompatibility } from './bankalar.js';
import { instructionTypes, getCategoryInfo, getTodayString } from './talimatlar.js';
import { validateSWIFTCode } from './validasyon.js';
import { BANKA_LISTESI, KATEGORI_SIRASI, getCanonicalBankaAdi } from './banka-listesi.js';

// Global variables for modals and UI elements
let firmaModal, bankaModal;
let currentInstructionType = 'havale-ic'; // Default to internal transfer
let isBulkModeActive = false; // Admin bulk actions mode

// Choices.js instances for dropdowns
let choicesInstances = {};
const destroyChoices = () => {
    Object.values(choicesInstances).forEach(instance => {
        if (instance && typeof instance.destroy === 'function') {
            instance.destroy();
        }
    });
    choicesInstances = {};
};

/**
 * Initialize UI interactions
 */
export const initializeUI = () => {
    // Initialize modals
    firmaModal = new bootstrap.Modal(document.getElementById('firmaModal'));
    bankaModal = new bootstrap.Modal(document.getElementById('bankaModal'));
    
    // Set today's date for date inputs
    setTodayDates();
    
    // Initialize instruction type selection
    selectInstructionType(currentInstructionType);
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup dropdown submenu functionality
    setupDropdownSubmenus();
    
    console.log('UI interactions initialized');
};

/**
 * Choices.js veya Native Select için güvenli firma seçimi yapar ve 'change' event'i tetikler.
 * @param {string} selectId - Element ID
 * @param {string|number} firmaId - Seçilecek firma ID'si
 */
export const setFirmaChoice = (selectId, firmaId) => {
    if (!firmaId) return;
    const select = document.getElementById(selectId);
    if (!select) return;

    const valStr = String(firmaId);

    // 1. Choices.js instance üzerinden seçim
    if (choicesInstances[selectId] && typeof choicesInstances[selectId].setChoiceByValue === 'function') {
        try {
            choicesInstances[selectId].setChoiceByValue(valStr);
        } catch (err) {
            console.warn(`[Revizyon] Choices setChoiceByValue(${valStr}) uyarısı:`, err);
        }
    }

    // 2. Native select değerini de doğrudan güvenceye al
    select.value = valStr;

    // 3. Banka doldurma mantığını tetiklemek için native change event'ini fırlat
    select.dispatchEvent(new Event('change', { bubbles: true }));
};

/**
 * Banka dropdown'ında seçeneğin varlığını denetler, değeri atar ve 'change' event'i tetikler.
 * @param {string} selectId - Element ID
 * @param {string|number} bankaId - Seçilecek banka hesap ID'si
 */
export const setBankaChoice = (selectId, bankaId) => {
    if (!bankaId) return;
    const select = document.getElementById(selectId);
    if (!select) return;

    const valStr = String(bankaId);

    const tryApply = () => {
        const optionExists = Array.from(select.options).some(opt => opt.value === valStr);
        if (optionExists) {
            select.value = valStr;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
        return false;
    };

    // İlk deneme senkron olarak çalışır
    if (!tryApply()) {
        // Çok nadir DOM microtask veya rendering gecikmeleri için kısa poll (max 300ms)
        let attempts = 0;
        const poller = setInterval(() => {
            attempts++;
            if (tryApply() || attempts > 6) {
                clearInterval(poller);
            }
        }, 50);
    }
};

/**
 * sessionStorage'dan revizyon verisini okur, formu ön-doldurur.
 * URL'de ?mode=revision parametresi olduğunda çalışır.
 * loadInitialData() ve loadUserDepartments() tamamlandıktan sonra çağrılmalıdır.
 */
export const checkRevisionMode = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') !== 'revision') return;

    const revisionDataRaw = sessionStorage.getItem('revisionData');
    if (!revisionDataRaw) {
        console.warn('[Revizyon] mode=revision ama sessionStorage boş.');
        return;
    }

    let revisionSource;
    try {
        revisionSource = JSON.parse(revisionDataRaw);
    } catch (e) {
        console.error('[Revizyon] Parse hatası:', e);
        sessionStorage.removeItem('revisionData');
        return;
    }

    // 1. Banner göster
    const banner = document.getElementById('revisionBanner');
    const sourceNoEl = document.getElementById('revisionSourceNo');
    if (banner && sourceNoEl) {
        sourceNoEl.textContent = revisionSource.instruction_number || '?';
        banner.classList.remove('d-none');
    }

    // 2. Departman seçimi (Cross-Department / Çapraz Departman Desteği)
    if (revisionSource.department_prefix) {
        const depRadio = document.querySelector(`input[name="department_prefix"][value="${revisionSource.department_prefix}"]`);
        if (depRadio) {
            depRadio.checked = true;
            depRadio.dispatchEvent(new Event('change'));
        }
    }

    // 3. talimat_turu → typeKey dönüşümü ve formun oluşturulması
    const typeKeyMap = {
        'Havale/EFT':         'havale-ic',
        'Vergi Ödemesi':      'vergi-kdv',
        'SGK Ödemesi':        'sgk-prim',
        'Gümrük Ödemesi':     'gumruk-vergi',
        'Döviz Alım/Satım':   'doviz-alim',
        'Cari Hesap Ödemesi': 'cari-satici',
    };
    let typeKey = typeKeyMap[revisionSource.talimat_turu] || 'havale-ic';
    if (revisionSource.talimat_turu === 'Döviz Alım/Satım') {
        typeKey = (revisionSource.doviz_islemi_turu === 'satım') ? 'doviz-satim' : 'doviz-alim';
    }
    if (revisionSource.vergi_turu && instructionTypes[revisionSource.vergi_turu]) {
        typeKey = revisionSource.vergi_turu;
    }

    selectInstructionType(typeKey);

    // 4. Deterministik pre-fill (Veriler ve form hazır olduğundan gecikmesiz çalışır)
    prefillFormFromRevision(revisionSource);

    // 5. İptal butonu
    const cancelBtn = document.getElementById('cancelRevisionBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            sessionStorage.removeItem('revisionData');
            banner?.classList.add('d-none');
            window.history.replaceState({}, '', 'index.html');
            showNotification('Revizyon modu iptal edildi.', 'info');
        });
    }
};

/**
 * Kaynak talimat verisini form alanlarına doldurur.
 * @param {Object} src - payment_instructions kaydı
 */
export const prefillFormFromRevision = (src) => {
    if (!src) return;

    // 1. Gönderici Firmalar (Tüm Form Tipleri)
    if (src.gonderici_firma_id) {
        setFirmaChoice('gondericiFirma', src.gonderici_firma_id);
        setFirmaChoice('vergiGondericiFirma', src.gonderici_firma_id);
        setFirmaChoice('sgkGondericiFirma', src.gonderici_firma_id);
        setFirmaChoice('gumrukGondericiFirma', src.gonderici_firma_id);
    }

    // 2. Alıcı Firma (Havale / Cari / Döviz)
    if (src.alici_firma_id) {
        setFirmaChoice('aliciFirma', src.alici_firma_id);
    }

    // 3. Gönderici Banka Hesapları (Firma change event'i ile banka listesi dolduktan sonra seçilir)
    if (src.gonderici_banka_hesap_id) {
        setBankaChoice('gondericiBanka', src.gonderici_banka_hesap_id);
        setBankaChoice('vergiGondericiBanka', src.gonderici_banka_hesap_id);
        setBankaChoice('sgkGondericiBanka', src.gonderici_banka_hesap_id);
        setBankaChoice('gumrukGondericiBanka', src.gonderici_banka_hesap_id);
    }

    // 4. Alıcı Banka Hesabı
    if (src.alici_banka_hesap_id) {
        setBankaChoice('aliciBanka', src.alici_banka_hesap_id);
    }

    // 5. Tutar ve Açıklama (Tüm form varyantları)
    const tutarInput = document.getElementById('tutar') 
        || document.getElementById('vergiTutar') 
        || document.getElementById('sgkTutar') 
        || document.getElementById('gumrukTutar');
    if (tutarInput && src.tutar) {
        tutarInput.value = src.tutar;
        tutarInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const aciklamaInput = document.getElementById('aciklama')
        || document.getElementById('vergiAciklama')
        || document.getElementById('sgkAciklama')
        || document.getElementById('gumrukAciklama');
    if (aciklamaInput && src.aciklama) {
        aciklamaInput.value = src.aciklama;
        aciklamaInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // 6. Vergi / SGK / Gümrük alanları
    const tahakkukEl = document.getElementById('tahakkukNo') || document.getElementById('sgkTahakkukNo');
    if (tahakkukEl && src.tahakkuk_no) tahakkukEl.value = src.tahakkuk_no;

    const sgkSicilEl = document.getElementById('sgkSicilNo');
    if (sgkSicilEl && src.sgk_sicil_no) sgkSicilEl.value = src.sgk_sicil_no;

    const vergiDairesiEl = document.getElementById('vergiDairesi');
    if (vergiDairesiEl && src.vergi_dairesi) vergiDairesiEl.value = src.vergi_dairesi;

    const vergiKimlikNoEl = document.getElementById('vergiKimlikNo');
    if (vergiKimlikNoEl && src.vergi_kimlik_no) vergiKimlikNoEl.value = src.vergi_kimlik_no;

    const vergiDonemEl = document.getElementById('vergiDonem') || document.getElementById('sgkDonem');
    if (vergiDonemEl && src.vergi_donem) vergiDonemEl.value = src.vergi_donem;

    const gumrukBeyannameNoEl = document.getElementById('gumrukBeyannameNo');
    if (gumrukBeyannameNoEl && src.gumruk_beyanname_no) gumrukBeyannameNoEl.value = src.gumruk_beyanname_no;

    // 7. Döviz-spesifik alanlar
    if (src.talimat_turu === 'Döviz Alım/Satım') {
        const dovizMiktariEl = document.getElementById('dovizMiktari');
        const kurEl = document.getElementById('kur');
        const dovizCinsiEl = document.getElementById('dovizCinsi');
        if (dovizMiktariEl && src.doviz_miktari) dovizMiktariEl.value = src.doviz_miktari;
        if (kurEl && src.kur) kurEl.value = src.kur;
        if (dovizCinsiEl && src.doviz_cinsi) dovizCinsiEl.value = src.doviz_cinsi;
    }

    console.log('[Revizyon] Form ön-doldurma başarıyla tamamlandı:', src.instruction_number);
};

/**
 * Set today's date for date inputs
 */
const setTodayDates = () => {
    const today = getTodayString();
    const dateInputs = ['talimatTarihi', 'vergiTalimatTarihi', 'sgkTalimatTarihi', 'gumrukTalimatTarihi'];
    
    dateInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) input.value = today;
    });
};

/**
 * Setup dropdown submenu functionality
 */
const setupDropdownSubmenus = () => {
    // Handle dropdown submenu hover events
    const dropdownSubmenus = document.querySelectorAll('.dropdown-submenu');
    
    dropdownSubmenus.forEach(submenu => {
        const toggle = submenu.querySelector('.dropdown-toggle');
        const submenuElement = submenu.querySelector('.dropdown-menu');
        
        if (toggle && submenuElement) {
            // Show submenu on hover
            submenu.addEventListener('mouseenter', () => {
                // Close other open submenus
                document.querySelectorAll('.dropdown-submenu .dropdown-menu.show').forEach(menu => {
                    if (menu !== submenuElement) {
                        menu.classList.remove('show');
                    }
                });
                
                // Show current submenu
                submenuElement.classList.add('show');
            });
            
            // Hide submenu when mouse leaves
            submenu.addEventListener('mouseleave', () => {
                submenuElement.classList.remove('show');
            });
        }
    });
    
    // Handle click events for mobile/touch devices
    document.addEventListener('click', (e) => {
        const submenuToggle = e.target.closest('.dropdown-submenu > .dropdown-toggle');
        if (submenuToggle) {
            e.preventDefault();
            e.stopPropagation();
            
            const submenu = submenuToggle.parentElement;
            const submenuElement = submenu.querySelector('.dropdown-menu');
            
            if (submenuElement) {
                // Close other open submenus
                document.querySelectorAll('.dropdown-submenu .dropdown-menu.show').forEach(menu => {
                    if (menu !== submenuElement) {
                        menu.classList.remove('show');
                    }
                });
                
                // Toggle current submenu
                submenuElement.classList.toggle('show');
            }
        }
        
        // Close submenus when clicking outside
        if (!e.target.closest('.dropdown-submenu')) {
            document.querySelectorAll('.dropdown-submenu .dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    });
};

/**
 * Setup all event listeners
 */
const setupEventListeners = () => {
    // Navigation menu events with proper focus management
    document.addEventListener('click', (e) => {
        if (e.target.hasAttribute('data-talimat-type')) {
            e.preventDefault();
            e.stopPropagation();
            
            const selectedType = e.target.getAttribute('data-talimat-type');
            const dropdown = document.querySelector('.talimat-dropdown');
            const dropdownButton = document.getElementById('talimatMenuDropdown');
            
            // Close the dropdown first
            if (dropdown && dropdown.classList.contains('show')) {
                dropdown.classList.remove('show');
            }
            if (dropdownButton) {
                dropdownButton.setAttribute('aria-expanded', 'false');
                dropdownButton.classList.remove('show');
                // Remove focus lock by blurring the button
                dropdownButton.blur();
            }
            
            // Remove Bootstrap's backdrop if it exists
            const backdrop = document.querySelector('.dropdown-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            
            // Close all submenus
            document.querySelectorAll('.dropdown-submenu .dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
            
            // Select the instruction type
            selectInstructionType(selectedType, e.target);
            
            // Return focus to main content area to prevent lock
            setTimeout(() => {
                const mainContent = document.getElementById('dynamicFormFields');
                if (mainContent) {
                    mainContent.focus();
                }
            }, 100);
        }
    });
    
    // Department changed event
    window.addEventListener('departmentChanged', populateFormDropdowns);

    // Form events
    const firmaForm = document.getElementById('firmaForm');
    if (firmaForm) {
        firmaForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            console.log('Form submission - firmaAdi:', formData.get('firmaAdi'));
            console.log('Form submission - firmaTuru:', formData.get('firmaTuru'));
            console.log('Form submission - firmaVknTc:', formData.get('firmaVknTc'));
            console.log('Form submission - firmaVergiDairesi:', formData.get('firmaVergiDairesi'));
            console.log('Form submission - all entries:', Array.from(formData.entries()));
            window.dispatchEvent(new CustomEvent('firmaFormSubmit', { detail: formData }));
        });
    }
    
    const bankaForm = document.getElementById('bankaForm');
    if (bankaForm) {
        bankaForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            if (!bankaForm.checkValidity()) {
                e.stopPropagation();
                bankaForm.classList.add('was-validated');
                return;
            }
            
            bankaForm.classList.remove('was-validated');
            
            const formData = new FormData(e.target);
            const bankaAdiVal = formData.get('bankaAdi');
            if (!bankaAdiVal || bankaAdiVal.trim() === '') {
                alert('Lütfen bir Banka Adı seçiniz.');
                return;
            }
            window.dispatchEvent(new CustomEvent('bankaFormSubmit', { detail: formData }));
        });
    }
    
    // Accordion events
    const firmaAccordion = document.getElementById('firmaAccordion');
    if (firmaAccordion) {
        firmaAccordion.addEventListener('click', (e) => {
            window.dispatchEvent(new CustomEvent('accordionClick', { detail: { target: e.target } }));
        });
    }
    
    // Add firma button
    const addFirmaBtn = document.getElementById('addFirmaBtn');
    if (addFirmaBtn) {
        addFirmaBtn.addEventListener('click', () => showFirmaModal());
    }
    
    // Dynamic form events
    document.addEventListener('change', handleDynamicFormChange);
    
    // SWIFT code validation
    document.addEventListener('input', handleSWIFTValidation);
    
    // Tax number validation
    document.addEventListener('input', handleTaxNumberValidation);
    
    // Setup additional components
    setupInstructionButtons();
    setupSearchAndFilter();
    setupBulkActions();
};

/**
 * Handle tax number validation on input
 */
const handleTaxNumberValidation = (e) => {
    if (e.target.id === 'firmaVknTc') {
        const input = e.target;
        const value = input.value.trim();
        
        // Remove existing validation classes
        input.classList.remove('is-valid', 'is-invalid');
        
        // Clear existing feedback
        let feedback = input.parentElement.querySelector('.invalid-feedback, .valid-feedback');
        if (feedback) feedback.remove();
        
        // Only validate if there's input
        if (value) {
            // Check if it's 10 or 11 digits only
            const isValid = /^[0-9]{10,11}$/.test(value);
            
            // Create feedback element
            feedback = document.createElement('div');
            if (isValid) {
                input.classList.add('is-valid');
                feedback.className = 'valid-feedback';
                feedback.textContent = 'Geçerli vergi numarası';
            } else {
                input.classList.add('is-invalid');
                feedback.className = 'invalid-feedback';
                feedback.textContent = 'Vergi numarası 10 veya 11 haneli olmalı ve sadece rakam içermelidir';
            }
            
            input.parentElement.appendChild(feedback);
        }
    }
};

/**
 * Handle dynamic form field changes
 */
const handleDynamicFormChange = (e) => {
    const { id, value } = e.target;
    
    switch(id) {
        case 'gondericiFirma':
            const gondericiBankaSelect = document.getElementById('gondericiBanka');
            if (gondericiBankaSelect) {
                let currencyFilter = null;
                const isDoviz = document.getElementById('dovizIslemiTuru');
                if (isDoviz) {
                    currencyFilter = (isDoviz.value === 'alım') ? 'TRY' : '!TRY';
                }
                populateBankaSelect(value, gondericiBankaSelect, currencyFilter);
                updateParaBirimiKontrol();
            }
            break;
            
        case 'aliciFirma':
            const aliciBankaSelect = document.getElementById('aliciBanka');
            if (aliciBankaSelect) {
                let currencyFilter = null;
                const isDoviz = document.getElementById('dovizIslemiTuru');
                if (isDoviz) {
                    currencyFilter = (isDoviz.value === 'alım') ? '!TRY' : 'TRY';
                }
                populateBankaSelect(value, aliciBankaSelect, currencyFilter);
                updateParaBirimiKontrol();
            }
            break;
            
        case 'gondericiBanka':
            const gondericiBankaDetay = document.getElementById('gondericiBankaDetay');
            if (gondericiBankaDetay) {
                const gondericiFirmaSelect = document.getElementById('gondericiFirma');
                showBankaDetay(gondericiFirmaSelect?.value, value, gondericiBankaDetay);
                updateParaBirimiKontrol();
                
                // Satım işleminde Gönderici banka döviz hesabıdır, Doviz Cinsi buranın para birimidir
                const isDoviz = document.getElementById('dovizIslemiTuru');
                if (isDoviz && isDoviz.value === 'satım') {
                    const dovizCinsiInput = document.getElementById('dovizCinsi');
                    if (dovizCinsiInput) {
                        const banks = getBanksForFirma(gondericiFirmaSelect?.value);
                        const banka = banks.find(b => b.id == value);
                        dovizCinsiInput.value = banka ? banka.para_birimi : '';
                    }
                }
            }
            break;
            
        case 'aliciBanka':
            const aliciBankaDetay = document.getElementById('aliciBankaDetay');
            if (aliciBankaDetay) {
                const aliciFirmaSelect = document.getElementById('aliciFirma');
                showBankaDetay(aliciFirmaSelect?.value, value, aliciBankaDetay);
                updateParaBirimiKontrol();
                
                // Alım işleminde Alıcı banka döviz hesabıdır, Doviz Cinsi buranın para birimidir
                const isDoviz = document.getElementById('dovizIslemiTuru');
                if (isDoviz && isDoviz.value === 'alım') {
                    const dovizCinsiInput = document.getElementById('dovizCinsi');
                    if (dovizCinsiInput) {
                        const banks = getBanksForFirma(aliciFirmaSelect?.value);
                        const banka = banks.find(b => b.id == value);
                        dovizCinsiInput.value = banka ? banka.para_birimi : '';
                    }
                }
            }
            break;
            
        // SGK specific cases
        case 'sgkGondericiFirma':
            const sgkGondericiBankaSelect = document.getElementById('sgkGondericiBanka');
            if (sgkGondericiBankaSelect) {
                populateBankaSelect(value, sgkGondericiBankaSelect);
            }
            break;
            
        case 'sgkGondericiBanka':
            const sgkGondericiBankaDetay = document.getElementById('sgkGondericiBankaDetay');
            if (sgkGondericiBankaDetay) {
                const sgkGondericiFirmaSelect = document.getElementById('sgkGondericiFirma');
                showBankaDetay(sgkGondericiFirmaSelect?.value, value, sgkGondericiBankaDetay);
            }
            break;
            
        // Vergi specific cases (these were missing)
        case 'vergiGondericiFirma':
            const vergiGondericiBankaSelect = document.getElementById('vergiGondericiBanka');
            if (vergiGondericiBankaSelect) {
                populateBankaSelect(value, vergiGondericiBankaSelect);
            }
            break;
            
        case 'vergiGondericiBanka':
            const vergiGondericiBankaDetay = document.getElementById('vergiGondericiBankaDetay');
            if (vergiGondericiBankaDetay) {
                const vergiGondericiFirmaSelect = document.getElementById('vergiGondericiFirma');
                showBankaDetay(vergiGondericiFirmaSelect?.value, value, vergiGondericiBankaDetay);
            }
            break;
            
        // Gümrük specific cases
        case 'gumrukGondericiFirma':
            const gumrukGondericiBankaSelect = document.getElementById('gumrukGondericiBanka');
            if (gumrukGondericiBankaSelect) {
                populateBankaSelect(value, gumrukGondericiBankaSelect);
            }
            break;
            
        case 'gumrukGondericiBanka':
            const gumrukGondericiBankaDetay = document.getElementById('gumrukGondericiBankaDetay');
            if (gumrukGondericiBankaDetay) {
                const gumrukGondericiFirmaSelect = document.getElementById('gumrukGondericiFirma');
                showBankaDetay(gumrukGondericiFirmaSelect?.value, value, gumrukGondericiBankaDetay);
            }
            break;
            
        // Cari payment dynamic field cases
        default:
            // Handle dynamic payment fields
            if (id.startsWith('aliciFirma_')) {
                const paymentId = id.split('_')[1];
                const aliciBankaSelect = document.getElementById(`aliciBanka_${paymentId}`);
                if (aliciBankaSelect) {
                    populateBankaSelect(value, aliciBankaSelect);
                    updateParaBirimiKontrolDynamic(paymentId);
                }
            } else if (id.startsWith('aliciBanka_')) {
                const paymentId = id.split('_')[1];
                const aliciBankaDetay = document.getElementById(`aliciBankaDetay_${paymentId}`);
                if (aliciBankaDetay) {
                    const aliciFirmaSelect = document.getElementById(`aliciFirma_${paymentId}`);
                    showBankaDetay(aliciFirmaSelect?.value, value, aliciBankaDetay);
                    updateParaBirimiKontrolDynamic(paymentId);
                }
            } else if (id.startsWith('tutar_')) {
                const paymentId = id.split('_')[1];
                updateParaBirimiKontrolDynamic(paymentId);
            }
    }
};

/**
 * Setup instruction form buttons
 */
const setupInstructionButtons = () => {
    // Use event delegation for dynamically created buttons
    document.addEventListener('click', (e) => {
        console.log('Click event triggered, target:', e.target);
        console.log('Click event target classList:', e.target.classList);
        console.log('Click event target id:', e.target.id);
        console.log('Click event target nodeName:', e.target.nodeName);
        console.log('Click event target parentElement:', e.target.parentElement);
        
        // Handle "Talimat Oluştur" button
        if (e.target.id === 'talimatOlusturBtn' || e.target.closest('#talimatOlusturBtn')) {
            e.preventDefault();
            console.log('Talimat Olustur button clicked');
            window.dispatchEvent(new CustomEvent('talimatOlustur', { detail: { type: currentInstructionType } }));
            return;
        }
        
        // Handle "Yazdır" button
        if (e.target.id === 'talimatYazdirBtn' || e.target.closest('#talimatYazdirBtn')) {
            e.preventDefault();
            console.log('Talimat Yazdir button clicked');
            window.dispatchEvent(new CustomEvent('talimatYazdir'));
            return;
        }
        
        // Handle "Yeni Ödeme Ekle" button for cari payments (original button)
        if (e.target.id === 'yeniOdemeEkleBtn' || e.target.closest('#yeniOdemeEkleBtn')) {
            e.preventDefault();
            console.log('Original "Yeni Ödeme Ekle" button clicked');
            addNewPaymentField();
            return;
        }
        
        // Handle dynamically added "Yeni Ödeme Ekle" buttons for cari payments
        // More robust check for dynamic buttons
        console.log('=== Dynamic button check ===');
        console.log('Event target:', e.target);
        console.log('Event target type:', e.target.nodeType);
        console.log('Event target node name:', e.target.nodeName);
        
        // Check if target has classList property
        if (e.target.classList) {
            console.log('Target has classList:', true);
            console.log('Target classList value:', e.target.classList.value);
            console.log('Target classList contains yeniOdemeEkleBtnDynamic:', e.target.classList.contains('yeniOdemeEkleBtnDynamic'));
        } else {
            console.log('Target has classList:', false);
        }
        
        // Improved check for dynamic buttons - check both the target and its ancestors
        let isDynamicButton = false;
        let dynamicButtonElement = null;
        
        // Check if the target itself has the class
        if (e.target.classList && typeof e.target.classList.contains === 'function' && e.target.classList.contains('yeniOdemeEkleBtnDynamic')) {
            isDynamicButton = true;
            dynamicButtonElement = e.target;
        } 
        // Check if the target is inside an element with the class
        else if (typeof e.target.closest === 'function') {
            const closestButton = e.target.closest('.yeniOdemeEkleBtnDynamic');
            if (closestButton) {
                isDynamicButton = true;
                dynamicButtonElement = closestButton;
            }
        }
        
        // Additional check for dynamic buttons that might be missed
        // Check parent elements up to 5 levels
        if (!isDynamicButton) {
            let parent = e.target.parentElement;
            let level = 0;
            while (parent && level < 5) {
                if (parent.classList && typeof parent.classList.contains === 'function' && parent.classList.contains('yeniOdemeEkleBtnDynamic')) {
                    isDynamicButton = true;
                    dynamicButtonElement = parent;
                    break;
                }
                parent = parent.parentElement;
                level++;
            }
        }
        
        // Final fallback check using querySelector
        if (!isDynamicButton) {
            // Try to find any button with the class in the target's parent chain
            let currentElement = e.target;
            while (currentElement && currentElement !== document.body) {
                if (currentElement.tagName === 'BUTTON' && 
                    currentElement.classList && 
                    currentElement.classList.contains('yeniOdemeEkleBtnDynamic')) {
                    isDynamicButton = true;
                    dynamicButtonElement = currentElement;
                    break;
                }
                currentElement = currentElement.parentElement;
            }
        }
        
        console.log('Checking dynamic button - isDynamicButton:', isDynamicButton);
        console.log('Dynamic button element:', dynamicButtonElement);
        
        if (isDynamicButton) {
            e.preventDefault();
            e.stopPropagation(); // Prevent event from bubbling up
            console.log('Dynamic "Yeni Ödeme Ekle" button clicked');
            console.log('Target element:', e.target);
            console.log('Dynamic button element:', dynamicButtonElement);
            if (dynamicButtonElement && dynamicButtonElement.classList) {
                console.log('Dynamic button class list:', dynamicButtonElement.classList);
            }
            addNewPaymentField();
            return; // Exit early to prevent other handlers from processing this event
        }
        
        // Special check for dynamic buttons that might be missed
        // Check if any parent element has the class
        const parentWithClass = e.target.parentElement?.parentElement?.parentElement;
        if (parentWithClass && parentWithClass.classList && typeof parentWithClass.classList.contains === 'function') {
            console.log('Checking parent element for class:', parentWithClass);
            console.log('Parent element class list:', parentWithClass.classList);
            console.log('Parent element has yeniOdemeEkleBtnDynamic:', parentWithClass.classList.contains('yeniOdemeEkleBtnDynamic'));
            
            if (parentWithClass.classList.contains('yeniOdemeEkleBtnDynamic')) {
                e.preventDefault();
                e.stopPropagation(); // Prevent event from bubbling up
                console.log('Dynamic "Yeni Ödeme Ekle" button clicked (parent check)');
                console.log('Target element:', e.target);
                console.log('Parent button element:', parentWithClass);
                addNewPaymentField();
                return; // Exit early to prevent other handlers from processing this event
            }
        }
        
        // Handle dynamically added "Sil" buttons for payments
        if (e.target.classList.contains('silOdemeBtn') || e.target.closest('.silOdemeBtn')) {
            e.preventDefault();
            e.stopPropagation(); // Prevent event from bubbling up
            console.log('Payment "Sil" button clicked');
            const paymentContainer = e.target.closest('.payment-container');
            if (paymentContainer) {
                const paymentId = paymentContainer.dataset.paymentId;
                console.log('Removing payment with ID:', paymentId);
                paymentContainer.remove();
                
                // Update payment numbers after deletion
                updatePaymentNumbers();
                
                // Show the original "Yeni Ödeme Ekle" button if all payment containers are removed
                const container = document.getElementById('cokluOdemeAlanlari');
                const originalButton = document.getElementById('yeniOdemeEkleBtn');
                if (container && originalButton) {
                    // Check if there are any remaining payment containers
                    const remainingPaymentContainers = container.querySelectorAll('.payment-container');
                    console.log('Remaining payment containers after deletion:', remainingPaymentContainers.length);
                    if (remainingPaymentContainers.length === 0) {
                originalButton.style.display = 'inline-block';
                        console.log('Showing original "Yeni Ödeme Ekle" button');
                    }
                }
            }
            return; // Exit early to prevent other handlers from processing this event
        }
    });
    
    // Add a MutationObserver to detect when new buttons are added to the DOM
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node or its children have the yeniOdemeEkleBtnDynamic class
                        if (node.classList && node.classList.contains && node.classList.contains('yeniOdemeEkleBtnDynamic')) {
                            console.log('New dynamic button detected (MutationObserver):', node);
                            // Add event listener to the new button if not already added
                            if (!node.hasAttribute('data-listener-added')) {
                                node.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('Dynamic button clicked (MutationObserver):', e.target);
                                    addNewPaymentField();
                                });
                                // Mark that we've added a listener to this button
                                node.setAttribute('data-listener-added', 'true');
                            }
                        } else {
                            // Check children of the added node
                            const dynamicButtons = node.querySelectorAll && node.querySelectorAll('.yeniOdemeEkleBtnDynamic');
                            if (dynamicButtons && dynamicButtons.length > 0) {
                                dynamicButtons.forEach((button) => {
                                    // Add event listener to the new button if not already added
                                    if (!button.hasAttribute('data-listener-added')) {
                                        console.log('New dynamic button detected in children (MutationObserver):', button);
                                        button.addEventListener('click', (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log('Dynamic button clicked (MutationObserver):', e.target);
                                            addNewPaymentField();
                                        });
                                        // Mark that we've added a listener to this button
                                        button.setAttribute('data-listener-added', 'true');
                                    }
                                });
                            }
                        }
                    }
                });
            }
        });
    });
    
    // Start observing the document for changes
    observer.observe(document.body, { childList: true, subtree: true });
};

/**
 * Setup search and filter events
 */
const setupSearchAndFilter = () => {
    const firmaSearchInput = document.getElementById('firmaSearch');
    const firmaTypeFilterSelect = document.getElementById('firmaTypeFilter');

    const handleFilter = () => {
        const query = (firmaSearchInput?.value || '').trim().toLowerCase();
        const filterType = firmaTypeFilterSelect?.value || 'all';
        const allFirmalar = getFirmalar();

        // Kullanıcı arama kutusunu tamamen boşalttığında ve filtre 'all' ise tüm listeyi anında geri getir
        if (query.length === 0 && filterType === 'all') {
            renderFirmaAccordion(allFirmalar);
            return;
        }

        const filteredList = allFirmalar.filter(firma => {
            const nameMatch = !query || (firma.name && firma.name.toLowerCase().includes(query));
            const vknMatch = !query || (firma.vkn_tc_no && firma.vkn_tc_no.toLowerCase().includes(query));
            const searchMatch = nameMatch || vknMatch;
            const typeMatch = (filterType === 'all') || (firma.turu === filterType);
            return searchMatch && typeMatch;
        });

        renderFirmaAccordion(filteredList);
    };

    if (firmaSearchInput) {
        firmaSearchInput.addEventListener('input', handleFilter);
        firmaSearchInput.addEventListener('keyup', handleFilter);
        firmaSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleFilter();
            }
        });
    }

    if (firmaTypeFilterSelect) {
        firmaTypeFilterSelect.addEventListener('change', handleFilter);
    }
};

/**
 * Update the delete button counter based on checked bulk checkboxes
 */
export const updateBulkDeleteButtonCount = () => {
    const deleteBtn = document.getElementById('bulkDeleteBtn');
    if (!deleteBtn) return;
    
    const checkedBoxes = document.querySelectorAll('#firmaAccordion .bulk-checkbox:checked');
    const count = checkedBoxes.length;
    
    deleteBtn.innerHTML = `<i class="fas fa-trash-alt me-1"></i> Seçilenleri Sil (${count})`;
    deleteBtn.disabled = (count === 0);
};

/**
 * Toggle or set bulk actions mode
 */
export const setBulkMode = (active) => {
    isBulkModeActive = active;
    
    const toolbar = document.getElementById('bulkActionsToolbar');
    const toggleBtn = document.getElementById('toggleBulkActionsBtn');
    const quickSelect = document.getElementById('bulkQuickSelect');
    
    const checkboxes = document.querySelectorAll('#firmaAccordion .bulk-checkbox');
    checkboxes.forEach(cb => {
        if (isBulkModeActive) {
            cb.classList.remove('d-none');
        } else {
            cb.classList.add('d-none');
            cb.checked = false;
        }
    });
    
    if (toolbar) {
        if (isBulkModeActive) {
            toolbar.classList.remove('d-none');
        } else {
            toolbar.classList.add('d-none');
        }
    }
    
    if (toggleBtn) {
        if (isBulkModeActive) {
            toggleBtn.classList.remove('btn-outline-secondary');
            toggleBtn.classList.add('btn-secondary');
            toggleBtn.innerHTML = '<i class="fas fa-times me-1"></i> Toplu İşlemleri Kapat';
        } else {
            toggleBtn.classList.remove('btn-secondary');
            toggleBtn.classList.add('btn-outline-secondary');
            toggleBtn.innerHTML = '<i class="fas fa-tasks me-1"></i> Toplu İşlemler';
        }
    }
    
    if (quickSelect && !isBulkModeActive) {
        quickSelect.value = '';
    }
    
    updateBulkDeleteButtonCount();
};

/**
 * Check if the active user is an admin (has multiple departments)
 * and show/hide the bulk actions toggle button accordingly
 */
export const checkAdminStatus = () => {
    const radioContainer = document.getElementById('departmentRadioButtons');
    const toggleBtn = document.getElementById('toggleBulkActionsBtn');
    if (!toggleBtn) return;
    
    const radioCount = radioContainer ? radioContainer.querySelectorAll('input[type="radio"]').length : 0;
    const isAdmin = radioCount > 1;
    
    if (isAdmin) {
        toggleBtn.classList.remove('d-none');
    } else {
        toggleBtn.classList.add('d-none');
        if (isBulkModeActive) {
            setBulkMode(false);
        }
    }
};

/**
 * Setup bulk actions toolbar events and listeners
 */
export const setupBulkActions = () => {
    const toggleBtn = document.getElementById('toggleBulkActionsBtn');
    const quickSelect = document.getElementById('bulkQuickSelect');
    const deleteBtn = document.getElementById('bulkDeleteBtn');
    const firmaAccordion = document.getElementById('firmaAccordion');
    
    // Toggle bulk mode button
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            setBulkMode(!isBulkModeActive);
        });
    }
    
    // Quick select dropdown
    if (quickSelect) {
        quickSelect.addEventListener('change', (e) => {
            const selectedType = e.target.value;
            if (!selectedType) return;
            
            const checkboxes = document.querySelectorAll('#firmaAccordion .bulk-checkbox');
            checkboxes.forEach(cb => {
                const turu = (cb.dataset.turu || '').toLowerCase().trim();
                if (selectedType === 'all') {
                    cb.checked = true;
                } else if (selectedType === 'clear') {
                    cb.checked = false;
                } else if (selectedType === 'satıcı' || selectedType === 'müşteri' || selectedType === 'grup') {
                    cb.checked = (turu === selectedType);
                }
            });
            
            updateBulkDeleteButtonCount();
            e.target.value = '';
        });
    }
    
    // Bulk delete button click
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const checkedBoxes = document.querySelectorAll('#firmaAccordion .bulk-checkbox:checked');
            const ids = Array.from(checkedBoxes).map(cb => cb.dataset.id).filter(Boolean);
            
            if (ids.length === 0) return;

            if (!confirm(`Seçili ${ids.length} adet firmayı silmek istediğinizden emin misiniz?`)) {
                return;
            }

            try {
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Siliniyor...';

                await deleteFirmalarBulk(ids);

                // UI akordiyonu güncelle
                renderFirmaAccordion();

                // Hızlı seçim menüsünü sıfırla
                if (quickSelect) {
                    quickSelect.value = '';
                }
            } catch (error) {
                console.error('Toplu silme işleminde hata:', error);
            } finally {
                // İşlem başarılı olsa da hata alsa da buton durumunu geri çevir ve sayacı güncelle
                updateBulkDeleteButtonCount();
            }
        });
    }
    
    // Accordion delegated change event for bulk checkboxes
    if (firmaAccordion) {
        firmaAccordion.addEventListener('change', (e) => {
            if (e.target.classList.contains('bulk-checkbox')) {
                updateBulkDeleteButtonCount();
            }
        });
    }
    
    // Observe departmentRadioButtons for dynamic admin detection
    const radioContainer = document.getElementById('departmentRadioButtons');
    if (radioContainer) {
        const observer = new MutationObserver(() => {
            checkAdminStatus();
        });
        observer.observe(radioContainer, { childList: true, subtree: true });
    }
    
    // Also listen to departmentChanged custom event
    window.addEventListener('departmentChanged', checkAdminStatus);
    
    // Initial admin check
    checkAdminStatus();
};

/**
 * Handle instruction type selection
 */
export const selectInstructionType = (typeKey, targetElement = null) => {
    if (!instructionTypes[typeKey]) {
        console.error('Unknown instruction type:', typeKey);
        return;
    }
    
    currentInstructionType = typeKey;
    const config = instructionTypes[typeKey];
    
    // Update display in navbar
    updateInstructionDisplay(config);
    
    // Show appropriate form section
    generateDynamicFormFields(config);
    
    // Update active state in menu
    document.querySelectorAll('[data-talimat-type]').forEach(item => {
        item.classList.remove('active');
    });
    if (targetElement) {
        targetElement.classList.add('active');
    }
    
    console.log('Selected instruction type:', config.title);
};

/**
 * Update the instruction type display in navbar
 */
const updateInstructionDisplay = (config) => {
    const displayElement = document.getElementById('selectedInstructionDisplay');
    if (!displayElement) return;
    
    const categoryInfo = getCategoryInfo(config.category);
    
    displayElement.style.opacity = '0.5';
    setTimeout(() => {
        displayElement.innerHTML = `
            <div class="instruction-badge">
                <i class="${categoryInfo.icon} instruction-icon"></i>
                <div class="instruction-text">
                    <span class="instruction-category">${categoryInfo.name}</span>
                    <span class="instruction-type">${config.title}</span>
                </div>
            </div>
        `;
        displayElement.style.opacity = '1';
    }, 150);
};

/**
 * Generate dynamic form fields based on instruction type
 */
const generateDynamicFormFields = (config) => {
    const container = document.getElementById('dynamicFormFields');
    if (!container) return;
    
    destroyChoices();
    container.innerHTML = '';
    
    let fieldsHTML = '';
    
    switch(config.category) {
        case 'havale':
        case 'cari':
            fieldsHTML = generateHavaleFields(config.subType);
            break;
        case 'doviz':
            fieldsHTML = generateDovizFields(config);
            break;
        case 'vergi':
        case 'sgk':
        case 'gumruk':
            fieldsHTML = generateOtherFields(config);
            break;
    }
    
    if (fieldsHTML) {
        container.innerHTML = `
            <div class="card border-info">
                <div class="card-header bg-info bg-opacity-10">
                    <h6 class="mb-0 text-info">
                        <i class="fas fa-cog"></i> ${config.title} - Özel Alanlar
                    </h6>
                </div>
                <div class="card-body">${fieldsHTML}</div>
            </div>
        `;
        
        // Set today's date after form creation for all instruction types
        let dateInput;
        switch(config.category) {
            case 'havale':
                dateInput = document.getElementById('talimatTarihi');
                break;
            case 'vergi':
                dateInput = document.getElementById('vergiTalimatTarihi');
                break;
            case 'sgk':
                dateInput = document.getElementById('sgkTalimatTarihi');
                break;
            case 'gumruk':
                dateInput = document.getElementById('gumrukTalimatTarihi');
                break;
            default:
                dateInput = document.getElementById('talimatTarihi');
        }
        
        if (dateInput) {
            dateInput.value = getTodayString();
        }
        
        populateFormDropdowns();
        
        if (config.category === 'doviz') {
            setTimeout(() => {
                initDovizCalculation();
                setupDovizGondericiAliciSync();
            }, 100);
        }
    } else {
        // Show a placeholder for unsupported types
        container.innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-info-circle"></i> 
                ${config.title} formu henüz geliştirilmektedir.
            </div>
        `;
    }
};

const DOVIZ_CINSLERI = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'DKK', 'SEK', 'NOK', 'RUB'];

/**
 * Initialize Döviz Calculation with "Sticky Override" Logic
 */
const initDovizCalculation = () => {
    const dovizInput = document.getElementById('dovizMiktari');
    const kurInput = document.getElementById('kur');
    const tlTutarInput = document.getElementById('tutar');
    
    if (!dovizInput || !kurInput || !tlTutarInput) return;
    
    let isUserOverridden = false;
    
    tlTutarInput.addEventListener('input', () => {
        if (tlTutarInput.value !== '') {
            isUserOverridden = true;
        } else {
            isUserOverridden = false;
            calculateTL();
        }
    });
    
    const calculateTL = () => {
        if (isUserOverridden) return;
        
        const miktar = parseFloat(dovizInput.value);
        const kur = parseFloat(kurInput.value);
        
        if (!isNaN(miktar) && !isNaN(kur)) {
            tlTutarInput.value = (miktar * kur).toFixed(2);
        }
    };
    
    dovizInput.addEventListener('input', () => {
        isUserOverridden = false;
        calculateTL();
    });
    
    kurInput.addEventListener('input', () => {
        isUserOverridden = false;
        calculateTL();
    });
};

/**
 * Setup logic to synchronize Sender Firm with Receiver Firm for FX transactions
 */
const setupDovizGondericiAliciSync = () => {
    const gondericiFirmaSelect = document.getElementById('gondericiFirma');
    const aliciFirmaSelect = document.getElementById('aliciFirma');
    const isDovizForm = document.getElementById('dovizIslemiTuru');
    
    if (!gondericiFirmaSelect || !aliciFirmaSelect || !isDovizForm) return;
    
    gondericiFirmaSelect.addEventListener('change', (e) => {
        const senderValue = e.target.value;
        
        if (choicesInstances && choicesInstances['aliciFirma']) {
            if (senderValue) {
                choicesInstances['aliciFirma'].setChoiceByValue(senderValue);
            } else {
                choicesInstances['aliciFirma'].clearStore();
            }
            // Trigger native event so handleDynamicFormChange catches it and updates the aliciBanka dropdown
            aliciFirmaSelect.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            aliciFirmaSelect.value = senderValue;
            aliciFirmaSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
};

/**
 * Generate Döviz Alım/Satım specific fields
 */
const generateDovizFields = (config) => {
    const isAlim = config.subType === 'Döviz Alım';
    const islemYonu = isAlim ? 'alım' : 'satım';
    
    const gondericiHesapLabel = isAlim ? 'Gönderici Hesap (TRY)' : 'Gönderici Hesap (Döviz)';
    const aliciHesapLabel = isAlim ? 'Alıcı Hesap (Döviz)' : 'Alıcı Hesap (TRY)';
    
    return `
        <div class="row">
            <input type="hidden" id="dovizIslemiTuru" value="${islemYonu}">
            
            <div class="col-md-6">
                <div class="card border-warning mb-3">
                    <div class="card-header bg-warning bg-opacity-10">
                        <h6 class="mb-0 text-warning">
                            <i class="fas fa-arrow-up"></i> Gönderici Bilgileri
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label for="gondericiFirma" class="form-label">Gönderici Firma <span class="text-danger">*</span></label>
                            <select class="form-select" id="gondericiFirma" data-filter-type="grup" required>
                                <option value="">Firma Seçiniz</option>
                            </select>
                            <div class="form-text">Sadece Grup firmaları işlem yapabilir</div>
                        </div>
                        <div class="mb-3">
                            <label for="gondericiBanka" class="form-label">${gondericiHesapLabel} <span class="text-danger">*</span></label>
                            <select class="form-select" id="gondericiBanka" required>
                                <option value="">Önce Firma Seçiniz</option>
                            </select>
                        </div>
                        <div id="gondericiBankaDetay"></div>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6">
                <div class="card border-info mb-3">
                    <div class="card-header bg-info bg-opacity-10">
                        <h6 class="mb-0 text-info">
                            <i class="fas fa-arrow-down"></i> Alıcı Bilgileri
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label for="aliciFirma" class="form-label">Alıcı Firma <span class="text-danger">*</span></label>
                            <select class="form-select" id="aliciFirma" data-filter-type="grup" required disabled>
                                <option value="">Gönderici ile aynı olacak</option>
                            </select>
                            <div class="form-text">Alıcı firma otomatik olarak Gönderici firma ile eşlenir</div>
                        </div>
                        <div class="mb-3">
                            <label for="aliciBanka" class="form-label">${aliciHesapLabel} <span class="text-danger">*</span></label>
                            <select class="form-select" id="aliciBanka" required>
                                <option value="">Önce Gönderici Seçiniz</option>
                            </select>
                        </div>
                        <div id="aliciBankaDetay"></div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row">
            <div class="col-md-12">
                <div class="card border-success">
                    <div class="card-header bg-success bg-opacity-10">
                        <h6 class="mb-0 text-success">
                            <i class="fas fa-coins"></i> İşlem ve Döviz Detayları
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-3 mb-3">
                                <label for="dovizCinsi" class="form-label">Döviz Cinsi <span class="text-danger">*</span></label>
                                <input type="text" class="form-control fw-bold text-primary bg-light" id="dovizCinsi" readonly placeholder="Banka seçilince otomatik dolar" required>
                            </div>
                            <div class="col-md-3 mb-3">
                                <label for="dovizMiktari" class="form-label">Döviz Miktarı <span class="text-danger">*</span></label>
                                <input type="number" class="form-control" id="dovizMiktari" step="0.01" min="0.01" placeholder="0.00" required>
                            </div>
                            <div class="col-md-3 mb-3">
                                <label for="kur" class="form-label">İşlem Kuru <span class="text-danger">*</span></label>
                                <input type="number" class="form-control" id="kur" step="0.000001" min="0.000001" placeholder="0.000000" required>
                            </div>
                            <div class="col-md-3 mb-3">
                                <label for="tutar" class="form-label">TL Karşılığı <span class="text-danger">*</span></label>
                                <div class="input-group">
                                    <input type="number" class="form-control" id="tutar" step="0.01" min="0.01" placeholder="0.00" required>
                                    <span class="input-group-text">TRY</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <label for="talimatTarihi" class="form-label">Talimat Tarihi <span class="text-danger">*</span></label>
                                <input type="date" class="form-control" id="talimatTarihi" required>
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="valorTarihi" class="form-label">Valör Tarihi</label>
                                <input type="date" class="form-control" id="valorTarihi">
                                <div class="form-text">Boş bırakılırsa Talimat Tarihi kullanılır</div>
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="aciklama" class="form-label">Açıklama</label>
                                <input type="text" class="form-control" id="aciklama" placeholder="İsteğe bağlı işlem açıklaması">
                            </div>
                        </div>
                        <div class="d-grid gap-2 d-md-flex justify-content-md-end mt-3">
                            <button type="button" class="btn btn-success" id="talimatOlusturBtn">
                                <i class="fas fa-check"></i> Talimat Oluştur
                            </button>
                            <button type="button" class="btn btn-secondary" id="talimatYazdirBtn">
                                <i class="fas fa-print"></i> Yazdır
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

/**
 * Generate Havale/EFT specific fields
 */
const generateHavaleFields = (subType) => {
    const isInternalTransfer = subType === 'İç Transfer'; // İç Transfer
    const isExternalTransfer = subType === 'Dış Transfer'; // Dış Transfer
    const isSupplierPayment = subType === 'Satıcı Ödemesi'; // Satıcı Ödemesi
    const isCustomerPayment = subType === 'Müşteri Ödemesi'; // Müşteri Ödemesi
    const isCariPayment = isSupplierPayment || isCustomerPayment;
    
    // Determine the filter type for the recipient company dropdown
    let aliciFilterType = 'all';
    if (isInternalTransfer) {
        aliciFilterType = 'grup';
    } else if (isSupplierPayment) {
        aliciFilterType = 'satıcı';
    } else if (isCustomerPayment) {
        aliciFilterType = 'müşteri';
    }
    
    return `
        <div class="row">
            <div class="col-md-6">
                <div class="card border-primary">
                    <div class="card-header bg-primary bg-opacity-10">
                        <h6 class="mb-0 text-primary">
                            <i class="fas fa-arrow-right"></i> Gönderici Bilgileri
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label for="gondericiFirma" class="form-label">Gönderici Firma <span class="text-danger">*</span></label>
                            <select class="form-select" id="gondericiFirma" data-filter-type="grup" required>
                                <option value="">Firma Seçiniz</option>
                            </select>
                            <div class="form-text">Sadece Grup firmaları gösterilir</div>
                        </div>
                        <div class="mb-3">
                            <label for="gondericiBanka" class="form-label">Gönderici Hesap <span class="text-danger">*</span></label>
                            <select class="form-select" id="gondericiBanka" required>
                                <option value="">Önce Firma Seçiniz</option>
                            </select>
                        </div>
                        <div id="gondericiBankaDetay"></div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card border-success">
                    <div class="card-header bg-success bg-opacity-10 d-flex justify-content-between align-items-center">
                        <h6 class="mb-0 text-success">
                            <i class="fas fa-arrow-left"></i> Alıcı Bilgileri
                        </h6>
                        <span class="badge bg-info">Ödeme #1</span>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label for="aliciFirma" class="form-label">Alıcı Firma <span class="text-danger">*</span></label>
                            <select class="form-select" id="aliciFirma" data-filter-type="${aliciFilterType}" required>
                                <option value="">Firma Seçiniz</option>
                            </select>
                            <div class="form-text">
                                ${isInternalTransfer ? 'Sadece Grup firmaları gösterilir' : 
                                  isSupplierPayment ? 'Sadece Satıcı firmaları gösterilir' : 
                                  isCustomerPayment ? 'Sadece Müşteri firmaları gösterilir' : 
                                  'Tüm firmalar gösterilir'}
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="aliciBanka" class="form-label">Alıcı Hesap <span class="text-danger">*</span></label>
                            <select class="form-select" id="aliciBanka" required>
                                <option value="">Önce Firma Seçiniz</option>
                            </select>
                        </div>
                        <div id="aliciBankaDetay"></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="row mt-4">
            <div class="col-md-12">
                <div class="card border-warning">
                    <div class="card-header bg-warning bg-opacity-10">
                        <h6 class="mb-0 text-warning">
                            <i class="fas fa-edit"></i> İşlem Bilgileri
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <label for="tutar" class="form-label">Tutar <span class="text-danger">*</span></label>
                                <div class="input-group">
                                    <input type="number" class="form-control" id="tutar" step="0.01" min="0.01" placeholder="0.00" required>
                                    <span class="input-group-text" id="paraBirimiGosterge">TRY</span>
                                </div>
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="talimatTarihi" class="form-label">Talimat Tarihi <span class="text-danger">*</span></label>
                                <input type="date" class="form-control" id="talimatTarihi" required>
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">Para Birimi Kontrolü</label>
                                <div id="paraBirimiUyari" class="alert alert-info d-none">
                                    <small><i class="fas fa-info-circle"></i> Para birimlerinin uyuşması gerekir</small>
                                </div>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="aciklama" class="form-label">Açıklama</label>
                            <textarea class="form-control" id="aciklama" rows="3" placeholder="İşlem açıklaması (opsiyonel)"></textarea>
                        </div>
                        ${isCariPayment ? `
                        <div class="mb-3">
                            <button type="button" class="btn btn-info" id="yeniOdemeEkleBtn">
                                <i class="fas fa-plus"></i> Yeni Ödeme Ekle
                            </button>
                        </div>
                        <div id="cokluOdemeAlanlari"></div>
                        ` : ''}
                        <div class="d-grid gap-2 d-md-flex justify-content-md-end">
                            <button type="button" class="btn btn-success" id="talimatOlusturBtn">
                                <i class="fas fa-check"></i> Talimat Oluştur
                            </button>
                            <button type="button" class="btn btn-secondary" id="talimatYazdirBtn">
                                <i class="fas fa-print"></i> Yazdır
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

/**
 * Generate fields for other instruction types (placeholder)
 */
const generateOtherFields = (config) => {
    if (config.category === 'vergi') {
        return generateVergiFields(config);
    }
    if (config.category === 'sgk') {
        return generateSGKFields(config);
    }
    
    if (config.category === 'gumruk') {
        return generateGumrukFields(config);
    }
    
    return `
        <div class="row">
            <div class="col-md-12">
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i>
                    ${config.title} formu henüz tamamlanmamıştır. Bu özellik gelecek güncellemelerde eklenecektir.
                </div>
            </div>
        </div>
    `;
};

/**
 * Generate Vergi payment specific fields
 */
const generateVergiFields = (config) => {
    return `
        <div class="row">
            <div class="col-md-12">
                <div class="card border-primary">
                    <div class="card-header bg-primary bg-opacity-10">
                        <h6 class="mb-0 text-primary">
                            <i class="fas fa-arrow-right"></i> Gönderici Bilgileri
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label for="vergiGondericiFirma" class="form-label">Gönderici Firma <span class="text-danger">*</span></label>
                            <select class="form-select" id="vergiGondericiFirma" data-filter-type="grup" required>
                                <option value="">Firma Seçiniz</option>
                            </select>
                            <div class="form-text">Sadece Grup firmaları gösterilir</div>
                        </div>
                        <div class="mb-3">
                            <label for="vergiGondericiBanka" class="form-label">Gönderici Hesap <span class="text-danger">*</span></label>
                            <select class="form-select" id="vergiGondericiBanka" required>
                                <option value="">Önce Firma Seçiniz</option>
                            </select>
                        </div>
                        <div id="vergiGondericiBankaDetay"></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="row mt-4">
            <div class="col-md-12">
                <div class="card border-warning">
                    <div class="card-header bg-warning bg-opacity-10">
                        <h6 class="mb-0 text-warning">
                            <i class="fas fa-edit"></i> İşlem Bilgileri
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="vergiTutar" class="form-label">Tutar <span class="text-danger">*</span></label>
                                <div class="input-group">
                                    <input type="number" class="form-control" id="vergiTutar" step="0.01" min="0.01" placeholder="0.00" required>
                                    <span class="input-group-text" id="vergiParaBirimiGosterge">TRY</span>
                                </div>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="vergiTalimatTarihi" class="form-label">Talimat Tarihi <span class="text-danger">*</span></label>
                                <input type="date" class="form-control" id="vergiTalimatTarihi" required>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="tahakkukNo" class="form-label">Tahakkuk No <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="tahakkukNo" required>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="vergiDonem" class="form-label">Vergilendirme Dönemi <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="vergiDonem" placeholder="Örn: 2023-01" required>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="vergiAciklama" class="form-label">Açıklama</label>
                            <textarea class="form-control" id="vergiAciklama" rows="3" placeholder="İşlem açıklaması (opsiyonel)"></textarea>
                        </div>
                        <div class="d-grid gap-2 d-md-flex justify-content-md-end">
                            <button type="button" class="btn btn-success" id="talimatOlusturBtn">
                                <i class="fas fa-check"></i> Talimat Oluştur
                            </button>
                            <button type="button" class="btn btn-secondary" id="talimatYazdirBtn">
                                <i class="fas fa-print"></i> Yazdır
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

/**
 * Generate SGK payment specific fields
 */
const generateSGKFields = (config) => {
    return `
        <div class="row">
            <div class="col-md-12">
                <div class="card border-primary">
                    <div class="card-header bg-primary bg-opacity-10">
                        <h6 class="mb-0 text-primary">
                            <i class="fas fa-arrow-right"></i> Gönderici Bilgileri
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label for="sgkGondericiFirma" class="form-label">Gönderici Firma <span class="text-danger">*</span></label>
                            <select class="form-select" id="sgkGondericiFirma" data-filter-type="grup" required>
                                <option value="">Firma Seçiniz</option>
                            </select>
                            <div class="form-text">Sadece Grup firmaları gösterilir</div>
                        </div>
                        <div class="mb-3">
                            <label for="sgkGondericiBanka" class="form-label">Gönderici Hesap <span class="text-danger">*</span></label>
                            <select class="form-select" id="sgkGondericiBanka" required>
                                <option value="">Önce Firma Seçiniz</option>
                            </select>
                        </div>
                        <div id="sgkGondericiBankaDetay"></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="row mt-4">
            <div class="col-md-12">
                <div class="card border-warning">
                    <div class="card-header bg-warning bg-opacity-10">
                        <h6 class="mb-0 text-warning">
                            <i class="fas fa-edit"></i> İşlem Bilgileri
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="sgkTutar" class="form-label">Tutar <span class="text-danger">*</span></label>
                                <div class="input-group">
                                    <input type="number" class="form-control" id="sgkTutar" step="0.01" min="0.01" placeholder="0.00" required>
                                    <span class="input-group-text" id="sgkParaBirimiGosterge">TRY</span>
                                </div>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="sgkTalimatTarihi" class="form-label">Talimat Tarihi <span class="text-danger">*</span></label>
                                <input type="date" class="form-control" id="sgkTalimatTarihi" required>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="sgkSicilNo" class="form-label">SGK Sicil No <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="sgkSicilNo" required>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="sgkDonem" class="form-label">SGK Dönemi <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="sgkDonem" placeholder="Örn: 2023-01" required>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="sgkAciklama" class="form-label">Açıklama</label>
                            <textarea class="form-control" id="sgkAciklama" rows="3" placeholder="İşlem açıklaması (opsiyonel)"></textarea>
                        </div>
                        <div class="d-grid gap-2 d-md-flex justify-content-md-end">
                            <button type="button" class="btn btn-success" id="talimatOlusturBtn">
                                <i class="fas fa-check"></i> Talimat Oluştur
                            </button>
                            <button type="button" class="btn btn-secondary" id="talimatYazdirBtn">
                                <i class="fas fa-print"></i> Yazdır
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

/**
 * Generate Gümrük payment specific fields
 */
const generateGumrukFields = (config) => {
    // Different field requirements based on gumruk subType
    let specificFields = '';
    
    switch(config.subType) {
        case 'Gümrük Vergisi':
            specificFields = `
                <div class="col-md-6 mb-3">
                    <label for="gumrukBeyannameNo" class="form-label">Gümrük Beyanname No <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="gumrukBeyannameNo" required>
                </div>
                <div class="col-md-6 mb-3">
                    <label for="gtipKodu" class="form-label">GTIP Kodu</label>
                    <input type="text" class="form-control" id="gtipKodu" placeholder="Örn: 8517.12.00.00">
                </div>
            `;
            break;
        case 'ÖTV Ödemesi':
            specificFields = `
                <div class="col-md-6 mb-3">
                    <label for="gumrukBeyannameNo" class="form-label">Gümrük Beyanname No <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="gumrukBeyannameNo" required>
                </div>
                <div class="col-md-6 mb-3">
                    <label for="otvOrani" class="form-label">ÖTV Oranı (%)</label>
                    <input type="number" class="form-control" id="otvOrani" step="0.01" min="0" placeholder="Örn: 40.00">
                </div>
            `;
            break;
        case 'İthalat Harcı':
            specificFields = `
                <div class="col-md-6 mb-3">
                    <label for="gumrukBeyannameNo" class="form-label">Gümrük Beyanname No <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="gumrukBeyannameNo" required>
                </div>
                <div class="col-md-6 mb-3">
                    <label for="harcTuru" class="form-label">Harc Türü</label>
                    <select class="form-select" id="harcTuru">
                        <option value="">Seçiniz</option>
                        <option value="ithalat">İthalat Harcı</option>
                        <option value="diger">Diğer Harçlar</option>
                    </select>
                </div>
            `;
            break;
        default:
            specificFields = `
                <div class="col-md-12 mb-3">
                    <label for="gumrukBeyannameNo" class="form-label">Gümrük Beyanname No <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="gumrukBeyannameNo" required>
                </div>
            `;
    }
    
    return `
        <div class="row">
            <div class="col-md-12">
                <div class="card border-primary">
                    <div class="card-header bg-primary bg-opacity-10">
                        <h6 class="mb-0 text-primary">
                            <i class="fas fa-arrow-right"></i> Gönderici Bilgileri
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label for="gumrukGondericiFirma" class="form-label">Gönderici Firma <span class="text-danger">*</span></label>
                            <select class="form-select" id="gumrukGondericiFirma" data-filter-type="grup" required>
                                <option value="">Firma Seçiniz</option>
                            </select>
                            <div class="form-text">Sadece Grup firmaları gösterilir</div>
                        </div>
                        <div class="mb-3">
                            <label for="gumrukGondericiBanka" class="form-label">Gönderici Hesap <span class="text-danger">*</span></label>
                            <select class="form-select" id="gumrukGondericiBanka" required>
                                <option value="">Önce Firma Seçiniz</option>
                            </select>
                        </div>
                        <div id="gumrukGondericiBankaDetay"></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="row mt-4">
            <div class="col-md-12">
                <div class="card border-warning">
                    <div class="card-header bg-warning bg-opacity-10">
                        <h6 class="mb-0 text-warning">
                            <i class="fas fa-edit"></i> İşlem Bilgileri
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="gumrukTutar" class="form-label">Tutar <span class="text-danger">*</span></label>
                                <div class="input-group">
                                    <input type="number" class="form-control" id="gumrukTutar" step="0.01" min="0.01" placeholder="0.00" required>
                                    <span class="input-group-text" id="gumrukParaBirimiGosterge">TRY</span>
                                </div>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="gumrukTalimatTarihi" class="form-label">Talimat Tarihi <span class="text-danger">*</span></label>
                                <input type="date" class="form-control" id="gumrukTalimatTarihi" required>
                            </div>
                        </div>
                        <div class="row">
                            ${specificFields}
                        </div>
                        <div class="mb-3">
                            <label for="gumrukAciklama" class="form-label">Açıklama</label>
                            <textarea class="form-control" id="gumrukAciklama" rows="3" placeholder="İşlem açıklaması (opsiyonel)"></textarea>
                        </div>
                        <div class="d-grid gap-2 d-md-flex justify-content-md-end">
                            <button type="button" class="btn btn-success" id="talimatOlusturBtn">
                                <i class="fas fa-check"></i> Talimat Oluştur
                            </button>
                            <button type="button" class="btn btn-secondary" id="talimatYazdirBtn">
                                <i class="fas fa-print"></i> Yazdır
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

/**
 * Populate form dropdowns with firm data
 */
const populateFormDropdowns = () => {
    const firmalar = getFirmalar();
    
    console.log('Populating form dropdowns with', firmalar.length, 'firms');
    
    // Include all types of firma selects
    const firmSelects = ['gondericiFirma', 'aliciFirma', 'vergiGondericiFirma', 'sgkGondericiFirma', 'gumrukGondericiFirma'];
    
    firmSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            // If a Choices instance already exists for this element, destroy it first
            if (choicesInstances[selectId]) {
                choicesInstances[selectId].destroy();
                delete choicesInstances[selectId];
            }
            
            const filterType = select.getAttribute('data-filter-type');
            
            select.innerHTML = '<option value="">Firma Seçiniz</option>';
            
            // Filter firms based on the data-filter-type attribute
            let filteredFirmalar = firmalar;
            if (filterType === 'grup') {
                filteredFirmalar = firmalar.filter(firma => firma.turu === 'grup');
            } else if (filterType === 'satıcı' || filterType === 'müşteri') {
                // For cari account payments, filter based on the specific type
                filteredFirmalar = firmalar.filter(firma => firma.turu === filterType);
            }
            // 'all' or no filter means all firms

            // Get current selected department
            const currentDeptNode = document.querySelector('input[name="department_prefix"]:checked') || document.querySelector('input[type="hidden"][name="department_prefix"]');
            const aktifBolum = currentDeptNode ? currentDeptNode.value : null;

            // Gönderici kısıtlı (katı izolasyon), Alıcı serbest (virman izni)
            if (aktifBolum && selectId !== 'aliciFirma') {
                filteredFirmalar = filteredFirmalar.filter(firma => 
                    !firma.department || firma.department === 'ORTAK' || firma.department === aktifBolum
                );
            }
            
            filteredFirmalar.forEach(firma => {
                const option = new Option(firma.name, firma.id);
                select.add(option);
            });
            
            if (window.Choices) {
                choicesInstances[selectId] = new Choices(select, {
                    searchEnabled: true,
                    searchFloor: 3,
                    itemSelectText: 'Seçmek için tıklayın',
                    noResultsText: 'Sonuç bulunamadı',
                    noChoicesText: 'Seçenek bulunmuyor'
                });
            }
            
            console.log(`Populated ${selectId} with ${filteredFirmalar.length}/${firmalar.length} firms (filter: ${filterType || 'all'})`);
        }
    });
};

/**
 * Populate bank select for a specific firm
 */
const populateBankaSelect = (firmaId, bankaSelect, currencyFilter = null) => {
    if (!bankaSelect) return;
    
    bankaSelect.innerHTML = '<option value="">Hesap Seçiniz</option>';
    
    if (firmaId) {
        let banks = getBanksForFirma(firmaId);
        
        if (currencyFilter === 'TRY') {
            banks = banks.filter(b => b.para_birimi === 'TRY' || b.para_birimi === 'TL');
        } else if (currencyFilter === '!TRY') {
            banks = banks.filter(b => b.para_birimi !== 'TRY' && b.para_birimi !== 'TL');
        }
        
        banks.forEach(banka => {
            const displayName = getBankDisplayName(banka);
            const option = new Option(displayName, banka.id);
            bankaSelect.add(option);
        });
    }
};

/**
 * Show bank details
 */
const showBankaDetay = (firmaId, bankaId, detayElement) => {
    if (!detayElement) return;
    
    detayElement.innerHTML = '';
    
    if (firmaId && bankaId) {
        const banks = getBanksForFirma(firmaId);
        const banka = banks.find(b => b.id == bankaId);
        
        if (banka) {
            detayElement.innerHTML = `
                <div class="alert alert-info mt-2">
                    <p class="mb-1"><strong>IBAN:</strong> ${formatIBAN(banka.iban)}</p>
                    <p class="mb-0"><strong>Şube:</strong> ${banka.sube_adi}</p>
                </div>
            `;
        }
    }
};

/**
 * Update currency control display
 */
const updateParaBirimiKontrol = () => {
    const gondericiFirmaSelect = document.getElementById('gondericiFirma');
    const gondericiBankaSelect = document.getElementById('gondericiBanka');
    const aliciFirmaSelect = document.getElementById('aliciFirma');
    const aliciBankaSelect = document.getElementById('aliciBanka');
    const paraBirimiGosterge = document.getElementById('paraBirimiGosterge');
    const paraBirimiUyari = document.getElementById('paraBirimiUyari');
    
    if (!gondericiFirmaSelect || !gondericiBankaSelect || !aliciFirmaSelect || !aliciBankaSelect) {
        return;
    }
    
    const gondericiBanks = getBanksForFirma(gondericiFirmaSelect.value);
    const gondericiBanka = gondericiBanks.find(b => b.id == gondericiBankaSelect.value);
    const aliciBanks = getBanksForFirma(aliciFirmaSelect.value);
    const aliciBanka = aliciBanks.find(b => b.id == aliciBankaSelect.value);
    
    if (gondericiBanka && paraBirimiGosterge) {
        paraBirimiGosterge.textContent = gondericiBanka.para_birimi;
    }
    
    if (gondericiBanka && aliciBanka && paraBirimiUyari) {
        const isCompatible = checkCurrencyCompatibility(gondericiBanka, aliciBanka);
        
        if (isCompatible) {
            paraBirimiUyari.className = 'alert alert-success';
            paraBirimiUyari.innerHTML = `
                <small><i class="fas fa-check-circle"></i> 
                Para birimleri uyuşuyor: ${gondericiBanka.para_birimi}
                </small>
            `;
        } else {
            paraBirimiUyari.className = 'alert alert-danger';
            paraBirimiUyari.innerHTML = `
                <small><i class="fas fa-exclamation-triangle"></i> 
                Para birimi uyuşmazlığı! Gönderici: ${gondericiBanka.para_birimi}, Alıcı: ${aliciBanka.para_birimi}
                </small>
            `;
        }
        
        paraBirimiUyari.classList.remove('d-none');
    }
};

/**
 * Handle SWIFT code validation on input
 */
const handleSWIFTValidation = (e) => {
    if (e.target.id === 'swiftKodu') {
        const input = e.target;
        const value = input.value.trim().toUpperCase();
        
        // Auto-format to uppercase
        input.value = value;
        
        // Remove existing validation classes
        input.classList.remove('is-valid', 'is-invalid');
        
        // Clear existing feedback
        let feedback = input.parentElement.querySelector('.invalid-feedback, .valid-feedback');
        if (feedback) feedback.remove();
        
        // Only validate if there's input
        if (value) {
            const validation = validateSWIFTCode(value);
            
            // Create feedback element
            feedback = document.createElement('div');
            feedback.textContent = validation.message;
            
            if (validation.isValid) {
                input.classList.add('is-valid');
                feedback.className = 'valid-feedback';
            } else {
                input.classList.add('is-invalid');
                feedback.className = 'invalid-feedback';
            }
            
            input.parentElement.appendChild(feedback);
        }
    }
};

/**
 * Render the firm/bank accordion UI
 */
export const renderFirmaAccordion = (filteredList = null) => {
    const firmaAccordion = document.getElementById('firmaAccordion');
    if (!firmaAccordion) return;
    
    const firmalar = filteredList !== null ? filteredList : getFirmalar();
    firmaAccordion.innerHTML = '';
    
    const sortedFirmalar = [...firmalar].sort((a, b) => a.name.localeCompare(b.name));
    
    if (sortedFirmalar.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'text-center text-muted p-4';
        emptyEl.innerHTML = '<i class="fas fa-search me-2"></i>Eşleşen firma bulunamadı.';
        firmaAccordion.appendChild(emptyEl);
    }
    
    sortedFirmalar.forEach(firma => {
        const bankaListesiHtml = (firma.bankalar || [])
            .sort((a, b) => a.banka_adi.localeCompare(b.banka_adi))
            .map(banka => {
                const swiftInfo = banka.swift_kodu ? `<br><small class="text-info">SWIFT: ${banka.swift_kodu}</small>` : '';
                return `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${getBankDisplayName(banka)}</strong>
                        <br>
                        <small class="text-muted">${banka.sube_adi} / ${formatIBAN(banka.iban)}</small>
                        ${swiftInfo}
                    </div>
                    <div>
                        <button class="btn btn-outline-secondary btn-sm edit-banka" data-firma-id="${firma.id}" data-banka-id="${banka.id}">Düzenle</button>
                        <button class="btn btn-outline-danger btn-sm delete-banka" data-firma-id="${firma.id}" data-banka-id="${banka.id}">Sil</button>
                    </div>
                </li>
            `;
            }).join('');

        const checkboxClass = isBulkModeActive ? 'form-check-input bulk-checkbox me-2' : 'form-check-input bulk-checkbox me-2 d-none';

        const firmaEl = document.createElement('div');
        firmaEl.classList.add('accordion-item');
        firmaEl.innerHTML = `
            <h2 class="accordion-header" id="heading-${firma.id}">
                <button class="accordion-button collapsed d-flex align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${firma.id}">
                    <input type="checkbox" class="${checkboxClass}" data-id="${firma.id}" data-turu="${firma.turu || ''}">
                    <span>${firma.name}</span>
                </button>
            </h2>
            <div id="collapse-${firma.id}" class="accordion-collapse collapse" data-bs-parent="#firmaAccordion">
                <div class="accordion-body">
                    ${firma.vkn_tc_no || firma.vergi_dairesi ? `
                    <div class="alert alert-info">
                        ${firma.vkn_tc_no ? `<div><strong>VKN/T.C. No:</strong> ${firma.vkn_tc_no}</div>` : ''}
                        ${firma.vergi_dairesi ? `<div><strong>Vergi Dairesi:</strong> ${firma.vergi_dairesi}</div>` : ''}
                    </div>
                    ` : ''}
                    <ul class="list-group">
                        ${bankaListesiHtml}
                    </ul>
                    <button class="btn btn-primary btn-sm mt-3 add-banka" data-firma-id="${firma.id}">Banka Hesabı Ekle</button>
                    <button class="btn btn-warning btn-sm mt-3 edit-firma" data-firma-id="${firma.id}">Firma Düzenle</button>
                    <button class="btn btn-danger btn-sm mt-3 delete-firma" data-firma-id="${firma.id}">Firma Sil</button>
                </div>
            </div>
        `;

        // Prevent collapse toggle when clicking directly on the bulk checkbox
        const bulkCb = firmaEl.querySelector('.bulk-checkbox');
        if (bulkCb) {
            bulkCb.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        firmaAccordion.appendChild(firmaEl);
    });
    
    if (isBulkModeActive) {
        updateBulkDeleteButtonCount();
    }

    if (filteredList === null) {
        populateFormDropdowns();
    }
};

/**
 * Show notification message to user
 */
export const showNotification = (message, type = 'success') => {
    if (type === 'error') {
        alert(`Hata: ${message}`);
    } else {
        alert(message);
    }
};

/**
 * Show modal for firma editing
 */
export const showFirmaModal = (firma = null) => {
    const isEdit = firma !== null;
    
    document.getElementById('firmaModalLabel').textContent = isEdit ? 'Firma Düzenle' : 'Firma Ekle';
    
    const form = document.getElementById('firmaForm');
    form.reset();
    
    if (isEdit) {
        const firmaIdElement = document.getElementById('firmaId');
        const firmaAdiElement = document.getElementById('firmaAdi');
        const firmaTuruElement = document.getElementById('firmaTuru');
        const firmaBolumuElement = document.getElementById('firmaBolumu');
        const firmaVknTcElement = document.getElementById('firmaVknTc');
        const firmaVergiDairesiElement = document.getElementById('firmaVergiDairesi');
        const firmaSGKSicilNoElement = document.getElementById('firmaSGKSicilNo');
        const firmaSGKAdiElement = document.getElementById('firmaSGKAdi');
        
        if (firmaIdElement) firmaIdElement.value = firma.id;
        if (firmaAdiElement) firmaAdiElement.value = firma.name;
        if (firmaTuruElement) firmaTuruElement.value = firma.turu || '';
        if (firmaBolumuElement) firmaBolumuElement.value = firma.department || 'ORTAK';
        if (firmaVknTcElement) firmaVknTcElement.value = firma.vkn_tc_no || '';
        if (firmaVergiDairesiElement) firmaVergiDairesiElement.value = firma.vergi_dairesi || '';
        if (firmaSGKSicilNoElement) firmaSGKSicilNoElement.value = firma.sgk_sicil_no || '';
        if (firmaSGKAdiElement) firmaSGKAdiElement.value = firma.sgk_adi || '';
    } else {
        const firmaIdElement = document.getElementById('firmaId');
        if (firmaIdElement) firmaIdElement.value = '';
    }
    
    firmaModal.show();
};

/**
 * Populate bank name select with Choices.js
 */
export const populateBankaAdiSelect = () => {
    const select = document.getElementById('bankaAdi');
    if (select) {
        if (choicesInstances['bankaAdi']) {
            choicesInstances['bankaAdi'].destroy();
            delete choicesInstances['bankaAdi'];
        }
        
        select.innerHTML = '<option value="">Seçiniz...</option>';
        
        KATEGORI_SIRASI.forEach(kategori => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = kategori;
            
            const bankalar = BANKA_LISTESI.filter(b => b.kategori === kategori);
            bankalar.forEach(banka => {
                const option = new Option(banka.banka_adi, banka.banka_adi);
                optgroup.appendChild(option);
            });
            
            if (bankalar.length > 0) {
                select.appendChild(optgroup);
            }
        });
        
        if (window.Choices) {
            choicesInstances['bankaAdi'] = new Choices(select, {
                searchEnabled: true,
                searchFloor: 3,
                itemSelectText: 'Seçmek için tıklayın',
                noResultsText: 'Sonuç bulunamadı',
                noChoicesText: 'Seçenek bulunmuyor'
            });
        }
    }
};

/**
 * Show modal for bank editing
 */
export const showBankaModal = (firmaId, banka = null) => {
    const isEdit = banka !== null;
    
    const bankaModalLabelElement = document.getElementById('bankaModalLabel');
    if (bankaModalLabelElement) {
        bankaModalLabelElement.textContent = isEdit ? 'Banka Hesabı Düzenle' : 'Banka Hesabı Ekle';
    }
    
    const form = document.getElementById('bankaForm');
    if (form) form.reset();
    
    // Setup Banka Adi Select
    populateBankaAdiSelect();
    
    const bankaFirmaIdElement = document.getElementById('bankaFirmaId');
    if (bankaFirmaIdElement) bankaFirmaIdElement.value = firmaId;
    
    if (isEdit) {
        const bankaIdElement = document.getElementById('bankaId');
        const bankaAdiElement = document.getElementById('bankaAdi');
        const subeAdiElement = document.getElementById('subeAdi');
        const subeIlElement = document.getElementById('subeIl');
        const ibanElement = document.getElementById('iban');
        const paraBirimiElement = document.getElementById('paraBirimi');
        const hesapNoElement = document.getElementById('hesapNo');
        const swiftKoduElement = document.getElementById('swiftKodu');
        
        
        if (bankaIdElement) bankaIdElement.value = banka.id;
        if (bankaAdiElement) {
            const canonicalName = getCanonicalBankaAdi(banka.banka_adi);
            if (canonicalName) {
                // If Choices is active, we should set it by value
                if (choicesInstances['bankaAdi']) {
                    choicesInstances['bankaAdi'].setChoiceByValue(canonicalName);
                } else {
                    bankaAdiElement.value = canonicalName;
                }
            }
            // If not found, we leave it empty (default) to force user to choose a valid one
        }
        if (subeAdiElement) subeAdiElement.value = banka.sube_adi || '';
        if (subeIlElement) subeIlElement.value = banka.sube_il || '';
        if (ibanElement) ibanElement.value = banka.iban;
        if (paraBirimiElement) paraBirimiElement.value = banka.para_birimi;
        if (hesapNoElement) hesapNoElement.value = banka.hesap_no || '';
        if (swiftKoduElement) swiftKoduElement.value = banka.swift_kodu || '';
    } else {
        const bankaIdElement = document.getElementById('bankaId');
        if (bankaIdElement) bankaIdElement.value = '';
    }
    
    // Conditionally require fields based on firm type
    const firma = findFirmaById(firmaId);
    const isGrup = firma?.turu === 'grup';
    const subeAdiElement = document.getElementById('subeAdi');
    const subeIlElement = document.getElementById('subeIl');
    
    if (subeAdiElement) {
        subeAdiElement.required = isGrup;
        const label = document.querySelector('label[for="subeAdi"]');
        if (label) {
            label.textContent = isGrup ? 'Şube Adı' : 'Şube Adı (Opsiyonel)';
        }
    }
    
    if (subeIlElement) {
        subeIlElement.required = isGrup;
        const label = document.querySelector('label[for="subeIl"]');
        if (label) {
            label.textContent = isGrup ? 'İl' : 'İl (Opsiyonel)';
        }
    }
    
    if (bankaModal) bankaModal.show();
};

/**
 * Hide modals
 */
export const hideModals = () => {
    if (firmaModal && typeof firmaModal.hide === 'function') firmaModal.hide();
    if (bankaModal && typeof bankaModal.hide === 'function') bankaModal.hide();
};

/**
 * Get current instruction type
 */
export const getCurrentInstructionType = () => {
    return currentInstructionType;
};

/**
 * Refresh UI after data changes
 */
export const refreshUI = () => {
    renderFirmaAccordion();
    populateFormDropdowns();
};

/**
 * Add a new payment field for cari payments
 */
const addNewPaymentField = () => {
    console.log('=== addNewPaymentField called ===');
    const container = document.getElementById('cokluOdemeAlanlari');
    if (!container) {
        console.error('Container not found!');
        return;
    }
    
    console.log('Adding new payment field, current payment count:', container.querySelectorAll('.payment-container').length);
    console.log('Container before adding:', container);
    console.log('Container children before adding:', container.children);
    
    // Get the current instruction type to determine the filter for recipient companies
    const currentType = getCurrentInstructionType();
    const instructionConfig = instructionTypes[currentType];
    let aliciFilterType = 'all';
    
    if (instructionConfig) {
        if (instructionConfig.subType === 'Satıcı Ödemesi') {
            aliciFilterType = 'satıcı';
        } else if (instructionConfig.subType === 'Müşteri Ödemesi') {
            aliciFilterType = 'müşteri';
        }
    }
    
    // Create a unique ID for this payment field
    const paymentId = Date.now() + Math.floor(Math.random() * 1000000); // Add randomness to ensure uniqueness
    console.log('Generated payment ID:', paymentId);
    
    // Create the HTML for the new payment field
    const paymentFieldHTML = `
        <div class="payment-container card border-info mb-3" data-payment-id="${paymentId}">
            <div class="card-header bg-info bg-opacity-10 d-flex justify-content-between align-items-center">
                <h6 class="mb-0 text-info">
                    <i class="fas fa-money-bill-wave"></i><span class="payment-number-text"> Ödeme #${container.querySelectorAll('.payment-container').length + 2}</span>
                    <button type="button" class="btn btn-sm btn-outline-danger silOdemeBtn">
                        <i class="fas fa-trash"></i> Sil
                    </button>
                </h6>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label for="aliciFirma_${paymentId}" class="form-label">Alıcı Firma <span class="text-danger">*</span></label>
                        <select class="form-select aliciFirmaDynamic" id="aliciFirma_${paymentId}" data-filter-type="${aliciFilterType}" required>
                            <option value="">Firma Seçiniz</option>
                        </select>
                        <div class="form-text">
                            ${aliciFilterType === 'satıcı' ? 'Sadece Satıcı firmaları gösterilir' : 
                              aliciFilterType === 'müşteri' ? 'Sadece Müşteri firmaları gösterilir' : 
                              'Tüm firmalar gösterilir'}
                        </div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label for="aliciBanka_${paymentId}" class="form-label">Alıcı Hesap <span class="text-danger">*</span></label>
                        <select class="form-select aliciBankaDynamic" id="aliciBanka_${paymentId}" required>
                            <option value="">Önce Firma Seçiniz</option>
                        </select>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label for="tutar_${paymentId}" class="form-label">Tutar <span class="text-danger">*</span></label>
                        <div class="input-group">
                            <input type="number" class="form-control" id="tutar_${paymentId}" step="0.01" min="0.01" placeholder="0.00" required>
                            <span class="input-group-text" id="paraBirimiGosterge_${paymentId}">TRY</span>
                        </div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label for="aciklama_${paymentId}" class="form-label">Açıklama</label>
                        <input type="text" class="form-control aciklamaDynamic" id="aciklama_${paymentId}" placeholder="İşlem açıklaması (opsiyonel)">
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-12 mb-3">
                        <div class="alert alert-info d-none" id="paraBirimiUyari_${paymentId}">
                            <small><i class="fas fa-info-circle"></i> Para birimlerinin uyuşması gerekir</small>
                        </div>
                    </div>
                </div>
                <div class="mb-3">
                    <button type="button" class="btn btn-info yeniOdemeEkleBtnDynamic">
                        <i class="fas fa-plus"></i> Yeni Ödeme Ekle
                    </button>
                </div>
                <div id="aliciBankaDetay_${paymentId}"></div>
            </div>
        </div>
    `;
    
    // Add the new payment field to the container
    container.insertAdjacentHTML('beforeend', paymentFieldHTML);
    
    // Debug logging
    console.log('Added new payment field with ID:', paymentId);
    console.log('Total payment containers after adding:', container.querySelectorAll('.payment-container').length);
    console.log('All payment containers after adding:', container.querySelectorAll('.payment-container'));
    
    // Verify that the dynamic button was added correctly
    const newPaymentContainer = container.querySelector(`[data-payment-id="${paymentId}"]`);
    if (newPaymentContainer) {
        const dynamicButton = newPaymentContainer.querySelector('.yeniOdemeEkleBtnDynamic');
        console.log('Dynamic button in new container:', dynamicButton);
        if (dynamicButton) {
            console.log('Dynamic button class list:', dynamicButton.classList);
        }
    }
    
    // Update payment numbers
    updatePaymentNumbers();
    
    // Hide the original "Yeni Ödeme Ekle" button after adding the first payment
    const originalButton = document.getElementById('yeniOdemeEkleBtn');
    if (originalButton && container.querySelectorAll('.payment-container').length > 0) {
        originalButton.style.display = 'none';
        console.log('Hiding original "Yeni Ödeme Ekle" button');
    }
    
    // Log the container state after all operations
    console.log('Container state after adding payment:');
    console.log('Container children count:', container.children.length);
    console.log('Payment containers count:', container.querySelectorAll('.payment-container').length);
    
    // Populate the recipient company dropdown with filtered companies
    const firmaSelect = document.getElementById(`aliciFirma_${paymentId}`);
    if (firmaSelect) {
        const firmalar = getFirmalar();
        let filteredFirmalar = firmalar;
        
        if (aliciFilterType === 'satıcı') {
            filteredFirmalar = firmalar.filter(firma => firma.turu === 'satıcı');
        } else if (aliciFilterType === 'müşteri') {
            filteredFirmalar = firmalar.filter(firma => firma.turu === 'müşteri');
        }
        
        filteredFirmalar.forEach(firma => {
            const option = new Option(firma.name, firma.id);
            firmaSelect.add(option);
        });
        
        if (window.Choices) {
            choicesInstances[`aliciFirma_${paymentId}`] = new Choices(firmaSelect, {
                searchEnabled: true,
                searchFloor: 3,
                itemSelectText: 'Seçmek için tıklayın',
                noResultsText: 'Sonuç bulunamadı',
                noChoicesText: 'Seçenek bulunmuyor'
            });
        }
    }
    
    // Add event listener for the recipient company dropdown to populate bank accounts
    if (firmaSelect) {
        firmaSelect.addEventListener('change', (e) => {
            const bankaSelect = document.getElementById(`aliciBanka_${paymentId}`);
            if (bankaSelect) {
                populateBankaSelect(e.target.value, bankaSelect);
            }
        });
    }
    
    // Add event listener for the bank account dropdown to show bank details
    const bankaSelect = document.getElementById(`aliciBanka_${paymentId}`);
    if (bankaSelect) {
        bankaSelect.addEventListener('change', (e) => {
            const firmaId = document.getElementById(`aliciFirma_${paymentId}`).value;
            const detayElement = document.getElementById(`aliciBankaDetay_${paymentId}`);
            if (detayElement) {
                showBankaDetay(firmaId, e.target.value, detayElement);
            }
            
            // Update currency control for this payment
            updateParaBirimiKontrolDynamic(paymentId);
        });
    }
    
    // Add event listener for the recipient company dropdown to update currency control
    if (firmaSelect) {
        firmaSelect.addEventListener('change', () => {
            updateParaBirimiKontrolDynamic(paymentId);
        });
    }
    
    // Add event listener for the amount input to update currency control
    const tutarInput = document.getElementById(`tutar_${paymentId}`);
    if (tutarInput) {
        tutarInput.addEventListener('input', () => {
            updateParaBirimiKontrolDynamic(paymentId);
        });
    }
    
    // Add a specific event listener for the dynamic "Yeni Ödeme Ekle" button
    const dynamicButton = document.querySelector(`[data-payment-id="${paymentId}"] .yeniOdemeEkleBtnDynamic`);
    if (dynamicButton) {
        console.log('Adding specific event listener for dynamic button:', dynamicButton);
        // Check if we've already added an event listener to this button
        if (!dynamicButton.hasAttribute('data-listener-added')) {
            dynamicButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Dynamic button clicked (specific listener):', e.target);
                addNewPaymentField();
            });
            // Mark that we've added a listener to this button
            dynamicButton.setAttribute('data-listener-added', 'true');
        } else {
            console.log('Event listener already added to this button');
        }
    }
    
    console.log('New payment field added successfully');
};

/**
 * Update currency control display for dynamic payment fields
 */
const updateParaBirimiKontrolDynamic = (paymentId) => {
    const gondericiFirmaSelect = document.getElementById('gondericiFirma');
    const gondericiBankaSelect = document.getElementById('gondericiBanka');
    const aliciFirmaSelect = document.getElementById(`aliciFirma_${paymentId}`);
    const aliciBankaSelect = document.getElementById(`aliciBanka_${paymentId}`);
    const paraBirimiGosterge = document.getElementById(`paraBirimiGosterge_${paymentId}`);
    const paraBirimiUyari = document.getElementById(`paraBirimiUyari_${paymentId}`);
    
    if (!gondericiFirmaSelect || !gondericiBankaSelect || !aliciFirmaSelect || !aliciBankaSelect) {
        return;
    }
    
    const gondericiBanks = getBanksForFirma(gondericiFirmaSelect.value);
    const gondericiBanka = gondericiBanks.find(b => b.id == gondericiBankaSelect.value);
    const aliciBanks = getBanksForFirma(aliciFirmaSelect.value);
    const aliciBanka = aliciBanks.find(b => b.id == aliciBankaSelect.value);
    
    // Update currency indicator for this payment
    if (gondericiBanka && paraBirimiGosterge) {
        paraBirimiGosterge.textContent = gondericiBanka.para_birimi;
    }
    
    // Update currency warning for this payment
    if (gondericiBanka && aliciBanka && paraBirimiUyari) {
        const isCompatible = checkCurrencyCompatibility(gondericiBanka, aliciBanka);
        
        if (isCompatible) {
            paraBirimiUyari.className = 'alert alert-success';
            paraBirimiUyari.innerHTML = `
                <small><i class="fas fa-check-circle"></i> 
                Para birimleri uyuşuyor: ${gondericiBanka.para_birimi}
                </small>
            `;
        } else {
            paraBirimiUyari.className = 'alert alert-danger';
            paraBirimiUyari.innerHTML = `
                <small><i class="fas fa-exclamation-triangle"></i> 
                Para birimi uyuşmazlığı! Gönderici: ${gondericiBanka.para_birimi}, Alıcı: ${aliciBanka.para_birimi}
                </small>
            `;
        }
        
        paraBirimiUyari.classList.remove('d-none');
    }
};

/**
 * Update payment numbers after adding or removing payments
 */
const updatePaymentNumbers = () => {
    const container = document.getElementById('cokluOdemeAlanlari');
    if (!container) return;
    
    const paymentContainers = container.querySelectorAll('.payment-container');
    console.log('Updating payment numbers, total containers:', paymentContainers.length);
    
    // Update the numbering for dynamically added payments (starting from #2 since #1 is the initial form)
    paymentContainers.forEach((container, index) => {
        const headerText = container.querySelector('.card-header h6 .payment-number-text');
        if (headerText) {
            headerText.textContent = ` Ödeme #${index + 2}`; // Start from #2
            console.log(`Updated payment #${index + 2} text`);
        } else {
            // If the span doesn't exist, create it
            const header = container.querySelector('.card-header h6');
            if (header) {
                // Extract the existing text and button
                const icon = header.querySelector('i');
                const button = header.querySelector('button');
                
                // Clear the header
                header.innerHTML = '';
                
                // Re-add the icon, new span for text, and button
                if (icon) header.appendChild(icon);
                const textSpan = document.createElement('span');
                textSpan.className = 'payment-number-text';
                textSpan.textContent = ` Ödeme #${index + 2}`; // Start from #2
                header.appendChild(textSpan);
                if (button) header.appendChild(button);
                
                console.log(`Created payment #${index + 2} text`);
            }
        }
    });
    
    // Also update the "Yeni Ödeme Ekle" button text in each container
    const dynamicButtons = container.querySelectorAll('.yeniOdemeEkleBtnDynamic');
    console.log('Found', dynamicButtons.length, 'dynamic buttons to update');
    dynamicButtons.forEach((button, index) => {
        console.log('Updating dynamic button', index);
        // The button text is already correct, but we can add additional logic here if needed
    });
};
