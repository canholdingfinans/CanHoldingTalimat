/**
 * Main Application Entry Point
 * Coordinates all modules and initializes the application
 */

import { fetchFirmalar, addFirma, updateFirma, deleteFirma, findFirmaById, addFirmaBulk } from './modules/firmalar.js';
import { addBanka, updateBanka, deleteBanka } from './modules/bankalar.js';
import { createHavaleEFTInstruction, createCariInstruction, createVergiInstruction as createVergiInstructionModule, formatInstructionNumber, formatCurrency, formatDate, printInstruction, instructionTypes } from './modules/talimatlar.js';
import { validateIBAN, validateCompanyTypeRequirements, validateHavaleEFTForm, validateCurrencyMatch } from './modules/validasyon.js';
import { initializeUI, renderFirmaAccordion, showNotification, showFirmaModal, showBankaModal, hideModals, refreshUI, getCurrentInstructionType } from './modules/ui-etkilesimleri.js';
import { talimatOperations } from './modules/supabase-entegrasyonu.js';

/**
 * Generate multi-payment Havale/EFT instruction output with horizontal table layout
 */
const generateMultiPaymentHavaleEFTTalimatCikti = (gondericiFirma, gondericiBanka, payments, talimatNo, talimatTarihi) => {
    const talimatCikti = document.getElementById('talimatCikti');
    if (!talimatCikti) return;
    
    // Debug: Log the input parameters
    console.log('Generating multi-payment output with parameters:');
    console.log('Gonderici Firma:', gondericiFirma);
    console.log('Gonderici Banka:', gondericiBanka);
    console.log('Payments count:', payments.length);
    console.log('Payments data:', payments);
    console.log('Talimat No:', talimatNo);
    console.log('Talimat Tarihi:', talimatTarihi);
    
    const formattedDate = formatDate(talimatTarihi);
    const displayTalimatNo = formatInstructionNumber(talimatNo);
    
    // Auto-adjust layout based on payment count for optimal single-page fit
    const paymentCount = payments.length;
    let tableClass = 'multi-payment-table';
    let containerClass = 'multi-payment';
    
    // Add density class based on payment count for print optimization
    if (paymentCount === 8) {
        containerClass += ' eight-payment-special';
    } else if (paymentCount > 10) {
        containerClass += ' ultra-dense';
    } else if (paymentCount >= 7) {  // Changed from > 6 to >= 7 for better 7-8 payment handling
        containerClass += ' dense';
    }
    
    // For very large payments, add warning
    const singlePageOptimized = paymentCount <= 12;
    
    // Calculate totals by currency
    const totals = {};
    payments.forEach(payment => {
        const currency = payment.aliciBanka?.para_birimi || gondericiBanka.para_birimi || 'TRY';
        if (!totals[currency]) totals[currency] = 0;
        totals[currency] += parseFloat(payment.tutar);
    });
    
    // Format totals display - vertically for multiple currencies, horizontally for single currency
    let formattedTotals;
    const currencyCount = Object.keys(totals).length;
    if (currencyCount > 1) {
        // Multiple currencies - display vertically
        formattedTotals = Object.entries(totals)
            .map(([currency, amount]) => formatCurrency(amount, currency))
            .join('<br>');
    } else {
        // Single currency - display horizontally (existing behavior)
        formattedTotals = Object.entries(totals)
            .map(([currency, amount]) => formatCurrency(amount, currency))
            .join(' + ');
    }
    
    // Generate payment rows with optimized text handling
    const paymentRows = payments.map((payment, index) => {
        const formattedAmount = formatCurrency(payment.tutar, payment.aliciBanka?.para_birimi || gondericiBanka.para_birimi);
        const swiftCode = payment.aliciBanka?.swift_kodu || '-';
        const description = payment.aciklama || '-';
        
        // Ultra-aggressive text truncation for 8+ payments
        let companyNameLimit, bankNameLimit, descriptionLimit;
        
        if (paymentCount === 8) {
            // Ultra-dense: extremely short text for exactly 8 payments
            companyNameLimit = 6;  // Even shorter for 8 payments
            bankNameLimit = 4;     // Even shorter for 8 payments
            descriptionLimit = 5;  // Even shorter for 8 payments
        } else if (paymentCount >= 8) {
            // Ultra-dense: extremely short text for 8+ payments
            companyNameLimit = 8;  // Reduced from 10
            bankNameLimit = 5;     // Reduced from 6
            descriptionLimit = 6;  // Reduced from 8
        } else if (paymentCount >= 6) {
            // Dense: short text for 6-7 payments
            companyNameLimit = 10;  // Reduced from 12
            bankNameLimit = 6;     // Reduced from 8
            descriptionLimit = 10; // Reduced from 12
        } else {
            // Normal: moderate text for 1-5 payments
            companyNameLimit = 15;  // Reduced from 18
            bankNameLimit = 8;     // Reduced from 10
            descriptionLimit = 15;  // Reduced from 18
        }
        
        const companyName = payment.aliciFirma?.name || 'N/A';
        const bankName = payment.aliciBanka?.banka_adi || 'N/A';
        
        // Modified company name truncation - only truncate legal entity suffixes
        const shortCompanyName = shortCompanyNameWithLegalEntities(companyName, companyNameLimit);
        // Modified bank name display - show full names
        const shortBankName = bankName; // No truncation for bank names
        const shortDescription = description.length > descriptionLimit ? 
            description.substring(0, descriptionLimit - 3) + '...' : description;
        
        return `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td class="company-name" title="${companyName}">${shortCompanyName}</td>
                <td class="bank-name" title="${bankName}">${shortBankName}</td>
                <td class="iban-cell"><small>${payment.aliciBanka?.iban || 'N/A'}</small></td>
                <td class="swift-cell"><small>${swiftCode}</small></td>
                <td class="description-cell" title="${description}">${shortDescription}</td>
                <td class="amount-cell"><strong>${formattedAmount}</strong></td>
            </tr>
        `;
    }).join('');

    talimatCikti.innerHTML = `
        <div class="talimat-container ${containerClass}">
            <div class="talimat-header">
                <div class="talimat-letterhead">
                    <div class="firma-logo">${gondericiFirma.name}</div>
                </div>
                <div class="talimat-tarih-no">
                    <div><strong>Tarih:</strong> ${formattedDate}</div>
                    <div><strong>Talimat No:</strong> ${displayTalimatNo}</div>
                </div>
            </div>
            
            <div class="talimat-addressee">
                <h5><strong>${gondericiBanka.banka_adi} ${gondericiBanka.sube_adi} ŞUBE MÜDÜRLÜĞÜ'NE</strong></h5>
                <h6><strong><u>${gondericiBanka.sube_il?.toUpperCase() || 'İSTANBUL'}</u></strong></h6>
            </div>
            
            <h3 class="talimat-title text-center my-3">
                <strong>TOPLU ÖDEME TALİMATI</strong>
            </h3>
            
            <div class="talimat-body">
                <p class="talimat-metin">
                    ${gondericiBanka.banka_adi} ${gondericiBanka.sube_adi} Şubesi nezdindeki 
                    <strong>${gondericiBanka.iban}</strong> numaralı <strong>${gondericiBanka.para_birimi}</strong> 
                    hesabımızdan, aşağıda bilgileri yer alan alıcılara belirtilen tutarların 
                    <strong>Havale/EFT</strong> ile gönderilmesini rica ederiz.
                </p>
                <div class="payment-summary">
                    <strong>Toplam Ödeme Sayısı:</strong> ${payments.length} adet • 
                    <strong>Toplam Tutar:</strong> ${formattedTotals}
                </div>
            </div>
            
            <div class="multi-payment-table-container mt-3">
                <table class="table table-bordered ${tableClass}">
                    <thead class="table-primary">
                        <tr>
                            <th class="text-center" style="width: 3%;">#</th>
                            <th style="width: 20%;">UNVAN</th>
                            <th style="width: 10%;">BANKA</th>
                            <th style="width: 32%;">IBAN</th>
                            <th style="width: 8%;">SWIFT</th>
                            <th style="width: 17%;">AÇIKLAMA</th>
                            <th style="width: 10%;">TUTAR</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paymentRows}
                    </tbody>
                    <tfoot class="table-warning">
                        <tr>
                            <td colspan="6" class="text-end"><strong>TOPLAM:</strong></td>
                            <td class="amount-cell"><strong>${formattedTotals}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <div class="talimat-footer mt-3">
                <div class="saygilar-bolumu">
                    <p><strong>Saygılarımızla,</strong></p>
                    <div class="firma-imza mt-2">
                        <div class="firma-adi">
                            <strong>${gondericiFirma.name}</strong>
                        </div>
                    </div>
                </div>
                
                <div class="kase-alani mt-3">
                    <div class="kase-kutu">
                        <div class="kase-cerceve">
                            <div class="kase-metin">
                                <small>YETKİLİ İMZA</small><br>
                                <small>(Kaşe)</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Print optimization info -->
            <div class="print-info no-print mt-3" style="font-size: 12px; color: #6c757d; border-top: 1px solid #dee2e6; padding-top: 10px;">
                <div class="row">
                    <div class="col-md-6">
                        <strong>Print Optimization:</strong> ${paymentCount} ödeme • 
                        Density: ${paymentCount > 10 ? 'Ultra-Dense' : paymentCount > 6 ? 'Dense' : 'Normal'}
                    </div>
                    <div class="col-md-6 text-end">
                        <span class="badge ${singlePageOptimized ? 'bg-success' : 'bg-warning'}">
                            ${singlePageOptimized ? '✅ Single Page Optimized' : '⚠️ May Need Multiple Pages'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Debug: Log that the output was generated
    console.log('Multi-payment output generated successfully with', paymentCount, 'payments');
};

// Expose the multi-payment function globally for testing
window.generateMultiPaymentHavaleEFTTalimatCikti = generateMultiPaymentHavaleEFTTalimatCikti;

/**
 * Application initialization
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('=== HAVALE_EFT_TALIMATI Application Starting ===');
        console.log('Current URL:', window.location.href);
        
        // Check if required elements exist
        const requiredElements = [
            'firmaAccordion',
            'dynamicFormFields', 
            'selectedInstructionDisplay',
            'firmaSearch',
            'firmaTypeFilter'
        ];
        
        requiredElements.forEach(id => {
            const element = document.getElementById(id);
            console.log(`Element ${id}:`, element ? 'Found' : 'NOT FOUND');
        });
        
        // Initialize UI components
        console.log('Initializing UI...');
        initializeUI();
        
        // Fetch initial data
        console.log('Loading initial data...');
        await loadInitialData();
        
        // Setup application event listeners
        console.log('Setting up application events...');
        setupApplicationEvents();
        
        console.log('=== Application initialized successfully! ===');
    } catch (error) {
        console.error('=== Application initialization FAILED ===', error);
        showNotification('Uygulama başlatılırken bir hata oluştu: ' + error.message, 'error');
    }
});

/**
 * Load initial data
 */
const loadInitialData = async () => {
    try {
        console.log('Loading firms from database...');
        await fetchFirmalar();
        console.log('Firms loaded, rendering UI...');
        refreshUI();
        console.log('Initial data loaded successfully');
    } catch (error) {
        console.error('Failed to load initial data:', error);
        throw new Error('Başlangıç verileri yüklenemedi: ' + error.message);
    }
};

/**
 * Setup application-wide event listeners
 */
const setupApplicationEvents = () => {
    // Firm search/filter events
    window.addEventListener('firmaSearchChanged', handleFirmaSearchChanged);
    
    // Form submission events
    window.addEventListener('firmaFormSubmit', handleFirmaFormSubmit);
    window.addEventListener('bankaFormSubmit', handleBankaFormSubmit);
    
    // Accordion click events
    window.addEventListener('accordionClick', handleAccordionClick);
    
    // Instruction events
    window.addEventListener('talimatOlustur', handleTalimatOlustur);
    window.addEventListener('talimatYazdir', handleTalimatYazdir);
    
    // Excel upload events
    setupExcelUploadEvents();
};

/**
 * Handle firma search/filter changes
 */
const handleFirmaSearchChanged = async (event) => {
    try {
        const { searchTerm, filterType } = event.detail;
        console.log('Search changed:', searchTerm, filterType);
        await fetchFirmalar(searchTerm, filterType);
        refreshUI();
    } catch (error) {
        console.error('Search/filter error:', error);
        showNotification('Arama sırasında bir hata oluştu', 'error');
    }
};

/**
 * Setup Excel Bulk Upload Events
 */
const setupExcelUploadEvents = () => {
    const excelFileInput = document.getElementById('excelFileInput');
    const downloadExcelTemplateBtn = document.getElementById('downloadExcelTemplateBtn');

    if (downloadExcelTemplateBtn) {
        downloadExcelTemplateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!window.XLSX) {
                showNotification('Excel eklentisi yükleniyor, lütfen biraz bekleyip tekrar deneyin.', 'error');
                return;
            }
            
            const ws_data = [
                ['Firma Adı', 'Firma Türü', 'VKN/T.C. No', 'Vergi Dairesi', 'SGK Sicil No', 'SGK Adı'],
                ['Örnek Grup Firma A.Ş.', 'grup', '1234567890', 'Marmara V.D.', '', ''],
                ['Örnek Satıcı Ltd. Şti.', 'satıcı', '1111111111', 'Boğaziçi V.D.', '1234567', 'Örnek SGK'],
                ['Örnek Müşteri A.Ş.', 'müşteri', '', '', '', '']
            ];
            const ws = window.XLSX.utils.aoa_to_sheet(ws_data);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, "Firmalar");
            window.XLSX.writeFile(wb, "Firma_Yukleme_Sablonu.xlsx");
        });
    }

    if (excelFileInput) {
        excelFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!window.XLSX) {
                showNotification('Excel eklentisi yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.', 'error');
                excelFileInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = window.XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    // Convert sheet to json array of arrays
                    const json = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (json.length < 2) {
                        throw new Error('Excel dosyasında veri bulunamadı. Lütfen ilk satırda başlıkların, ikinci satırdan itibaren verilerin olduğundan emin olun.');
                    }

                    const rows = json.slice(1);
                    const firmsArray = [];
                    let rowNum = 1;

                    for (const row of rows) {
                        rowNum++;
                        // skip completely empty rows
                        if (!row || row.length === 0 || !row[0]) continue;

                        const name = row[0]?.toString().trim();
                        let turu = row[1]?.toString().trim().toLowerCase();
                        const vknTcNo = row[2]?.toString().trim() || null;
                        const vergiDairesi = row[3]?.toString().trim() || null;
                        const sgkSicilNo = row[4]?.toString().trim() || null;
                        const sgkAdi = row[5]?.toString().trim() || null;

                        // Auto correct missing turkish chars
                        if (turu === 'satici') turu = 'satıcı';
                        if (turu === 'musteri') turu = 'müşteri';

                        firmsArray.push({ name, turu, vknTcNo, vergiDairesi, sgkSicilNo, sgkAdi });
                    }

                    if (firmsArray.length === 0) {
                        throw new Error('Eklenecek geçerli satır bulunamadı.');
                    }

                    showNotification(`${firmsArray.length} firma yükleniyor, lütfen bekleyin...`, 'info');
                    
                    await addFirmaBulk(firmsArray);
                    
                    excelFileInput.value = '';
                    refreshUI();
                    hideModals();
                    showNotification(`${firmsArray.length} firma başarıyla toplu olarak yüklendi!`);
                    
                } catch (error) {
                    console.error('Excel upload error:', error);
                    showNotification('Yükleme hatası: ' + error.message, 'error');
                    excelFileInput.value = '';
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }
};

/**
 * Handle firma form submission
 */
const handleFirmaFormSubmit = async (event) => {
    try {
        const formData = event.detail;
        const firmaId = formData.get('firmaId');
        const firmaAdi = formData.get('firmaAdi')?.trim();
        const firmaTuru = formData.get('firmaTuru');
        const firmaVknTc = formData.get('firmaVknTc')?.trim();
        const firmaVergiDairesi = formData.get('firmaVergiDairesi')?.trim();
        const firmaSGKSicilNo = formData.get('firmaSGKSicilNo')?.trim();
        const firmaSGKAdi = formData.get('firmaSGKAdi')?.trim();
        
        if (firmaId) {
            // Update existing firma
            await updateFirma(firmaId, firmaAdi, firmaTuru, firmaVknTc, firmaVergiDairesi, firmaSGKSicilNo, firmaSGKAdi);
            showNotification('Firma başarıyla güncellendi!');
        } else {
            // Add new firma
            await addFirma(firmaAdi, firmaTuru, firmaVknTc, firmaVergiDairesi, firmaSGKSicilNo, firmaSGKAdi);
            showNotification('Firma başarıyla eklendi!');
        }
        
        refreshUI();
        hideModals();
        
    } catch (error) {
        console.error('Firma form submission error:', error);
        showNotification(error.message, 'error');
    }
};

/**
 * Handle banka form submission
 */
const handleBankaFormSubmit = async (event) => {
    try {
        const formData = event.detail;
        const bankaId = formData.get('bankaId');
        const firmaId = formData.get('bankaFirmaId');
        
        const bankaData = {
            firm_id: firmaId,
            banka_adi: formData.get('bankaAdi')?.trim(),
            sube_adi: formData.get('subeAdi')?.trim(),
            sube_il: formData.get('subeIl')?.trim(),
            iban: formData.get('iban')?.replace(/\s+/g, ''),
            para_birimi: formData.get('paraBirimi'),
            hesap_no: formData.get('hesapNo')?.trim() || null,
            swift_kodu: formData.get('swiftKodu')?.trim() || null
        };
        
        if (bankaId) {
            // Update existing banka
            await updateBanka(bankaId, bankaData);
            showNotification('Banka hesabı başarıyla güncellendi!');
        } else {
            // Add new banka
            await addBanka(bankaData);
            showNotification('Banka hesabı başarıyla eklendi!');
        }
        
        refreshUI();
        hideModals();
        
    } catch (error) {
        console.error('Banka form submission error:', error);
        showNotification(error.message, 'error');
    }
};

/**
 * Handle accordion button clicks
 */
const handleAccordionClick = async (event) => {
    try {
        const target = event.detail.target;
        const firmaId = target.dataset.firmaId;
        const bankaId = target.dataset.bankaId;
        
        if (target.classList.contains('add-banka')) {
            showBankaModal(firmaId);
            
        } else if (target.classList.contains('edit-firma')) {
            const firma = findFirmaById(firmaId);
            showFirmaModal(firma);
            
        } else if (target.classList.contains('delete-firma')) {
            if (confirm('Bu firmayı ve tüm hesaplarını silmek istediğinizden emin misiniz?')) {
                await deleteFirma(firmaId);
                renderFirmaAccordion();
                showNotification('Firma başarıyla silindi!');
            }
            
        } else if (target.classList.contains('edit-banka')) {
            const firma = findFirmaById(firmaId);
            const banka = firma.bankalar.find(b => b.id == bankaId);
            showBankaModal(firmaId, banka);
            
        } else if (target.classList.contains('delete-banka')) {
            if (confirm('Bu banka hesabını silmek istediğinizden emin misiniz?')) {
                await deleteBanka(bankaId, firmaId);
                renderFirmaAccordion();
                showNotification('Banka hesabı başarıyla silindi!');
            }
        }
        
    } catch (error) {
        console.error('Accordion click error:', error);
        showNotification(error.message, 'error');
    }
};

/**
 * Handle talimat creation
 */
const handleTalimatOlustur = async (event) => {
    try {
        const { type } = event.detail;
        
        if (type.startsWith('havale')) {
            await createHavaleInstructionFromForm();
        } else if (type.startsWith('vergi')) {
            await createVergiInstructionFromForm();
        } else if (type.startsWith('sgk')) {
            await createSGKInstructionFromForm();
        } else if (type.startsWith('gumruk')) {
            await createGumrukInstructionFromForm();
        } else if (type.startsWith('cari')) {
            await createCariInstructionFromForm();
        } else {
            throw new Error('Desteklenmeyen talimat türü');
        }
        
    } catch (error) {
        console.error('Talimat creation error:', error);
        showNotification(error.message, 'error');
    }
};

/**
 * Create havale instruction from form data
 */
const createHavaleInstructionFromForm = async () => {
    // DEBUG: Check form values for SWIFT debugging
    console.log('=== FORM VALUES DEBUG ===');
    console.log('Gönderici Firma ID:', document.getElementById('gondericiFirma')?.value);
    console.log('Gönderici Banka ID:', document.getElementById('gondericiBanka')?.value);
    console.log('Alıcı Firma ID:', document.getElementById('aliciFirma')?.value);
    console.log('Alıcı Banka ID:', document.getElementById('aliciBanka')?.value);
    console.log('=========================');
    
    const formData = {
        gondericiFirma: document.getElementById('gondericiFirma')?.value,
        gondericiBanka: document.getElementById('gondericiBanka')?.value,
        aliciFirma: document.getElementById('aliciFirma')?.value,
        aliciBanka: document.getElementById('aliciBanka')?.value,
        tutar: document.getElementById('tutar')?.value,
        aciklama: document.getElementById('aciklama')?.value,
        talimatTarihi: document.getElementById('talimatTarihi')?.value
    };
    
    // Get company objects for validation
    const gondericiFirmaObj = findFirmaById(formData.gondericiFirma);
    const aliciFirmaObj = findFirmaById(formData.aliciFirma);
    
    // Determine instruction type for validation
    const currentType = getCurrentInstructionType();
    const instructionConfig = instructionTypes[currentType];
    const instructionTypeName = instructionConfig ? instructionConfig.subType : 'Havale/EFT';
    
    // Validate company type requirements
    const companyTypeValidation = validateCompanyTypeRequirements(
        gondericiFirmaObj, 
        aliciFirmaObj, 
        instructionTypeName
    );
    
    if (!companyTypeValidation.isValid) {
        showNotification(companyTypeValidation.message, 'error');
        return;
    }
    
    const result = await createHavaleEFTInstruction(formData);
    
    showNotification('Talimat başarıyla oluşturuldu ve kaydedildi!');
    
    // Generate and display instruction output
    generateHavaleEFTTalimatCikti(
        result.gondericiFirma,
        result.gondericiBanka,
        result.aliciFirma,
        result.aliciBanka,
        formData.tutar,
        formData.aciklama,
        result.instruction.instruction_number,
        formData.talimatTarihi
    );
};

/**
 * Create vergi instruction from form data
 */
const createVergiInstructionFromForm = async () => {
    const formData = {
        gondericiFirma: document.getElementById('vergiGondericiFirma')?.value,
        gondericiBanka: document.getElementById('vergiGondericiBanka')?.value,
        tutar: document.getElementById('vergiTutar')?.value,
        aciklama: document.getElementById('vergiAciklama')?.value,
        talimatTarihi: document.getElementById('vergiTalimatTarihi')?.value,
        tahakkukNo: document.getElementById('tahakkukNo')?.value,
        vergiDonem: document.getElementById('vergiDonem')?.value
    };
    
    // Get company objects for validation
    const gondericiFirmaObj = findFirmaById(formData.gondericiFirma);
    
    // Validate company type requirements - sender must be 'grup' for Vergi payments
    const companyTypeValidation = validateCompanyTypeRequirements(
        gondericiFirmaObj, 
        null, // No receiver for Vergi payments
        'Vergi Ödemesi' // Instruction type
    );
    
    if (!companyTypeValidation.isValid) {
        showNotification(companyTypeValidation.message, 'error');
        return;
    }
    
    const result = await createVergiInstructionModule(formData);
    
    showNotification('Vergi talimatı başarıyla oluşturuldu ve kaydedildi!');
    
    // Generate and display instruction output
    generateVergiTalimatCikti(
        result.gondericiFirma,
        result.gondericiBanka,
        formData.tutar,
        formData.aciklama,
        result.instruction.instruction_number,
        formData.tahakkukNo,
        formData.vergiDonem,
        formData.talimatTarihi
    );
};

/**
 * Create SGK instruction from form data
 */
const createSGKInstructionFromForm = async () => {
    const formData = {
        gondericiFirma: document.getElementById('sgkGondericiFirma')?.value,
        gondericiBanka: document.getElementById('sgkGondericiBanka')?.value,
        tutar: document.getElementById('sgkTutar')?.value,
        aciklama: document.getElementById('sgkAciklama')?.value,
        talimatTarihi: document.getElementById('sgkTalimatTarihi')?.value,
        tahakkukNo: document.getElementById('sgkSicilNo')?.value,
        sgkDonem: document.getElementById('sgkDonem')?.value
    };
    
    // Get company objects for validation
    const gondericiFirmaObj = findFirmaById(formData.gondericiFirma);
    
    // Validate company type requirements - sender must be 'grup' for SGK payments
    const companyTypeValidation = validateCompanyTypeRequirements(
        gondericiFirmaObj, 
        null, // No receiver for SGK payments
        'SGK Ödemesi' // Instruction type
    );
    
    if (!companyTypeValidation.isValid) {
        showNotification(companyTypeValidation.message, 'error');
        return;
    }
    
    // For now, we'll use the same function as vergi since the data structure is similar
    const result = await createVergiInstructionModule(formData);
    
    showNotification('SGK talimatı başarıyla oluşturuldu ve kaydedildi!');
    
    // Generate and display instruction output
    generateVergiTalimatCikti(
        result.gondericiFirma,
        result.gondericiBanka,
        formData.tutar,
        formData.aciklama,
        result.instruction.instruction_number,
        formData.tahakkukNo,
        formData.sgkDonem,
        formData.talimatTarihi
    );
};

/**
 * Create Gümrük instruction from form data
 */
const createGumrukInstructionFromForm = async () => {
    const formData = {
        gondericiFirma: document.getElementById('gumrukGondericiFirma')?.value,
        gondericiBanka: document.getElementById('gumrukGondericiBanka')?.value,
        tutar: document.getElementById('gumrukTutar')?.value,
        aciklama: document.getElementById('gumrukAciklama')?.value,
        talimatTarihi: document.getElementById('gumrukTalimatTarihi')?.value,
        gumrukBeyannameNo: document.getElementById('gumrukBeyannameNo')?.value,
        gtipKodu: document.getElementById('gtipKodu')?.value,
        otvOrani: document.getElementById('otvOrani')?.value,
        harcTuru: document.getElementById('harcTuru')?.value
    };
    
    // Get company objects for validation
    const gondericiFirmaObj = findFirmaById(formData.gondericiFirma);
    
    // Validate company type requirements - sender must be 'grup' for Gümrük payments
    const companyTypeValidation = validateCompanyTypeRequirements(
        gondericiFirmaObj, 
        null, // No receiver for Gümrük payments
        'Gümrük Ödemesi' // Instruction type
    );
    
    if (!companyTypeValidation.isValid) {
        showNotification(companyTypeValidation.message, 'error');
        return;
    }
    
    // For now, we'll use the same function as vergi since the data structure is similar
    const result = await createVergiInstructionModule(formData);
    
    showNotification('Gümrük talimatı başarıyla oluşturuldu ve kaydedildi!');
    
    // Generate and display instruction output
    generateVergiTalimatCikti(
        result.gondericiFirma,
        result.gondericiBanka,
        formData.tutar,
        formData.aciklama,
        result.instruction.instruction_number,
        formData.gumrukBeyannameNo,
        formData.gtipKodu || formData.otvOrani || formData.harcTuru || '',
        formData.talimatTarihi
    );
};

/**
 * Create cari instruction from form data
 */
const createCariInstructionFromForm = async () => {
    // Get sender information (common for all payments)
    const gondericiFirmaId = document.getElementById('gondericiFirma')?.value;
    const gondericiBankaId = document.getElementById('gondericiBanka')?.value;
    const talimatTarihi = document.getElementById('talimatTarihi')?.value;
    
    // Validate sender information
    if (!gondericiFirmaId || !gondericiBankaId || !talimatTarihi) {
        showNotification('Gönderici bilgileri eksik!', 'error');
        return;
    }
    
    // Get sender company and bank objects
    const gondericiFirma = findFirmaById(gondericiFirmaId);
    const gondericiBanka = gondericiFirma?.bankalar.find(b => b.id == gondericiBankaId);
    
    if (!gondericiFirma || !gondericiBanka) {
        showNotification('Gönderici firma veya hesap bilgileri bulunamadı!', 'error');
        return;
    }
    
    // Collect all payment data - INCLUDING THE INITIAL PAYMENT FORM
    const payments = [];
    
    // 1. Collect data from the initial payment form (not in cokluOdemeAlanlari)
    const initialAliciFirmaId = document.getElementById('aliciFirma')?.value;
    const initialAliciBankaId = document.getElementById('aliciBanka')?.value;
    const initialTutar = document.getElementById('tutar')?.value;
    const initialAciklama = document.getElementById('aciklama')?.value;
    
    if (initialAliciFirmaId && initialAliciBankaId && initialTutar) {
        const initialAliciFirma = findFirmaById(initialAliciFirmaId);
        const initialAliciBanka = initialAliciFirma?.bankalar.find(b => b.id == initialAliciBankaId);
        
        if (initialAliciFirma && initialAliciBanka) {
            // Validate form data for initial payment
            const initialValidation = validateHavaleEFTForm({
                gondericiFirma: gondericiFirma.id,
                gondericiBanka: gondericiBanka.id,
                aliciFirma: initialAliciFirma.id,
                aliciBanka: initialAliciBanka.id,
                tutar: initialTutar,
                talimatTarihi: talimatTarihi
            });
            
            if (!initialValidation.isValid) {
                showNotification(`İlk ödeme: ${initialValidation.errors.join('\n')}`, 'error');
                return;
            }
            
            // Check currency compatibility for initial payment
            const initialCurrencyCheck = validateCurrencyMatch(gondericiBanka, initialAliciBanka);
            if (!initialCurrencyCheck.isValid) {
                showNotification(`İlk ödeme: ${initialCurrencyCheck.message}`, 'error');
                return;
            }
            
            payments.push({
                aliciFirma: initialAliciFirma,
                aliciBanka: initialAliciBanka,
                tutar: parseFloat(initialTutar),
                aciklama: initialAciklama || ''
            });
        }
    }
    
    // 2. Collect data from dynamically added payment forms
    const cokluOdemeContainer = document.getElementById('cokluOdemeAlanlari');
    console.log('Container element:', cokluOdemeContainer);
    console.log('Container innerHTML:', cokluOdemeContainer?.innerHTML);
    
    if (!cokluOdemeContainer) {
        console.error('Multi-payment container not found!');
        showNotification('Çoklu ödeme alanı bulunamadı!', 'error');
        return;
    }
    
    // Use a more robust method to find payment containers
    const paymentContainers = Array.from(cokluOdemeContainer.children).filter(child => {
        // Check if child has the payment-container class
        const hasClass = child.classList && child.classList.contains('payment-container');
        console.log('Child element:', child, 'Has payment-container class:', hasClass);
        return hasClass;
    });
    
    console.log('Payment containers found (robust method):', paymentContainers.length);
    console.log('Payment containers (robust method):', paymentContainers);
    
    // Debug: Check each container
    paymentContainers.forEach((container, index) => {
        console.log(`Container ${index}:`, container);
        console.log(`Container ${index} dataset:`, container.dataset);
        console.log(`Container ${index} innerHTML:`, container.innerHTML);
    });
    
    // Additional check - make sure we're not missing any containers
    const allChildren = Array.from(cokluOdemeContainer.children);
    console.log('All direct children of container:', allChildren);
    console.log('All direct children count:', allChildren.length);
    
    const paymentContainerElements = allChildren.filter(child => 
        child.classList && child.classList.contains('payment-container')
    );
    console.log('Filtered payment container elements:', paymentContainerElements);
    console.log('Filtered payment container count:', paymentContainerElements.length);
    
    // Also try querying directly for payment containers
    const directQueryContainers = cokluOdemeContainer.querySelectorAll('.payment-container');
    console.log('Direct query containers:', directQueryContainers);
    console.log('Direct query containers count:', directQueryContainers.length);
    
    // Use the direct query result if it's more complete
    const finalPaymentContainers = directQueryContainers.length >= paymentContainers.length ? 
        Array.from(directQueryContainers) : paymentContainers;
    
    console.log('Final payment containers count:', finalPaymentContainers.length);
    console.log('Final payment containers:', finalPaymentContainers);
    
    // Validate each dynamically added payment
    for (const container of finalPaymentContainers) {
        const paymentId = container.dataset.paymentId;
        console.log('Processing payment with ID:', paymentId);
        
        // Debug: Check if elements exist
        const aliciFirmaElement = document.getElementById(`aliciFirma_${paymentId}`);
        const aliciBankaElement = document.getElementById(`aliciBanka_${paymentId}`);
        const tutarElement = document.getElementById(`tutar_${paymentId}`);
        const aciklamaElement = document.getElementById(`aciklama_${paymentId}`);
        
        console.log('Form elements:', {
            aliciFirmaElement: !!aliciFirmaElement,
            aliciBankaElement: !!aliciBankaElement,
            tutarElement: !!tutarElement,
            aciklamaElement: !!aciklamaElement
        });
        
        if (aliciFirmaElement) console.log(`aliciFirma_${paymentId} value:`, aliciFirmaElement.value);
        if (aliciBankaElement) console.log(`aliciBanka_${paymentId} value:`, aliciBankaElement.value);
        if (tutarElement) console.log(`tutar_${paymentId} value:`, tutarElement.value);
        if (aciklamaElement) console.log(`aciklama_${paymentId} value:`, aciklamaElement.value);
        
        const aliciFirmaId = aliciFirmaElement?.value;
        const aliciBankaId = aliciBankaElement?.value;
        const tutar = tutarElement?.value;
        const aciklama = aciklamaElement?.value;
        
        console.log('Payment data:', { aliciFirmaId, aliciBankaId, tutar, aciklama });
        
        // Add more detailed logging
        console.log(`Container ${paymentId} innerHTML:`, container.innerHTML);
        
        if (!aliciFirmaId || !aliciBankaId || !tutar) {
            showNotification('Tüm ödeme alanları doldurulmalıdır!', 'error');
            return;
        }
        
        const aliciFirma = findFirmaById(aliciFirmaId);
        const aliciBanka = aliciFirma?.bankalar.find(b => b.id == aliciBankaId);
        
        if (!aliciFirma || !aliciBanka) {
            showNotification('Alıcı firma veya hesap bilgileri bulunamadı!', 'error');
            return;
        }
        
        // Validate form data
        const validation = validateHavaleEFTForm({
            gondericiFirma: gondericiFirma.id,
            gondericiBanka: gondericiBanka.id,
            aliciFirma: aliciFirma.id,
            aliciBanka: aliciBanka.id,
            tutar: tutar,
            talimatTarihi: talimatTarihi
        });
        
        if (!validation.isValid) {
            // Calculate the correct payment number (initial form is #1, then dynamically added forms start from #2)
            const paymentIndex = payments.length + 1; // payments.length is 0 for first dynamic payment, so +1 makes it #1 or higher
            showNotification(`Ödeme #${paymentIndex + 1}: ${validation.errors.join('\n')}`, 'error'); // +1 because initial form is #1
            return;
        }
        
        // Check currency compatibility
        const currencyCheck = validateCurrencyMatch(gondericiBanka, aliciBanka);
        if (!currencyCheck.isValid) {
            // Calculate the correct payment number (initial form is #1, then dynamically added forms start from #2)
            const paymentIndex = payments.length + 1; // payments.length is 0 for first dynamic payment, so +1 makes it #1 or higher
            showNotification(`Ödeme #${paymentIndex + 1}: ${currencyCheck.message}`, 'error'); // +1 because initial form is #1
            return;
        }
        
        payments.push({
            aliciFirma,
            aliciBanka,
            tutar: parseFloat(tutar),
            aciklama: aciklama || ''
        });
    }
    
    // Debug: Log the collected payments
    console.log('Collected payments:', payments);
    console.log('Number of payments:', payments.length);
    
    // Add more detailed logging
    console.log('Payment details:');
    payments.forEach((payment, index) => {
        console.log(`Payment ${index + 1}:`, {
            aliciFirma: payment.aliciFirma?.name || payment.aliciFirma,
            aliciBanka: payment.aliciBanka?.iban || payment.aliciBanka,
            tutar: payment.tutar,
            aciklama: payment.aciklama
        });
    });
    
    if (payments.length === 0) {
        showNotification('En az bir ödeme eklemelisiniz!', 'error');
        return;
    }
    
    // Check for duplicates (we'll skip this for multi-payments for now)
    
    // Get next instruction number
    const nextNumber = await talimatOperations.getNextInstructionNumber();
    
    // Create separate instructions for each payment (for now)
    // In a more advanced implementation, we might store all payments in a single record
    const results = [];
    console.log('Creating instructions for', payments.length, 'payments');
    
    for (const payment of payments) {
        const instructionData = {
            gonderici_firma_id: gondericiFirma.id,
            gonderici_banka_hesap_id: gondericiBanka.id,
            alici_firma_id: payment.aliciFirma.id,
            alici_banka_hesap_id: payment.aliciBanka.id,
            tutar: payment.tutar,
            para_birimi: gondericiBanka.para_birimi,
            aciklama: payment.aciklama,
            talimat_tarihi: talimatTarihi,
            talimat_turu: 'Cari Hesap Ödemesi',
            instruction_number: nextNumber + results.length
        };
        
        console.log('Creating instruction with data:', instructionData);
        
        try {
            const data = await talimatOperations.createCari(instructionData);
            results.push({
                instruction: data,
                aliciFirma: payment.aliciFirma,
                aliciBanka: payment.aliciBanka
            });
            console.log('Created instruction:', data);
        } catch (error) {
            showNotification(`Ödeme oluşturulurken hata: ${error.message}`, 'error');
            return;
        }
    }
    
    showNotification(`${payments.length} adet talimat başarıyla oluşturuldu ve kaydedildi!`);
    
    // Debug: Log the results
    console.log('Created instructions:', results);
    
    // Generate and display multi-payment instruction output
    console.log('Generating multi-payment output with:', {
        gondericiFirma: gondericiFirma.name,
        gondericiBanka: gondericiBanka.iban,
        payments: payments.length,
        nextNumber: nextNumber,
        talimatTarihi: talimatTarihi
    });
    
    generateMultiPaymentHavaleEFTTalimatCikti(
        gondericiFirma,
        gondericiBanka,
        payments,
        nextNumber,
        talimatTarihi
    );
};

/**
 * Handle talimat printing
 */
const handleTalimatYazdir = () => {
    try {
        const talimatCikti = document.getElementById('talimatCikti');
        if (!talimatCikti || talimatCikti.innerHTML.trim() === "") {
            throw new Error("Yazdırmak için önce bir talimat oluşturmalısınız.");
        }
        
        printInstruction(talimatCikti.innerHTML);
        
    } catch (error) {
        console.error('Print error:', error);
        showNotification(error.message, 'error');
    }
};

/**
 * Generate Havale/EFT instruction output (moved from original script)
 */
const generateHavaleEFTTalimatCikti = (gondericiFirma, gondericiBanka, aliciFirma, aliciBanka, tutar, aciklama, talimatNo, talimatTarihi) => {
    const talimatCikti = document.getElementById('talimatCikti');
    if (!talimatCikti) return;
    
    // DEBUG: Log bank data to trace SWIFT code issue
    console.log('=== SWIFT CODE DEBUG ===');
    console.log('Alıcı Banka Object:', aliciBanka);
    console.log('Alıcı Banka SWIFT Kodu:', aliciBanka.swift_kodu);
    console.log('Has SWIFT Code?:', !!aliciBanka.swift_kodu);
    console.log('========================');
    
    const formattedDate = formatDate(talimatTarihi);
    const formattedTutar = formatCurrency(tutar, gondericiBanka.para_birimi);
    const displayTalimatNo = formatInstructionNumber(talimatNo);

    talimatCikti.innerHTML = `
        <div class="talimat-container">
            <div class="talimat-header">
                <div class="talimat-letterhead">
                    <div class="firma-logo">${gondericiFirma.name}</div>
                </div>
                <div class="talimat-tarih-no">
                    <div><strong>Tarih:</strong> ${formattedDate}</div>
                    <div><strong>Talimat No:</strong> ${displayTalimatNo}</div>
                </div>
            </div>
            
            <div class="talimat-addressee">
                <h5><strong>${gondericiBanka.banka_adi} ${gondericiBanka.sube_adi} ŞUBE MÜDÜRLÜĞÜ'NE</strong></h5>
                <h6><strong><u>${gondericiBanka.sube_il?.toUpperCase() || 'İSTANBUL'}</u></strong></h6>
            </div>
            
            <h3 class="talimat-title text-center my-4">
                <strong>BANKA TALİMATI</strong>
            </h3>
            
            <div class="talimat-body">
                <p class="talimat-metin">
                    ${gondericiBanka.banka_adi} ${gondericiBanka.sube_adi} Şubesi nezdindeki 
                    <strong>${gondericiBanka.iban}</strong> numaralı <strong>${gondericiBanka.para_birimi}</strong> 
                    hesabımızdan, aşağıda bilgileri yer alan alıcıya belirtilen tutarın 
                    <strong>Havale/EFT</strong> ile gönderilmesini rica ederiz.
                </p>
            </div>
            
            <div class="alici-bilgileri-container mt-4">
                <table class="table table-bordered talimat-table">
                    <thead>
                        <tr class="table-primary">
                            <th colspan="2" class="text-center">
                                <h6 class="mb-0"><i class="fas fa-user-check"></i> ALICI BİLGİLERİ</h6>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <th class="table-light" style="width: 30%;">Alıcı Adı / Unvanı</th>
                            <td><strong>${aliciFirma.name}</strong></td>
                        </tr>
                        <tr>
                            <th class="table-light">Alıcı Banka Adı</th>
                            <td>${aliciBanka.banka_adi}</td>
                        </tr>
                        <tr>
                            <th class="table-light">Alıcı Şube</th>
                            <td>${aliciBanka.sube_adi} / ${aliciBanka.sube_il}</td>
                        </tr>
                        <tr>
                            <th class="table-light">Alıcı IBAN</th>
                            <td><code>${aliciBanka.iban}</code></td>
                        </tr>
                        ${aliciBanka.swift_kodu ? `
                        <tr>
                            <th class="table-light">SWIFT Kodu</th>
                            <td><strong class="text-info">${aliciBanka.swift_kodu}</strong></td>
                        </tr>
                        ` : ''}
                        <tr class="table-warning">
                            <th class="table-light">Tutar</th>
                            <td><strong class="text-success">${formattedTutar}</strong></td>
                        </tr>
                        ${aciklama ? `
                        <tr>
                            <th class="table-light">Açıklama</th>
                            <td>${aciklama}</td>
                        </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
            
            <div class="talimat-footer mt-4">
                <div class="saygılar-bolumu">
                    <p><strong>Saygılarımızla,</strong></p>
                    <div class="firma-imza mt-3">
                        <div class="firma-adi">
                            <strong>${gondericiFirma.name}</strong>
                        </div>
                    </div>
                </div>
                
                <div class="kase-alani mt-4">
                    <div class="kase-kutu">
                        <div class="kase-cerceve">
                            <div class="kase-metin">
                                <small>YETKİLİ İMZA</small><br>
                                <small>(Kaşe)</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

/**
 * Generate Vergi instruction output (moved from original script)
 */
const generateVergiTalimatCikti = (gondericiFirma, gondericiBanka, tutar, aciklama, talimatNo, tahakkukNo, vergiDonem, talimatTarihi) => {
    const talimatCikti = document.getElementById('talimatCikti');
    if (!talimatCikti) return;
    
    const formattedDate = formatDate(talimatTarihi);
    const formattedTutar = formatCurrency(tutar, gondericiBanka.para_birimi);
    const displayTalimatNo = formatInstructionNumber(talimatNo);
    const currentType = getCurrentInstructionType();
    const instructionConfig = instructionTypes[currentType];
    
    // Determine the appropriate field name and value based on instruction type
    let specialFieldName = 'Tahakkuk No';
    let specialFieldValue = tahakkukNo || '-';
    
    if (instructionConfig) {
        if (instructionConfig.category === 'sgk') {
            specialFieldName = 'SGK Sicil No';
        } else if (instructionConfig.category === 'gumruk') {
            specialFieldName = 'Gümrük Beyanname No';
        }
    }

    talimatCikti.innerHTML = `
        <div class="talimat-container">
            <div class="talimat-header">
                <div class="talimat-letterhead">
                    <div class="firma-logo">${gondericiFirma.name}</div>
                </div>
                <div class="talimat-tarih-no">
                    <div><strong>Tarih:</strong> ${formattedDate}</div>
                    <div><strong>Talimat No:</strong> ${displayTalimatNo}</div>
                </div>
            </div>
            
            <div class="talimat-addressee">
                <h5><strong>${gondericiBanka.banka_adi} ${gondericiBanka.sube_adi} ŞUBE MÜDÜRLÜĞÜ'NE</strong></h5>
                <h6><strong><u>${gondericiBanka.sube_il?.toUpperCase() || 'İSTANBUL'}</u></strong></h6>
            </div>
            
            <h3 class="talimat-title text-center my-4">
                <strong>VERGİ ÖDEMESİ TALİMATI</strong>
            </h3>
            
            <div class="talimat-body">
                <p class="talimat-metin">
                    ${gondericiBanka.banka_adi} ${gondericiBanka.sube_adi} Şubesi nezdindeki 
                    <strong>${gondericiBanka.iban}</strong> numaralı <strong>${gondericiBanka.para_birimi}</strong> 
                    hesabımızdan, aşağıda bilgileri yer alan vergi ödemesinin yapılmasını rica ederiz.
                </p>
            </div>
            
            <div class="vergi-bilgileri-container mt-4">
                <table class="table table-bordered talimat-table">
                    <thead>
                        <tr class="table-primary">
                            <th colspan="5" class="text-center">
                                <h6 class="mb-0"><i class="fas fa-receipt"></i> VERGİ BİLGİLERİ</h6>
                            </th>
                        </tr>
                        <tr class="table-secondary">
                            <th>Vergi No</th>
                            <th>Vergi Dairesi</th>
                            <th>${specialFieldName}</th>
                            <th>Tutar</th>
                            <th>Vergi Nevi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${gondericiFirma.vkn_tc_no || '-'}</td>
                            <td>${gondericiFirma.vergi_dairesi || '-'}</td>
                            <td>${specialFieldValue}</td>
                            <td><strong class="text-success">${formattedTutar}</strong></td>
                            <td>${instructionConfig ? instructionConfig.title || '-' : '-'}</td>
                        </tr>
                    </tbody>
                </table>
                
                ${aciklama ? `
                <div class="mt-3">
                    <strong>Açıklama:</strong>
                    <p>${aciklama}</p>
                </div>
                ` : ''}
                
                ${vergiDonem ? `
                <div class="mt-2">
                    <strong>Vergilendirme Dönemi:</strong>
                    <span>${vergiDonem}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="talimat-footer mt-4">
                <div class="saygılar-bolumu">
                    <p><strong>Saygılarımızla,</strong></p>
                    <div class="firma-imza mt-3">
                        <div class="firma-adi">
                            <strong>${gondericiFirma.name}</strong>
                        </div>
                    </div>
                </div>
                
                <div class="kase-alani mt-4">
                    <div class="kase-kutu">
                        <div class="kase-cerceve">
                            <div class="kase-metin">
                                <small>YETKİLİ İMZA</small><br>
                                <small>(Kaşe)</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

// Add this helper function for company name truncation
function shortCompanyNameWithLegalEntities(companyName, limit) {
    if (!companyName || companyName.length <= limit) {
        return companyName;
    }
    
    // Check if the company name ends with a legal entity suffix
    const legalEntitySuffixes = ['Ltd. Şti.', 'A.Ş.'];
    
    for (const suffix of legalEntitySuffixes) {
        if (companyName.endsWith(suffix)) {
            // If the name is still too long after keeping the suffix, truncate the beginning
            const suffixLength = suffix.length;
            if (companyName.length > limit) {
                const availableLength = limit - suffixLength - 3; // 3 for "..."
                
                if (availableLength > 0) {
                    // Keep the suffix and truncate the beginning
                    // Take the last 'availableLength' characters from the part before the suffix
                    const nameWithoutSuffix = companyName.substring(0, companyName.length - suffixLength).trim();
                    const truncatedName = nameWithoutSuffix.slice(-availableLength);
                    return '...' + truncatedName + suffix;
                } else {
                    // If we can't preserve the suffix properly, just truncate with ellipsis
                    return companyName.substring(0, limit - 3) + '...';
                }
            } else {
                return companyName;
            }
        }
    }
    
    // If no legal entity suffix, apply normal truncation
    return companyName.length > limit ? companyName.substring(0, limit - 3) + '...' : companyName;
}

/**
 * Test function to check SWIFT code display logic
 */
window.testSwiftCodeDisplay = function() {
    console.log('=== TESTING SWIFT CODE DISPLAY ===');
    
    // Create test bank data with SWIFT code
    const testAliciBanka = {
        id: 999,
        banka_adi: 'Test Bank',
        sube_adi: 'Test Branch', 
        sube_il: 'Istanbul',
        iban: 'TR123456789012345678901234',
        swift_kodu: 'TCZBTR2A'
    };
    
    console.log('Test bank data:', testAliciBanka);
    console.log('SWIFT code value:', testAliciBanka.swift_kodu);
    console.log('SWIFT code exists check:', !!testAliciBanka.swift_kodu);
    console.log('Conditional result:', testAliciBanka.swift_kodu ? 'WILL SHOW' : 'WILL NOT SHOW');
    
    // Test the template logic
    const swiftTemplate = `${testAliciBanka.swift_kodu ? `
        <tr>
            <th class="table-light">SWIFT Kodu</th>
            <td><strong class="text-info">${testAliciBanka.swift_kodu}</strong></td>
        </tr>
        ` : ''}`;
    
    console.log('Generated SWIFT template:', swiftTemplate);
    console.log('===================================');
    
    return {
        bankData: testAliciBanka,
        hasSwift: !!testAliciBanka.swift_kodu,
        template: swiftTemplate
    };
};

/**
 * Test function for multi-payment horizontal table layout
 */
window.testMultiPaymentLayout = function() {
    console.log('=== TESTING MULTI-PAYMENT LAYOUT ===');
    
    // Create test data for multi-payment instruction
    const testGondericiFirma = {
        name: 'ABC Holdings A.Ş.'
    };
    
    const testGondericiBanka = {
        banka_adi: 'Garanti Bankası',
        sube_adi: 'Levent Şubesi',
        sube_il: 'Istanbul',
        iban: 'TR640006200004024300600123',
        para_birimi: 'TRY'
    };
    
    const testPayments = [
        {
            aliciFirma: { name: 'XYZ Ltd. Şti.' },
            aliciBanka: {
                banka_adi: 'Yapı Kredi',
                iban: 'TR320010000000123456789012',
                swift_kodu: 'YAPITRIS',
                para_birimi: 'TRY'
            },
            tutar: 15750.00,
            aciklama: 'Fatura Ödemesi'
        },
        {
            aliciFirma: { name: 'DEF Ticaret A.Ş.' },
            aliciBanka: {
                banka_adi: 'Akbank',
                iban: 'TR330006100519786543210987',
                swift_kodu: 'AKBKTRIS',
                para_birimi: 'TRY'
            },
            tutar: 8250.50,
            aciklama: 'Hizmet Bedeli'
        },
        {
            aliciFirma: { name: 'GHI International Ltd.' },
            aliciBanka: {
                banka_adi: 'HSBC',
                iban: 'US64SVBKUS6S3300958879123',
                swift_kodu: 'HSBCUS33',
                para_birimi: 'USD'
            },
            tutar: 2500.00,
            aciklama: 'International Payment'
        },
        {
            aliciFirma: { name: 'JKL Teknoloji A.Ş.' },
            aliciBanka: {
                banka_adi: 'İş Bankası',
                iban: 'TR640001200000056789012345',
                swift_kodu: 'ISBKTRIS',
                para_birimi: 'TRY'
            },
            tutar: 12100.75,
            aciklama: 'Yazılım Lisansı'
        },
        {
            aliciFirma: { name: 'MNO Export GmbH' },
            aliciBanka: {
                banka_adi: 'Deutsche Bank',
                iban: 'DE89370400440532013000123',
                swift_kodu: 'DEUTDEFF',
                para_birimi: 'EUR'
            },
            tutar: 1850.25,
            aciklama: 'İthalat Ödemesi'
        }
    ];
    
    console.log('Test payments:', testPayments);
    
    // Generate the multi-payment instruction
    generateMultiPaymentHavaleEFTTalimatCikti(
        testGondericiFirma,
        testGondericiBanka,
        testPayments,
        'MP-2024-001',
        '2024-03-15'
    );
    
    console.log('Multi-payment layout generated successfully!');
    console.log('======================================');
    
    return {
        firmCount: 1,
        paymentCount: testPayments.length,
        totalTRY: testPayments.filter(p => p.aliciBanka.para_birimi === 'TRY').reduce((sum, p) => sum + p.tutar, 0),
        totalUSD: testPayments.filter(p => p.aliciBanka.para_birimi === 'USD').reduce((sum, p) => sum + p.tutar, 0),
        totalEUR: testPayments.filter(p => p.aliciBanka.para_birimi === 'EUR').reduce((sum, p) => sum + p.tutar, 0)
    };
};
