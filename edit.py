import re

with open('modules/ui-etkilesimleri.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Edit 1: add doviz case to generateDynamicFormFields
old_switch1 = '''    switch(config.category) {
        case 'havale':
        case 'cari':
            fieldsHTML = generateHavaleFields(config.subType);
            break;
        case 'vergi':
        case 'sgk':
        case 'gumruk':
            fieldsHTML = generateOtherFields(config);
            break;
    }'''

new_switch1 = '''    switch(config.category) {
        case 'havale':
        case 'cari':
            fieldsHTML = generateHavaleFields(config.subType);
            break;
        case 'vergi':
        case 'sgk':
        case 'gumruk':
            fieldsHTML = generateOtherFields(config);
            break;
        case 'doviz':
            fieldsHTML = generateDovizFields(config);
            break;
    }'''

content = content.replace(old_switch1, new_switch1)

# Edit 2: add doviz date
old_switch2 = '''        switch(config.category) {
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
        }'''

new_switch2 = '''        switch(config.category) {
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
            case 'doviz':
                dateInput = document.getElementById('talimatTarihi');
                break;
            default:
                dateInput = document.getElementById('talimatTarihi');
        }'''

content = content.replace(old_switch2, new_switch2)

# Edit 3: populate form
old_pop = '''        populateFormDropdowns();
    } else {'''

new_pop = '''        populateFormDropdowns();
        
        if (config.category === 'doviz') {
            initDovizCalculation();
            setupDovizGondericiAliciSync();
        }
    } else {'''

content = content.replace(old_pop, new_pop)

# Edit 4: Append to end
new_funcs = '''
export const DOVIZ_CINSLERI = ['USD', 'EUR', 'GBP', 'CHF'];

const generateDovizFields = (config) => {
    const isAlim = config.subType === 'Döviz Alým';
    const islemTuru = isAlim ? 'alým' : 'satým';

    const dovizOptions = DOVIZ_CINSLERI.map(doviz => <option value=""></option>).join('');

    return 
        <div class="row">
            <div class="col-md-6">
                <div class="card border-primary mb-3">
                    <div class="card-header bg-primary bg-opacity-10">
                        <h6 class="mb-0 text-primary">
                            <i class="fas fa-arrow-right"></i> Gönderici (Hesaptan Çýkacak)
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label for="gondericiFirma" class="form-label">Gönderici Firma <span class="text-danger">*</span></label>
                            <select class="form-select" id="gondericiFirma" data-filter-type="grup" required>
                                <option value="">Firma Seçiniz</option>
                            </select>
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
                <div class="card border-success mb-3">
                    <div class="card-header bg-success bg-opacity-10">
                        <h6 class="mb-0 text-success">
                            <i class="fas fa-arrow-left"></i> Alýcý (Hesaba Girecek)
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label for="aliciFirma" class="form-label">Alýcý Firma <span class="text-danger">*</span></label>
                            <select class="form-select" id="aliciFirma" data-filter-type="grup" required>
                                <option value="">Firma Seçiniz</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label for="aliciBanka" class="form-label">Alýcý Hesap <span class="text-danger">*</span></label>
                            <select class="form-select" id="aliciBanka" required>
                                <option value="">Önce Firma Seçiniz</option>
                            </select>
                        </div>
                        <div id="aliciBankaDetay"></div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card border-warning mb-3">
            <div class="card-header bg-warning bg-opacity-10">
                <h6 class="mb-0 text-warning">
                    <i class="fas fa-exchange-alt"></i> Ýþlem Detaylarý
                </h6>
            </div>
            <div class="card-body">
                <div class="row">
                    <!-- Gizli input ile iþlem yönünü tutuyoruz -->
                    <input type="hidden" id="dovizIslemiTuru" value="">
                    
                    <div class="col-md-3 mb-3">
                        <label for="dovizCinsi" class="form-label">Döviz Cinsi <span class="text-danger">*</span></label>
                        <select class="form-select" id="dovizCinsi" required>
                            <option value="">Seçiniz</option>
                            
                        </select>
                    </div>
                    <div class="col-md-3 mb-3">
                        <label for="dovizMiktari" class="form-label">Döviz Miktarý <span class="text-danger">*</span></label>
                        <input type="number" step="0.01" class="form-control" id="dovizMiktari" required>
                    </div>
                    <div class="col-md-3 mb-3">
                        <label for="kur" class="form-label">Kur <span class="text-danger">*</span></label>
                        <input type="number" step="0.000001" class="form-control" id="kur" required>
                    </div>
                    <div class="col-md-3 mb-3">
                        <label for="tutar" class="form-label">TL Karþýlýðý <span class="text-danger">*</span></label>
                        <input type="number" step="0.01" class="form-control" id="tutar" required>
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
                        <div class="form-text">Boþ býrakýlýrsa talimat tarihi geçerli olur</div>
                    </div>
                    <div class="col-md-4 mb-3">
                        <label for="aciklama" class="form-label">Açýklama</label>
                        <input type="text" class="form-control" id="aciklama" placeholder="Opsiyonel">
                    </div>
                </div>
            </div>
        </div>
        
        <div class="text-end mt-4">
            <button type="button" class="btn btn-primary" id="talimatOlusturBtn">
                <i class="fas fa-file-signature"></i> Talimat Oluþtur
            </button>
            <button type="button" class="btn btn-secondary ms-2" id="talimatYazdirBtn" disabled>
                <i class="fas fa-print"></i> Yazdýr
            </button>
        </div>
    ;
};

const initDovizCalculation = () => {
    const dovizInput = document.getElementById('dovizMiktari');
    const kurInput = document.getElementById('kur');
    const tutarInput = document.getElementById('tutar');
    
    if (!dovizInput || !kurInput || !tutarInput) return;
    
    let tutarManuelDegistirildi = false;
    
    const calculateTL = () => {
        if (tutarManuelDegistirildi) return;
        
        const doviz = parseFloat(dovizInput.value);
        const kur = parseFloat(kurInput.value);
        
        if (!isNaN(doviz) && !isNaN(kur)) {
            tutarInput.value = (doviz * kur).toFixed(2);
        }
    };
    
    dovizInput.addEventListener('input', calculateTL);
    kurInput.addEventListener('input', calculateTL);
    
    tutarInput.addEventListener('input', (e) => {
        if (e.target.value.trim() === '') {
            tutarManuelDegistirildi = false;
            calculateTL();
        } else {
            tutarManuelDegistirildi = true;
        }
    });
};

const setupDovizGondericiAliciSync = () => {
    const gondericiFirmaSelect = document.getElementById('gondericiFirma');
    const aliciFirmaSelect = document.getElementById('aliciFirma');
    
    if (!gondericiFirmaSelect || !aliciFirmaSelect) return;
    
    gondericiFirmaSelect.addEventListener('change', (e) => {
        const selectedValue = e.target.value;
        
        if (selectedValue && aliciFirmaSelect.value !== selectedValue) {
            if (choicesInstances && choicesInstances['aliciFirma']) {
                choicesInstances['aliciFirma'].setChoiceByValue(selectedValue);
            } else {
                aliciFirmaSelect.value = selectedValue;
            }
            aliciFirmaSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
};
'''

content = content + new_funcs

with open('modules/ui-etkilesimleri.js', 'w', encoding='utf-8') as f:
    f.write(content)
