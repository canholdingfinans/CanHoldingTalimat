# ARAŞTIRMA RAPORU: GÖREV 12.4 — Çapraz Departman Firma Filtrelemesinin (İzolasyon) Kırılması ve Deterministik Çözüm Mimarisi

**Tarih:** 15 Ekim 2026  
**Rapor Türü:** Adli Kod Analizi, Çoklu Departman Güvenliği ve Firma İzolasyon Mimarisi  
**Durum:** 🟡 Kullanıcı Onayına Sunuldu (Kod Değişikliği Yapılmadı)

---

## 1. YÖNETİCİ ÖZETİ (EXECUTIVE SUMMARY)

Talimat formu ekranında kullanıcı "Talimat Bölümü (Zorunlu)" alanında **ENJ** (Enerji) radyo butonunu seçtiğinde, "Gönderici Firma" dropdown listesinde **TCT** (Tectone) firmalarının (veya TCT seçiliyken ENJ firmalarının) listelenebildiği bildirilmiştir. Bu durum kurumsal finans güvenliği ve departmanlar arası katı izolasyon kuralını ihlal etmektedir.

Yapılan forensic kod incelemesinde, filtrelemenin kırılmasına yol açan **4 temel yapısal neden** tespit edilmiştir:

1. **Yaşam Döngüsü Senkronizasyon Kopukluğu (Lifecycle Desync):** `main.js` içinde `loadInitialData()` (firmaların yüklenip dropdown'lara doldurulduğu an), `loadUserDepartments()` (radio butonların DOM'a basıldığı an) fonksiyonundan **ÖNCE** çalışmaktadır. Dropdown'lar ilk oluşturulduğunda henüz hiçbir radio butonu DOM'da bulunmadığı için `aktifBolum = null` olmakta ve dropdown'lar **filtresiz olarak tüm holding firmalarıyla** doldurulmaktadır.
2. **İlk Yükleme Tetikleyicisinin Eksikliği (Missing Initial Trigger):** `loadUserDepartments()` asenkron tamamlanıp radio butonlarını oluşturduğunda ve ilk departmanı (`ENJ`) seçili yaptığında, dropdown'ları yeniden filtreleyecek bir event (`departmentChanged`) fırlatmamaktadır. Dolayısıyla sayfa açılışında filtresiz liste ekranda kalmaktadır.
3. **Gevşek Filtre Mantığı (Permissive Filter Fallback):** `modules/ui-etkilesimleri.js` içindeki filtre formülü `!firma.department || firma.department === 'ORTAK' || firma.department === aktifBolum` şeklindedir. Veritabanında `department` alanı `NULL` olan veya varsayılan `'ORTAK'` olarak kalan tüm firmalar her iki departmana da sızmaktadır.
4. **Departman Değişiminde Bayat Seçim Temizliği Eksikliği (Stale Selection):** Kullanıcı ENJ'den TCT'ye geçtiğinde dropdown yeniden dolsa dahi, daha önce seçilmiş olan ENJ firması ve o firmaya bağlı banka hesabı form state'inden temizlenmemektedir.

---

## 2. ADLİ HATA TESPİTİ (FORENSIC BUG ANALYSIS)

### Hata 1: `main.js` Yaşam Döngüsü Sıralaması ve İlk Yüklemede `aktifBolum === null`
* **Dosya:** [main.js](file:///c:/Users/admin/.gemini/antigravity-ide/scratch/HAVALE_EFT_TALIMATI/main.js#L263-L274) (Satır 266-270)
```javascript
// main.js - startAppWithSession
initializeUI();              // 1. Statik UI kurulur
await loadInitialData();     // 2. Firmalar çekilir ve populateFormDropdowns() çağrılır! ⚠️
await loadUserDepartments(); // 3. Departman radyo butonları ANCAK BURADA basılır! ⚠️
```
* **Dosya:** [modules/ui-etkilesimleri.js](file:///c:/Users/admin/.gemini/antigravity-ide/scratch/HAVALE_EFT_TALIMATI/modules/ui-etkilesimleri.js#L1922-L1931) (Satır 1922-1931)
```javascript
// populateFormDropdowns içindeki departman tespiti:
const currentDeptNode = document.querySelector('input[name="department_prefix"]:checked') || document.querySelector('input[type="hidden"][name="department_prefix"]');
const aktifBolum = currentDeptNode ? currentDeptNode.value : null;

// Gönderici kısıtlı (katı izolasyon), Alıcı serbest (virman izni)
if (aktifBolum && selectId !== 'aliciFirma') {
    filteredFirmalar = filteredFirmalar.filter(firma => 
        !firma.department || firma.department === 'ORTAK' || firma.department === aktifBolum
    );
}
```
* **Forensic Kanıt:**
  1. Adım 2'de `loadInitialData()` çalıştığında `refreshUI()` çağrılır.
  2. `refreshUI()` -> `populateFormDropdowns()` çağrılır.
  3. Ancak Adım 3 (`loadUserDepartments`) henüz çalışmadığı için DOM'da `input[name="department_prefix"]` **YOKTUR**.
  4. `currentDeptNode` **null** döner.
  5. `aktifBolum` **null** döner.
  6. `if (aktifBolum && selectId !== 'aliciFirma')` bloğu **ÇALIŞMAZ**!
  7. Dropdown'lar tüm holding firmaları (ENJ + TCT + Diğerleri) ile doldurulur.

---

### Hata 2: `loadUserDepartments()` İçinde İlk Seçimin Event Fırlatmaması
* **Dosya:** [main.js](file:///c:/Users/admin/.gemini/antigravity-ide/scratch/HAVALE_EFT_TALIMATI/main.js#L337-L359) (Satır 337-359)
```javascript
// main.js - loadUserDepartments
if (deps.length > 1) {
    container.style.display = 'flex';
    let html = '';
    deps.forEach((dep, index) => {
        html += `
            <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" name="department_prefix" id="dep_${dep}" value="${dep}" ${index === 0 ? 'checked' : ''}>
                <label class="form-check-label" for="dep_${dep}">${dep}</label>
            </div>
        `;
    });
    radioContainer.innerHTML = html;
    
    // Add event listeners for reactive UX
    radioContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
            window.dispatchEvent(new CustomEvent('departmentChanged'));
        });
    });
} else {
    container.style.display = 'none';
    radioContainer.innerHTML = `<input type="hidden" name="department_prefix" value="${deps[0]}">`;
}
```
* **Forensic Kanıt:**
  Radio butonlar DOM'a enjekte edilip ilk radio (`index === 0` -> ENJ) seçili yapılır. Ancak sadece `change` event listener'ı eklenir. İlk seçim için hiçbir `departmentChanged` eventi fırlatılmaz ve `populateFormDropdowns()` çağrılmaz!
  Sonuç olarak Hata 1'de filtresiz dolan liste, kullanıcı başka bir butona elle tıklayana kadar ekranda kalır.

---

### Hata 3: Gevşek Filtre Formülü (`!firma.department` ve `'ORTAK'`)
* **Forensic Kanıt:**
  Mevcut filtre formülü:
  ```javascript
  !firma.department || firma.department === 'ORTAK' || firma.department === aktifBolum
  ```
  1. `!firma.department`: Veritabanında `department` kolonu boş/null olan firmalar otomatik olarak geçer.
  2. `firma.department === 'ORTAK'`: Sisteme eklenen firmaların varsayılan bölümü `ORTAK` olarak tanımlanmıştır ([index.html:L325](file:///c:/Users/admin/.gemini/antigravity-ide/scratch/HAVALE_EFT_TALIMATI/index.html#L325) ve [supabase-entegrasyonu.js:L95](file:///c:/Users/admin/.gemini/antigravity-ide/scratch/HAVALE_EFT_TALIMATI/modules/supabase-entegrasyonu.js#L95)).
  3. Kullanıcının talebi: *"Gönderici firmalar, KESİNLİKLE sadece seçili olan radyo butonunun (department_prefix) grubuna ait firmalarla sınırlandırılmalıdır."*
  4. Eğer `ORTAK` firmalar veya tanımsız firmalar filtreye dahil edilirse, ENJ seçildiğinde TCT ile ilişkili ortak kayıtlar da listelenmektedir. Katı izolasyon için `normalize(firma.department) === normalize(aktifBolum)` kuralı uygulanmalıdır.

---

### Hata 4: Departman Değiştiğinde Formun Temizlenmemesi (Stale State)
* **Forensic Kanıt:**
  Kullanıcı ENJ seçip bir gönderici firma ve banka seçtikten sonra radyo butonunu TCT olarak değiştirdiğinde:
  1. `departmentChanged` tetiklenir.
  2. `populateFormDropdowns()` yeni Choices instance'ı oluşturur.
  3. Ancak önceden seçilmiş olan ENJ firmasının banka detayları (`gondericiBankaDetay`), IBAN alanı ve para birimi kontrolleri ekranda asılı kalabilir. Form ve banka seçimi anında sıfırlanmalıdır.

---

## 3. FİRMA VERİSİ VE ÖZELLİK ANALİZİ

### 3.1. Veritabanı ve Bellek Modeli
Projede firmalar Supabase `firms` tablosunda saklanmakta ve `modules/firmalar.js` içinde `firmalar = []` dizisinde tutulmaktadır:

| Alan Adı | Veri Tipi | Açıklama | Örnek Değerler |
|:---|:---|:---|:---|
| `id` | `bigint` | Benzersiz firma ID | `15`, `42` |
| `name` | `text` | Firma ticari unvanı | `CAN ENERJİ A.Ş.`, `TECTONE ELEKTRİK` |
| `turu` | `text` | Firma türü | `'grup'`, `'satıcı'`, `'müşteri'` |
| `department` | `text` | **Firma Departmanı / Grubu** | `'ENJ'`, `'TCT'`, `'ORTAK'` |

> [!IMPORTANT]
> Projede departman aidiyetini belirten özellik **`firma.department`** alanıdır.
> Kullanıcının formda seçtiği radyo butonu ise **`department_prefix`** (`name="department_prefix"`, değer: `'ENJ'`, `'TCT'`) olarak adlandırılmıştır.
> İzolasyon kuralı: `firma.department.trim().toUpperCase() === department_prefix.trim().toUpperCase()` olmalıdır.

---

## 4. GÖNDERİCİ VS. ALICI FİRMA İZOLASYON KURALLARI

Finansal yönetim mimarisinde Gönderici ve Alıcı firmaların davranış kuralları kesin olarak ayrışmaktadır:

### A. Gönderici Firma (KATI İZOLASYON - ZERO TOLERANCE)
* **Kapsam:** `gondericiFirma`, `vergiGondericiFirma`, `sgkGondericiFirma`, `gumrukGondericiFirma`.
* **Kural:** Bir departmanın yetkilisi, başka bir departmanın firmasından para çıkartamaz!
* **Filtre:** SADECE `firma.turu === 'grup'` VE `firma.department === aktifBolum` olan firmalar listelenmelidir.
* `ORTAK` veya `NULL` departmanlı firmalar gönderici listesine **SIZAMAZ**.

### B. Alıcı Firma (VİRMAN VE CARİ SERBESTİSİ)
* **Kapsam:** `aliciFirma`.
* **Kural:** 
  1. **İç Transfer (Virman):** Holding içi virman işlemlerinde ENJ firmasından TCT firmasına (veya tersi) para transferi yapılabilmelidir. Bu nedenle alıcı firma seçiminde grup firmaları departman kısıtlamasına takılmamalıdır.
  2. **Dış Transfer / Cari Ödeme:** Satıcı veya müşteri ödemelerinde alıcı firma piyasadaki üçüncü şahıs/tedarikçi firmadır; departmanla sınırlandırılamaz.
* **Sonuç:** `selectId === 'aliciFirma'` için departman kısıtı uygulanmaz; sadece `data-filter-type` (`grup`, `satıcı`, `müşteri`, `all`) kuralı işletilir.

---

## 5. TEKNİK ÇÖZÜM MİMARİSİ (ARCHITECTURAL BLUEPRINT)

### 5.1. `main.js` İçinde Yaşam Döngüsü ve İlk Tetikleme Düzeltmesi
`loadUserDepartments()` tamamlandığı anda hem radio butonlar DOM'a oturmuş hem de ilk seçim yapılmış olur. Bu noktada derhal `populateFormDropdowns()` çağrılarak ilk açılıştaki filtresizlik sonlandırılacaktır:

```javascript
// main.js - loadUserDepartments fonksiyonunun sonu:
radioContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
        window.dispatchEvent(new CustomEvent('departmentChanged'));
    });
});

// 🎯 İLK YÜKLEMEDE DEPARTMAN SEÇİMİNİ DROPDOWNLARA DERHAL YANSIT
window.dispatchEvent(new CustomEvent('departmentChanged'));
```

Ayrıca `startAppWithSession` akışı:
```javascript
await loadInitialData();     // Firmalar indi
await loadUserDepartments(); // Departman butonları DOM'a basıldı ve departmentChanged tetiklendi
await checkRevisionMode();   // Revizyon varsa ilgili departmanı seçip prefill yaptı
```

---

### 5.2. `modules/ui-etkilesimleri.js` İçinde Katı Gönderici İzolasyonu
`populateFormDropdowns()` fonksiyonundaki filtre formülü güvenli ve katı hale getirilecektir:

```javascript
// modules/ui-etkilesimleri.js - populateFormDropdowns
const currentDeptNode = document.querySelector('input[name="department_prefix"]:checked') 
    || document.querySelector('input[type="hidden"][name="department_prefix"]');
const aktifBolum = currentDeptNode ? currentDeptNode.value.trim().toUpperCase() : null;

// Gönderici kısıtlı (KATI İZOLASYON), Alıcı serbest (Virman ve Cari esnekliği)
if (aktifBolum && selectId !== 'aliciFirma') {
    filteredFirmalar = filteredFirmalar.filter(firma => {
        const firmaDept = (firma.department || '').trim().toUpperCase();
        return firmaDept === aktifBolum;
    });
}
```

---

### 5.3. Departman Değiştiğinde Bayat Banka/Detay Temizliği (Stale Reset)
Kullanıcı radyo butonunu değiştirdiğinde eski departmandan kalan seçimleri temizleyen mantık `departmentChanged` dinleyicisine eklenecektir:

```javascript
window.addEventListener('departmentChanged', () => {
    // 1. Dropdownları yeni departmana göre yeniden doldur
    populateFormDropdowns();
    
    // 2. Varsa eski gönderici banka seçimini ve detay kutusunu temizle
    const gondericiBanka = document.getElementById('gondericiBanka');
    if (gondericiBanka) gondericiBanka.innerHTML = '<option value="">Önce Firma Seçiniz</option>';
    
    const bankaDetay = document.getElementById('gondericiBankaDetay');
    if (bankaDetay) bankaDetay.innerHTML = '';
});
```

---

## 6. ADIM ADIM KODLAMA PLANI (UYGULAMA ÖNCESİ ONAY TABLOSU)

| Adım | Dosya | Yapılacak İşlem | Güvenlik / Etki |
|:---|:---|:---|:---|
| **1** | `main.js` | `loadUserDepartments()` fonksiyonunun sonuna `window.dispatchEvent(new CustomEvent('departmentChanged'))` ekle (İlk yükleme filtresi) | 🟢 İlk Açılış Koruması |
| **2** | `modules/ui-etkilesimleri.js` | `populateFormDropdowns()` içindeki gevşek filtreyi kaldır; `(firma.department \|\| '').trim().toUpperCase() === aktifBolum` katı kuralını yaz | 🟢 %100 Katı İzolasyon |
| **3** | `modules/ui-etkilesimleri.js` | `departmentChanged` event dinleyicisine eski banka ve detay alanlarını temizleme mantığını ekle | 🟢 Bayat State Koruması |
| **4** | Canlı Test | ENJ seçildiğinde sadece ENJ firmalarının, TCT seçildiğinde sadece TCT firmalarının geldiğini doğrula | 🟢 Doğrulama |

---

## 7. ONAY TALEBİ

Yukarıdaki hata analizi ve deterministik izolasyon mimarisi çerçevesinde, **GÖREV 12.4 Kodlama Aşamasına** geçilmesi için onayınızı rica ederim.
