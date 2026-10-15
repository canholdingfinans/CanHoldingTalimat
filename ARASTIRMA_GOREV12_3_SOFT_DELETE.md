# ARAŞTIRMA RAPORU: GÖREV 12.3 — Silme (Hard Delete) İşleminin İptal (Soft Delete) Mekanizmasına Çevrilmesi

**Tarih:** 15 Ekim 2026  
**Rapor Türü:** Adli Kod Analizi, Finansal Denetim İzi (Audit Trail) Güvenliği ve Soft Delete Mimari Planı  
**Durum:** 🟡 Kullanıcı Onayına Sunuldu (Kod Değişikliği Yapılmadı)

---

## 1. YÖNETİCİ ÖZETİ (EXECUTIVE SUMMARY)

Finansal ERP sistemlerinde, bankalara hitaben yazılan ve numaralandırılan ödeme talimatlarının veritabanından kalıcı olarak silinmesi (`HARD DELETE`), kanuni ve operasyonel denetim izinin (`audit trail`) yok olmasına ve talimat numaraları arasında açık (gap) kalmasına neden olur.

`arsiv.html` ve `modules/supabase-entegrasyonu.js` üzerinde yapılan adli incelemede:
1. Arşiv ekranındaki kırmızı çöp kutusu (`.delete-btn`) butonunun, veritabanında doğrudan `DELETE FROM payment_instructions WHERE id = ...` sorgusunu çalıştırdığı ve kaydı tamamen yok ettiği tespit edilmiştir.
2. `modules/supabase-entegrasyonu.js` içindeki `talimatOperations.deleteById(id)` servis metodunun da aynı şekilde kalıcı hard delete gerçekleştirdiği görülmüştür.
3. Görev 12.1'de veritabanına eklenen `durum` sütununun (`aktif`, `iptal`, `revize_edildi`) ve `arsiv.html`'deki durum filtrelerinin, bu kayıtları silmek yerine pasife (`iptal`) alarak saklamak için hazır bir altyapı sunduğu belirlenmiştir.

Bu raporda, hard delete işlemini veritabanını kirletmeden ve hiçbir kayıt kaybettirmeden bir **Soft Delete (`UPDATE durum = 'iptal'`)** mekanizmasına dönüştürme adımları ve UI arayüzü güncellemeleri planlanmıştır.

---

## 2. MEVCUT SİLME İŞLEMİNİN FORENSIC ANALİZİ

### 2.1. Arşiv Ekranındaki Olay Dinleyicisi (`arsiv.html`)
* **Dosya:** [arsiv.html](file:///c:/Users/admin/.gemini/antigravity-ide/scratch/HAVALE_EFT_TALIMATI/arsiv.html#L414-L421) (Satır 414-421 ve 516-523)
```javascript
// arsiv.html - Kart ve Liste Görünümü Event Listener
document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', function () {
        const instructionId = this.getAttribute('data-id');
        const instructionNumber = this.getAttribute('data-number');
        const instructionType = this.getAttribute('data-type');
        showDeleteConfirmation(instructionId, instructionNumber, instructionType);
    });
});
```
Kullanıcı butona bastığında `showDeleteConfirmation(...)` modal penceresini açmaktadır.

### 2.2. Modal ve Kalıcı Silme Sorgusu (`arsiv.html`)
* **Dosya:** [arsiv.html](file:///c:/Users/admin/.gemini/antigravity-ide/scratch/HAVALE_EFT_TALIMATI/arsiv.html#L678-L695) (Satır 678-695)
```javascript
// arsiv.html - Satır 679-695
async function deleteInstruction() {
    if (!instructionToDelete) return;

    try {
        confirmDeleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Siliniyor...';
        confirmDeleteBtn.disabled = true;

        // ⚠️ ADLİ KANIT: DOĞRUDAN HARD DELETE ÇAĞRISI!
        const { error } = await supabaseClient
            .from('payment_instructions')
            .delete()
            .eq('id', instructionToDelete);

        if (error) throw new Error(error.message);
        // ...
        alert('Talimat başarıyla silindi.');
    } catch (error) { ... }
}
```

### 2.3. Servis Katmanı Analizi (`modules/supabase-entegrasyonu.js`)
* **Dosya:** [modules/supabase-entegrasyonu.js](file:///c:/Users/admin/.gemini/antigravity-ide/scratch/HAVALE_EFT_TALIMATI/modules/supabase-entegrasyonu.js#L649-L665) (Satır 649-665)
```javascript
// modules/supabase-entegrasyonu.js Satır 649-665
async deleteById(id) {
    if (!supabaseClient || !supabaseClient.from) return;
    
    // ⚠️ ADLİ KANIT: Servis katmanı da kalıcı silme yapmaktadır
    const { error } = await supabaseClient
        .from('payment_instructions')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Talimat silinirken hata oluştu:', error.message);
        throw new Error(`Talimat silinemedi: ${error.message}`);
    }
}
```

---

## 3. "SOFT DELETE" (PASİFE ALMA / İPTAL) MİMARİ PLANI

### 3.1. Veritabanı Uyumluluğu
Görev 12.1 kapsamında `payment_instructions` tablosuna eklenen kısıt:
```sql
CHECK (durum IN ('aktif', 'iptal', 'revize_edildi'))
```
Veritabanı zaten `'iptal'` değerini yasal bir durum olarak kabul etmektedir. Yeni bir veritabanı migration'ına veya şema değişikliğine gerek yoktur.

### 3.2. Veritabanı Sorgusunun Dönüştürülmesi
`DELETE` sorgusu `UPDATE` sorgusuna dönüştürülecektir:
```javascript
// ESKİ (Hard Delete):
await supabaseClient.from('payment_instructions').delete().eq('id', instructionToDelete);

// YENİ (Soft Delete):
await supabaseClient.from('payment_instructions').update({ durum: 'iptal' }).eq('id', instructionToDelete);
```

### 3.3. Kullanıcı Arayüzü (UI) ve Modal Metinleri Güncellemesi
Onay modalı ve buton metinleri "Silme" kavramından "İptal Etme" kavramına geçirilecektir:

| Bileşen | Mevcut Metin / Davranış | Yeni Planlanan Metin / Davranış |
|:---|:---|:---|
| **Modal Başlığı** | `Talimatı Sil` | `Talimatı İptal Et` |
| **Modal Gövde Metni** | `Bu talimatı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.` | `Bu talimatı İPTAL ETMEK istediğinize emin misiniz?<br><small class="text-muted">İptal edilen talimatlar arşivde 'İptal' statüsünde saklanır ve finansal denetim izi korunur.</small>` |
| **Onay Butonu** | `Sil` (`btn-danger`) | `<i class="fas fa-ban me-1"></i> İptal Et` (`btn-danger`) |
| **Spinner / Loading** | `Siliniyor...` | `İptal Ediliyor...` |
| **Başarı Mesajı** | `Talimat başarıyla silindi.` | `Talimat başarıyla iptal edildi.` |
| **Hata Mesajı** | `Talimat silinirken hata oluştu:` | `Talimat iptal edilirken hata oluştu:` |

---

## 4. BUTON GİZLEME VE GÖRÜNÜM MANTIĞI (KART & LİSTE)

Bir talimat zaten `iptal` edilmiş veya `revize_edildi` durumundaysa, tekrar iptal edilemez veya revize edilemez. Dolayısıyla kırmızı çöp kutusu (İptal) ve sarı Revize Et butonları **SADECE `durum === 'aktif'`** olan talimatlar için gösterilmelidir.

### 4.1. Kart Görünümü (`renderCardView`)
* **Dosya:** [arsiv.html:L375-L386](file:///c:/Users/admin/.gemini/antigravity-ide/scratch/HAVALE_EFT_TALIMATI/arsiv.html#L375-L386)
* **Planlanan Mantık:**
```javascript
<div class="d-flex gap-2">
    <button class="btn btn-outline-primary btn-sm detail-btn flex-fill" data-id="${instruction.id}">
        <i class="fas fa-eye me-1"></i> Detay
    </button>
    ${durum === 'aktif' ? `
    <button class="btn btn-outline-warning btn-sm revize-btn" data-id="${instruction.id}" title="Bu talimatı revize et">
        <i class="fas fa-sync-alt me-1"></i> Revize Et
    </button>
    <button class="btn btn-outline-danger btn-sm delete-btn" data-id="${instruction.id}" data-number="${instruction.instruction_number || 'N/A'}" data-type="${instructionType}" title="Bu talimatı iptal et">
        <i class="fas fa-ban"></i> İptal Et
    </button>` : ''}
</div>
```

### 4.2. Liste Görünümü (`renderListView`)
* **Dosya:** [arsiv.html:L473-L485](file:///c:/Users/admin/.gemini/antigravity-ide/scratch/HAVALE_EFT_TALIMATI/arsiv.html#L473-L485)
* **Planlanan Mantık:**
```javascript
<td>
    <div class="d-flex gap-2">
        <button class="btn btn-outline-primary btn-sm detail-btn" data-id="${instruction.id}">
            <i class="fas fa-eye"></i> Detay
        </button>
        ${durum === 'aktif' ? `
        <button class="btn btn-outline-warning btn-sm revize-btn" data-id="${instruction.id}" title="Bu talimatı revize et">
            <i class="fas fa-sync-alt"></i> Revize
        </button>
        <button class="btn btn-outline-danger btn-sm delete-btn" data-id="${instruction.id}" data-number="${instruction.instruction_number || 'N/A'}" data-type="${instructionType}" title="Bu talimatı iptal et">
            <i class="fas fa-ban"></i> İptal
        </button>` : ''}
    </div>
</td>
```

### 4.3. Filtreleme ve Yaşam Döngüsü ile Etkileşim
1. `durumFilter` varsayılan olarak `aktif` olduğundan, bir talimat iptal edildiğinde hemen ardından çalışan `loadInstructions()` çağrısı ile o talimat **aktif arşiv listesinden otomatik olarak kaybolacaktır**.
2. Kullanıcı filtreyi `İptal Edilmiş` veya `Tümü` olarak değiştirdiğinde, iptal edilmiş talimat kırmızı `<span class="badge bg-danger">İptal</span>` rozetiyle görünecek; ancak üzerinde ne `Revize Et` ne de `İptal Et` butonu yer almayacaktır. Sadece `Detay` butonu kalacaktır.

---

## 5. SERVİS KATMANI GÜNCELLEMESİ (`modules/supabase-entegrasyonu.js`)

Harici modüllerin veya ilerideki geliştirmelerin veritabanından yanlışlıkla kalıcı silme yapmasını engellemek için servis katmanındaki `deleteById` metodu da soft delete yapacak şekilde güncellenecektir:
```javascript
async deleteById(id) {
    if (!supabaseClient || !supabaseClient.from) {
        console.warn('Supabase client not initialized, skipping cancel operation');
        return;
    }
    
    // Hard Delete yerine Soft Delete (durum = 'iptal')
    const { error } = await supabaseClient
        .from('payment_instructions')
        .update({ durum: 'iptal' })
        .eq('id', id);

    if (error) {
        console.error('Talimat iptal edilirken hata oluştu:', error.message);
        throw new Error(`Talimat iptal edilemedi: ${error.message}`);
    }
}
```

---

## 6. ADIM ADIM KODLAMA PLANI (UYGULAMA ÖNCESİ ONAY TABLOSU)

| Adım | Dosya | Yapılacak İşlem | Güvenlik / Etki |
|:---|:---|:---|:---|
| **1** | `arsiv.html` | Modal HTML başlık, gövde metni ve butonunu "Sil" -> "İptal Et" olarak güncelle | 🟢 UI Tutarlılığı |
| **2** | `arsiv.html` | `renderCardView()` içinde `.delete-btn` butonunu `${durum === 'aktif' ? ... : ''}` içine al ve ikonunu/metnini "İptal Et" yap | 🟢 Pasif Kayıt Koruma |
| **3** | `arsiv.html` | `renderListView()` içinde `.delete-btn` butonunu `${durum === 'aktif' ? ... : ''}` içine al ve metnini "İptal" yap | 🟢 Pasif Kayıt Koruma |
| **4** | `arsiv.html` | `deleteInstruction()` fonksiyonundaki `.delete()` çağrısını `.update({ durum: 'iptal' })` olarak güncelle; alert metinlerini revize et | 🟢 Hard Delete -> Soft Delete |
| **5** | `modules/supabase-entegrasyonu.js` | `talimatOperations.deleteById()` fonksiyonunu `.update({ durum: 'iptal' })` yapacak şekilde güncelle | 🟢 Servis Düzeyi Güvenlik |

---

## 7. ONAY TALEBİ

Yukarıdaki forensic analiz ve mimari plan doğrultusunda, **GÖREV 12.3 Kodlama Aşamasına** geçilmesi için onayınızı rica ederim.
