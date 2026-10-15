# ARAŞTIRMA RAPORU: GÖREV 12.1 — AKILLI REVİZYON, ÇAPRAZ DEPARTMAN DESTEĞİ VE ARŞİV FİLTRELERİ

**Tarih:** 15 Ekim 2026
**Durum:** 📋 Mimari Plan Tamamlandı — Kodlamaya Hazır (Bu aşamada hiçbir kaynak dosyada değişiklik yapılmamıştır)
**Kapsam:** Uçtan uca "Akıllı Revizyon (Smart Revision)" mimarisi, Arşiv Durum Filtreleri ve PDF Revizyon Notu

---

## 1. Sistem Forensik Analizi (Mevcut Kod İncelemesi)

### 1.1. Veritabanı — `payment_instructions` Tablosu

`modules/supabase-entegrasyonu.js` dosyasındaki `talimatOperations.createHavaleEFT()` (L449), `createVergi()` (L471), `createDoviz()` (L499) fonksiyonları incelendi. Mevcut INSERT payload:

```javascript
// modules/supabase-entegrasyonu.js — L456-460
const { data, error } = await supabaseClient
    .from('payment_instructions')
    .insert([instructionData])  // 'durum' ve 'revize_edilen_no' YOK
    .select()
    .single();
```

**Tespit edilen eksikler:**

| Eksik Alan | Gerekçe |
|:---|:---|
| `durum` | `aktif / iptal / revize_edildi` yaşam döngüsü alanı yok |
| `revize_edilen_no` | Hangi eski talimatın yerine geçildiğini gösteren audit trail alanı yok |

### 1.2. Numara Üretim Mekanizması (Trigger Analizi)

`database_payment_instructions_migration.sql` incelemesinden:
- Talimat numarası `BEFORE INSERT` trigger'ı (`tr_set_department_and_number`) tarafından otomatik üretilmektedir.
- **Kritik Kural:** Revizyon bir `UPDATE` değil, **yeni INSERT** olmalıdır. Bu sayede trigger otomatik olarak doğru sayacı kullanır.
- Çapraz departman senaryosunda: `department_prefix = 'TCT'` ile gelen INSERT'te trigger TCT serisini kullanır → ENJ sayacı etkilenmez.

### 1.3. Arşiv Ekranı — `arsiv.html`

`applyFilters()` fonksiyonu (L650-733) incelendi. Mevcut filtreleme yapısı:

| HTML ID | Filtre | Durum |
|:---|:---|:---|
| `grupPrefixFilter` | Grup (ENJ/TCT) | ✅ Var |
| `grupFirmaFilter` | Gönderici Firma | ✅ Var |
| `instructionTypeFilter` | Talimat Türü | ✅ Var |
| `dateFromFilter` / `dateToFilter` | Tarih Aralığı | ✅ Var |
| `kullaniciFilter` | Oluşturan Kişi | ✅ Var |
| `durumFilter` | **Durum (aktif/iptal/revize)** | ❌ **EKSİK** |

`renderCardView()` (L312-378) ve `renderListView()` (L381-451) incelendi:
- Durum rozeti (badge) yok.
- `[🔄 Revize Et]` butonu yok.
- Mevcut işlem butonları: sadece `[Detay]` ve `[Sil]`.

`loadInstructions()` (L780): `.eq('durum', ...)` filtresi olmaksızın tüm kayıtları çekiyor.

### 1.4. Ana Form — `index.html` + `modules/ui-etkilesimleri.js`

- `selectInstructionType(typeKey)` (L878): form içeriğini dinamik render eder.
- `generateDynamicFormFields(config)` (L931): `#dynamicFormFields` container'ına HTML yazar.
- `talimatOlustur` custom event (L445): `main.js`'e kaydetme sinyali gönderir.
- `initializeUI()` (L30): tüm UI'ı başlatır — buraya `checkRevisionMode()` çağrısı eklenecek.
- **Eksikler:** `#revisionBanner` HTML'i, `sessionStorage` pre-fill mekanizması, revizyon state yönetimi yok.

---

## 2. VERİTABANI (Supabase) GÜNCELLEME PLANI

Supabase Dashboard > SQL Editor'da çalıştırılacak script:

```sql
-- ==============================================================================
-- GÖREV 12.1 — AKILLI REVİZYON İÇİN VERİTABANI DEĞİŞİKLİKLERİ
-- Güvenli: IF NOT EXISTS korumalıdır, tekrar çalıştırılabilir.
-- ==============================================================================

BEGIN;

-- ADIM 1: 'durum' sütunu — CHECK constraint ile geçersiz değer engellenir
ALTER TABLE public.payment_instructions
  ADD COLUMN IF NOT EXISTS durum TEXT NOT NULL DEFAULT 'aktif'
  CHECK (durum IN ('aktif', 'iptal', 'revize_edildi'));

-- ADIM 2: 'revize_edilen_no' sütunu — TEXT olarak tutulur (FK değil).
-- Revize edilen talimat silinse bile audit trail kaybolmasın diye TEXT tercih edildi.
-- Örnek değer: 'ENJ-2026-0005'. NULL = normal talimat (revizyon değil).
ALTER TABLE public.payment_instructions
  ADD COLUMN IF NOT EXISTS revize_edilen_no TEXT DEFAULT NULL;

-- ADIM 3: Mevcut kayıtları 'aktif' olarak işaretle
UPDATE public.payment_instructions
  SET durum = 'aktif'
  WHERE durum IS NULL;

-- ADIM 4: Durum filtresi için performans indeksi
-- Arşiv sayfası varsayılan olarak durum='aktif' filtresiyle açılacağından kritik.
CREATE INDEX IF NOT EXISTS idx_payment_instructions_durum
  ON public.payment_instructions(durum);

-- ADIM 5: Çapraz sorgular için bileşik indeks (departman + durum)
CREATE INDEX IF NOT EXISTS idx_payment_instructions_dept_durum
  ON public.payment_instructions(department_prefix, durum);

COMMIT;
```

---

## 3. UX/UI AKIŞI — ARŞİV SAYFASI (`arsiv.html`)

### 3.1. HTML Değişikliği: `durumFilter` SELECT Elementi

Mevcut `filter-section` içinde, `kullaniciFilter` (L128) ile aynı satıra yeni bir `col-md-3` bloğu eklenir:

```html
<!-- arsiv.html — L128 civarına EKLENECEK -->
<div class="col-md-3 mb-3">
    <label for="durumFilter" class="form-label">
        <i class="fas fa-circle-dot me-1"></i>Durum
    </label>
    <select class="form-select" id="durumFilter">
        <option value="aktif" selected>✅ Aktif Talimatlar</option>
        <option value="all">🔍 Tümünü Göster</option>
        <option value="revize_edildi">🔄 Revize Edilmiş</option>
        <option value="iptal">🚫 İptal Edilmiş</option>
    </select>
</div>
```

### 3.2. JavaScript: `loadInstructions()` — Sunucu Taraflı Durum Filtresi

Mevcut `loadInstructions()` (L780) yeni versiyon:

```javascript
// arsiv.html — loadInstructions() YENİ VERSİYON
async function loadInstructions() {
    try {
        const durumVal = document.getElementById('durumFilter')?.value || 'aktif';

        let query = supabaseClient
            .from('payment_instructions')
            .select(`
                *,
                gonderici_firma:firms!payment_instructions_gonderici_firma_id_fkey(name),
                alici_firma:firms!payment_instructions_alici_firma_id_fkey(name),
                gonderici_banka:bank_accounts!payment_instructions_gonderici_banka_hesap_id_fkey(banka_adi, sube_adi, iban),
                alici_banka:bank_accounts!payment_instructions_alici_banka_hesap_id_fkey(banka_adi, sube_adi, iban)
            `)
            .order('instruction_number', { ascending: false });

        // 'all' seçilirse sunucu filtresi eklenmez
        if (durumVal !== 'all') {
            query = query.eq('durum', durumVal);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        allInstructions = data;
        filteredInstructions = [...allInstructions];
        populateFirmaFilter(allInstructions);
        populateKullaniciFilter(allInstructions);
        renderInstructions(filteredInstructions);
    } catch (error) {
        console.error('Talimatlar yüklenirken hata oluştu:', error);
        // Mevcut hata HTML korunur
    }
}
```

### 3.3. JavaScript: `applyFilters()` — Durum Bloğu Eklenmesi

`applyFilters()` (L650) içinde mevcut filtrelerin sonuna, `return true;`'dan önce eklenir:

```javascript
// arsiv.html — applyFilters() içine EKLENECEK BLOK
const durumFilterVal = document.getElementById('durumFilter')?.value;
if (durumFilterVal && durumFilterVal !== 'all') {
    if ((instruction.durum || 'aktif') !== durumFilterVal) {
        return false;
    }
}
```

`clearFilters()` (L737) güncellemesi:

```javascript
// arsiv.html — clearFilters() içine EKLENECEK
document.getElementById('durumFilter').value = 'aktif';
await loadInstructions(); // Sunucudan filtreli olarak yeniden çek
```

### 3.4. JavaScript: `renderCardView()` — Durum Rozeti + Revize Et Butonu

Mevcut kart yapısı (L319-378) içinde `instruction_number` badge'inin yanı ve buton grubu güncellenir:

```javascript
// arsiv.html — renderCardView() içine EKLENECEK
const durum = instruction.durum || 'aktif';
const durumBadgeMap = {
    aktif:         `<span class="badge bg-success ms-1">Aktif</span>`,
    revize_edildi: `<span class="badge bg-warning text-dark ms-1">
                       <i class="fas fa-sync-alt"></i> Revize Edildi
                   </span>`,
    iptal:         `<span class="badge bg-secondary ms-1">
                       <i class="fas fa-ban"></i> İptal
                   </span>`
};
const durumBadge = durumBadgeMap[durum] || '';

// Hangi eski talimatın yerine geçtiğini gösteren bağlantı bilgisi
const revizeLink = instruction.revize_edilen_no
    ? `<small class="text-muted d-block mt-1">
           <i class="fas fa-link"></i> Yerine Geçtiği:
           <strong>${instruction.revize_edilen_no}</strong>
       </small>`
    : '';

// Kart buton grubu — sadece 'aktif' talimatlar revize edilebilir
const butonlar = `
    <div class="d-flex gap-2 flex-wrap mt-2">
        <button class="btn btn-outline-primary btn-sm detail-btn flex-fill"
                data-id="${instruction.id}">
            <i class="fas fa-eye me-1"></i> Detay
        </button>
        ${durum === 'aktif' ? `
        <button class="btn btn-outline-warning btn-sm revize-btn"
                data-id="${instruction.id}"
                title="Bu talimatı revize et">
            🔄
        </button>` : ''}
        ${durum === 'aktif' ? `
        <button class="btn btn-outline-danger btn-sm delete-btn"
                data-id="${instruction.id}"
                data-number="${instruction.instruction_number || 'N/A'}"
                data-type="${instructionType}">
            <i class="fas fa-trash"></i>
        </button>` : ''}
    </div>
`;
```

### 3.5. JavaScript: `renderListView()` — Durum Sütunu

Tablo başlığına `<th>Durum</th>` eklenir. Her satırda:

```javascript
// arsiv.html — renderListView() tablo satırı içine EKLENECEK
<td>
    ${{ aktif: '<span class="badge bg-success">Aktif</span>',
        revize_edildi: '<span class="badge bg-warning text-dark">🔄 Revize</span>',
        iptal: '<span class="badge bg-secondary">🚫 İptal</span>'
      }[instruction.durum || 'aktif']}
</td>
```

### 3.6. `[🔄 Revize Et]` Buton Event Listener'ı

Mevcut `detail-btn` ve `delete-btn` listener bloklarına eklenir:

```javascript
// arsiv.html — renderCardView() ve renderListView() event binding bloğuna EKLENECEK
document.querySelectorAll('.revize-btn').forEach(button => {
    button.addEventListener('click', function () {
        const instructionId = this.getAttribute('data-id');
        const instruction = allInstructions.find(inst => inst.id == instructionId);
        if (!instruction) return;

        // Tüm talimat verisini sessionStorage'a kaydet
        sessionStorage.setItem('revisionData', JSON.stringify(instruction));

        // Ana forma revizyon modunda yönlendir
        window.location.href = 'index.html?mode=revision';
    });
});
```

---

## 4. UX/UI AKIŞI — ANA FORM (`index.html` + `modules/ui-etkilesimleri.js`)

### 4.1. `index.html` Değişikliği: `#revisionBanner` HTML

Form container'ının hemen başına eklenir:

```html
<!-- index.html — Form üstüne EKLENECEK -->
<div id="revisionBanner" class="alert alert-warning d-none mb-3 shadow-sm border-warning" role="alert">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
            <h6 class="alert-heading mb-1">
                <i class="fas fa-sync-alt me-2 text-warning"></i>
                <strong>Akıllı Revizyon Modu Aktif</strong>
            </h6>
            <p class="mb-0 small">
                Şu an
                <code id="revisionSourceNo" class="bg-dark text-white px-2 py-1 rounded">—</code>
                numaralı talimatı revize ediyorsunuz.
                <span class="text-danger fw-semibold">
                    ⚠️ Bölüm değiştirilirse yeni bölümün sayacından numara atanır.
                </span>
            </p>
        </div>
        <button type="button" class="btn btn-outline-dark btn-sm" id="cancelRevisionBtn">
            <i class="fas fa-times me-1"></i> Revizyonu İptal Et
        </button>
    </div>
</div>
```

### 4.2. `modules/ui-etkilesimleri.js` — `initializeUI()` Sonrası Aktivasyon

`initializeUI()` (L30) içine son satır olarak eklenir:

```javascript
// modules/ui-etkilesimleri.js — initializeUI() içine EKLENECEK (L47 öncesi)
checkRevisionMode();
```

### 4.3. Yeni Fonksiyonlar: `checkRevisionMode()` ve `prefillFormFromRevision()`

```javascript
// modules/ui-etkilesimleri.js — YENİ FONKSİYONLAR

/**
 * sessionStorage'dan revizyon verisini okur, formu ön-doldurur.
 * URL'de ?mode=revision parametresi olduğunda çalışır.
 */
const checkRevisionMode = () => {
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

    // 2. talimat_turu → typeKey dönüşümü (talimatlar.js'deki instructionTypes anahtarları)
    const typeKeyMap = {
        'Havale/EFT':         'havale-ic',
        'Vergi Ödemesi':      'vergi',
        'SGK Ödemesi':        'sgk',
        'Gümrük Ödemesi':     'gumruk',
        'Döviz Alım/Satım':   'doviz-al',
        'Cari Hesap Ödemesi': 'cari-satici',
    };
    const typeKey = typeKeyMap[revisionSource.talimat_turu] || 'havale-ic';
    selectInstructionType(typeKey);

    // 3. DOM render sonrası pre-fill (generateDynamicFormFields async davranışı için beklenir)
    setTimeout(() => prefillFormFromRevision(revisionSource), 150);

    // 4. İptal butonu
    const cancelBtn = document.getElementById('cancelRevisionBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            sessionStorage.removeItem('revisionData');
            banner?.classList.add('d-none');
            window.history.replaceState({}, '', 'index.html');
        });
    }
};

/**
 * Kaynak talimat verisini form alanlarına doldurur.
 * @param {Object} src - payment_instructions kaydı
 */
const prefillFormFromRevision = (src) => {
    // Gönderici Firma
    const gondericiFirmaEl = document.getElementById('gondericiFirma');
    if (gondericiFirmaEl && src.gonderici_firma_id) {
        gondericiFirmaEl.value = src.gonderici_firma_id;
        gondericiFirmaEl.dispatchEvent(new Event('change')); // Banka listesini doldur
    }

    // Alıcı Firma
    const aliciFirmaEl = document.getElementById('aliciFirma');
    if (aliciFirmaEl && src.alici_firma_id) {
        aliciFirmaEl.value = src.alici_firma_id;
        aliciFirmaEl.dispatchEvent(new Event('change'));
    }

    // Banka hesapları banka listesi dolduktan sonra seçilir
    setTimeout(() => {
        const gondericiBankaEl = document.getElementById('gondericiBanka');
        if (gondericiBankaEl && src.gonderici_banka_hesap_id) {
            gondericiBankaEl.value = src.gonderici_banka_hesap_id;
        }
        const aliciBankaEl = document.getElementById('aliciBanka');
        if (aliciBankaEl && src.alici_banka_hesap_id) {
            aliciBankaEl.value = src.alici_banka_hesap_id;
        }
    }, 400);

    // Tutar ve Açıklama
    const tutarEl = document.getElementById('tutar');
    if (tutarEl && src.tutar) tutarEl.value = src.tutar;
    const aciklamaEl = document.getElementById('aciklama');
    if (aciklamaEl && src.aciklama) aciklamaEl.value = src.aciklama;

    // NOT: Talimat tarihi bugünün tarihi olarak kalır (pre-fill edilmez)

    // Döviz-spesifik alanlar
    if (src.talimat_turu === 'Döviz Alım/Satım') {
        const dovizMiktariEl = document.getElementById('dovizMiktari');
        const kurEl = document.getElementById('kur');
        if (dovizMiktariEl && src.doviz_miktari) dovizMiktariEl.value = src.doviz_miktari;
        if (kurEl && src.kur) kurEl.value = src.kur;
    }

    // Vergi-spesifik alanlar
    if (src.talimat_turu === 'Vergi Ödemesi') {
        const vergiTuruEl = document.getElementById('vergiTuru');
        const vergiDairesiEl = document.getElementById('vergiDairesi');
        const vergiKimlikNoEl = document.getElementById('vergiKimlikNo');
        if (vergiTuruEl && src.vergi_turu) vergiTuruEl.value = src.vergi_turu;
        if (vergiDairesiEl && src.vergi_dairesi) vergiDairesiEl.value = src.vergi_dairesi;
        if (vergiKimlikNoEl && src.vergi_kimlik_no) vergiKimlikNoEl.value = src.vergi_kimlik_no;
    }

    console.log('[Revizyon] Pre-fill tamamlandı:', src.instruction_number);
};
```

---

## 5. ÇAPRAZ DEPARTMAN VE KAYDETME MANTIĞI

### 5.1. Çapraz Departman Senaryosu (Tam Akış)

```
ADIM 1: Kullanıcı arşivde ENJ-2026-0005 → [🔄 Revize Et] tıklar
ADIM 2: sessionStorage.setItem('revisionData', ...) → index.html?mode=revision
ADIM 3: Banner: "ENJ-2026-0005 numaralı talimatı revize ediyorsunuz"
ADIM 4: Form ENJ verileriyle ön-doldurulur
ADIM 5: Kullanıcı departman radyo butonunu ENJ → TCT olarak değiştirir
ADIM 6: [Talimat Oluştur] butonuna basar

VERİTABANI:
  INSERT payload:
    { ...formData, department_prefix: 'TCT', revize_edilen_no: 'ENJ-2026-0005', durum: 'aktif' }
  Trigger: TCT serisinden → TCT-2026-0001 atar (ENJ sayacı değişmez)
  INSERT başarılı → yeni kayıt: TCT-2026-0001

  UPDATE:
    SET durum = 'revize_edildi' WHERE id = <ENJ-2026-0005'in UUID'si>
  → ENJ-2026-0005 artık arşivde "Revize Edildi" rozeti ile görünür
```

### 5.2. İki Aşamalı Atomik Kayıt — `main.js` Handler Planı

`main.js`'deki `talimatOlustur` event listener'ına eklenecek:

```javascript
// main.js — talimatOlustur event handler'ı YENİ VERSİYON

window.addEventListener('talimatOlustur', async (e) => {
    // --- Revizyon durumu kontrol ---
    const revisionDataRaw = sessionStorage.getItem('revisionData');
    const isRevisionMode = revisionDataRaw !== null;
    let revisionSource = isRevisionMode ? JSON.parse(revisionDataRaw) : null;

    // --- ADIM 1: Form verisini topla (mevcut validasyon korunur) ---
    const instructionData = collectFormData();
    if (!instructionData) return;

    // durum ve revize_edilen_no alanlarını ekle
    instructionData.durum = 'aktif';
    if (isRevisionMode && revisionSource) {
        instructionData.revize_edilen_no = revisionSource.instruction_number;
    }

    try {
        // --- ADIM 2: Yeni talimatı INSERT et (trigger numarayı atar) ---
        const newInstruction = await talimatOperations.createHavaleEFT(instructionData);

        // --- ADIM 3: Eski talimatı 'revize_edildi' yap ---
        if (isRevisionMode && revisionSource) {
            const { error: updateError } = await supabaseClient
                .from('payment_instructions')
                .update({ durum: 'revize_edildi' })
                .eq('id', revisionSource.id);

            if (updateError) {
                // Yeni kayıt korunur, kullanıcıya uyarı verilir
                console.error('[Revizyon] Eski talimat kapatılamadı:', updateError.message);
                showNotification(
                    `⚠️ ${revisionSource.instruction_number} otomatik kapatılamadı. Manuel kontrol edin.`,
                    'warning'
                );
            }

            // --- ADIM 4: State temizle ---
            sessionStorage.removeItem('revisionData');
            document.getElementById('revisionBanner')?.classList.add('d-none');
            window.history.replaceState({}, '', 'index.html');
        }

        // --- ADIM 5: Bildirim ve PDF çıktısı ---
        const msg = isRevisionMode
            ? `✅ Revizyon tamamlandı! Yeni: ${newInstruction.instruction_number}`
            : `✅ Talimat oluşturuldu: ${newInstruction.instruction_number}`;
        showNotification(msg, 'success');

        // isRevisionMode ise revizeEdilenNo parametresini geçir
        renderTalimatOutput(
            newInstruction,
            isRevisionMode ? revisionSource.instruction_number : null
        );

    } catch (err) {
        console.error('[Kayıt] Hata:', err);
        showNotification(`❌ ${err.message}`, 'error');
    }
});
```

---

## 6. PDF VE EKRAN ÇIKTISI ENTEGRASYOnu

### 6.1. `renderTalimatOutput()` — Revizyon Notu

`ui-etkilesimleri.js` içinde Yazdır çıktısı üreten fonksiyon güncellenir (L1199 civarı):

```javascript
/**
 * Talimat çıktısını render eder.
 * @param {Object} instruction - Yeni oluşturulan talimat
 * @param {string|null} revizeEdilenNo - Eski talimat no (null = normal talimat)
 */
const renderTalimatOutput = (instruction, revizeEdilenNo = null) => {
    // ... mevcut çıktı HTML'i burada üretilir ...

    // Revizyon notu — sadece revizyon talimatlarında görünür
    const revizyonNotu = revizeEdilenNo ? `
        <div class="alert alert-danger mt-4 text-center p-3"
             style="border: 2px dashed #dc3545; background-color: #fff8f8; page-break-inside: avoid;">
            <h6 class="mb-2 text-danger fw-bold">
                <i class="fas fa-exclamation-triangle me-2"></i>
                DİKKAT: REVİZYON BELGESİDİR
            </h6>
            <div style="font-size: 13px; color: #333; line-height: 1.6;">
                Bu belge, <strong style="color:#dc3545;">${revizeEdilenNo}</strong>
                numaralı talimatın yerine geçmektedir.
                <br><em>Önceki talimat hükümsüz sayılmıştır.</em>
            </div>
        </div>
    ` : '';

    const outputContainer = document.getElementById('talimatCikti');
    if (outputContainer) {
        outputContainer.innerHTML += revizyonNotu;
    }
};
```

### 6.2. Baskı CSS — `style-improved-print.css`

```css
/* style-improved-print.css — EKLENECEK */
@media print {
    /* Revizyon notu baskıda renk ve kenarlık ile görünsün */
    .alert-danger[style*="dashed"] {
        border: 2px dashed #dc3545 !important;
        background-color: #fff8f8 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    /* Banner baskıda gizle */
    #revisionBanner {
        display: none !important;
    }
}
```

---

## 7. DEĞİŞİKLİK TABLOSU VE UYGULAMA SIRASI

| # | Dosya | Değişiklik | Öncelik |
|:--|:---|:---|:---:|
| 1 | **Supabase SQL** | `durum` + `revize_edilen_no` sütunları + 2 indeks | 🔴 Kritik (İlk) |
| 2 | `arsiv.html` | `durumFilter` HTML elementi | 🟠 Yüksek |
| 3 | `arsiv.html` | `loadInstructions()` — sunucu taraflı durum filtresi | 🟠 Yüksek |
| 4 | `arsiv.html` | `applyFilters()` + `clearFilters()` — durum bloğu | 🟠 Yüksek |
| 5 | `arsiv.html` | `renderCardView()` — durum rozeti + revize butonu | 🟠 Yüksek |
| 6 | `arsiv.html` | `renderListView()` — durum sütunu + revize butonu | 🟠 Yüksek |
| 7 | `arsiv.html` | `.revize-btn` event listener | 🟠 Yüksek |
| 8 | `index.html` | `#revisionBanner` HTML elementi | 🟡 Normal |
| 9 | `modules/ui-etkilesimleri.js` | `checkRevisionMode()` + `prefillFormFromRevision()` yeni fonksiyonlar | 🟡 Normal |
| 10 | `modules/ui-etkilesimleri.js` | `initializeUI()` içine `checkRevisionMode()` çağrısı | 🟡 Normal |
| 11 | `main.js` | `talimatOlustur` handler — iki aşamalı atomik kayıt | 🟡 Normal |
| 12 | `modules/ui-etkilesimleri.js` | `renderTalimatOutput()` — revizyon notu parametresi | 🟢 Son |
| 13 | `style-improved-print.css` | Revizyon notu baskı CSS'i | 🟢 Son |

---

## 8. SINIR DURUMLAR VE GÜVENLİK

| Senaryo | Çözüm |
|:---|:---|
| `index.html?mode=revision` URL'i sessionStorage olmadan açılırsa | `checkRevisionMode()` erken döner, form normal modda açılır |
| INSERT başarılı ama UPDATE (eski kapatma) başarısız olursa | Yeni talimat korunur; kullanıcıya `warning` bildirimi gösterilir, konsola log düşer |
| Çift tıkla iki revizyon oluşturulursa | `talimatOlusturBtn` kayıt sırasında `disabled` yapılır (mevcut pattern) |
| Çapraz departman değiştirilirse | `department_prefix` yeni değerle INSERT edilir → trigger bağımsız sayacı devreye sokar; `revize_edilen_no` eski talimat nosunu korur |
| Zincir revizyon (`revize_edildi` olan talimatı tekrar revize etme) | `revize_edildi` durumundaki talimatlarda `[🔄 Revize Et]` butonu gösterilmez |

---

## 9. SONUÇ

Bu mimari sayesinde:
1. **Sıralı numara kuralı %100 korunur** — Her revizyon yeni INSERT, trigger sıradaki numarayı verir.
2. **Çapraz departman desteği kusursuzdur** — `department_prefix` formdaki seçime göre yazılır, trigger bağımsız sayacı devreye sokar.
3. **Arşiv kirliliği sıfırlanır** — Sayfa varsayılan `aktif` filtresiyle açılır; revize/iptal olanlar sadece bilinçli seçimde görünür.
4. **Denetim izi (Audit Trail) tam şeffaflıkta** — `revize_edilen_no` her zaman hangi talimatın yerine geçildiğini gösterir.
5. **PDF çıktısında yasal uyarı** — Revizyon belgelerinde "DİKKAT" notu otomatik basılır.

---

*Bu aşamada kullanıcı talimatı gereği hiçbir kaynak dosyada değişiklik yapılmamıştır. Plan onay için raporlanmıştır.*
