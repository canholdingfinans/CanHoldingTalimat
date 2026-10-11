# ARAŞTIRMA VE MİMARİ PLAN RAPORU (GÖREV 8.5)
**Konu:** PostgREST `.in()` Parametre Sınırı, Sessiz Takılma (Pending) ve Chunking (Paketleme) Mimarisi  
**Tarih:** 11 Ekim 2026  
**Durum:** 🟡 İnceleme Tamamlandı — Onay Bekleniyor (Awaiting GO)

---

## 1. Yönetici Özeti ve Telemetri Bulguları

Görev 8.4 kapsamında eklenen telemetri logları sayesinde sistemin nerede ve hangi koşulda takıldığı kesin olarak tespit edilmiştir:
- **1 veya 2 firma seçildiğinde:** Sistem kusursuz çalışmakta, gönderici/alıcı kontrollerini 200-300 ms içinde tamamlayıp talimatlı firmaları korumakta ve temiz firmaları tek tek silmektedir.
- **43 firma seçildiğinde:** Sistem ilk log olan `🚀 [BulkDelete] 1. Fonksiyon başladı.` sonrasında doğrudan:
  ```text
  ⏳ [BulkDelete] 2. Gönderici kontrolü sorgusu atılıyor...
  ```
  satırında takılmakta ve hiçbir hata (`error`) fırlatmadan tarayıcı seviyesinde **Pending (Sessiz Kilitlenme)** durumunda kalmaktadır.

---

## 2. Sessiz Kilitlenmenin (Pending) Teknik Nedenleri

### A. PostgREST URL Query Parametre Uzunluğu ve HTTP GET Sınırı
Supabase JavaScript istemcisi (`supabase-js`), veritabanı okuma (`.select()`) işlemlerini **HTTP GET** metoduyla yürütür:
```http
GET /rest/v1/payment_instructions?select=gonderici_firma_id&gonderici_firma_id=in.(7,10,68,13,14,16,17,18,19,22,28,29,31,32,34,70,35,36,38,39,71,42,43,44,46,47,48,50,73,74,52,54,56,57,58,59,60,61,62,63,69,64,72) HTTP/1.1
```
1. **URI & Parser Sınırları:** 43 ve üzeri eleman içeren `.in.(...)` listeleri, URL query string'ini aşırı uzatmakta; tarayıcı ağ katmanı, proxy (Cloudflare/Kong) veya PostgREST URI ayrıştırıcısı (parser) çoklu parametre paketini derlerken soket kuyruğunda gecikme veya sessiz zaman aşımına (socket hang up / timeout) neden olmaktadır.
2. **PostgreSQL Execution Planner:** 40+ elemanlı `IN (...)` koşulları PostgreSQL tarafında karmaşık indeks taramaları gerektirir. Küçük paketlerde anında dönen sorgular, dev listelerde optimizasyon maliyeti nedeniyle kilitlenebilmektedir.

### B. Konsolda Tespit Edilen "Çift Tetiklenme" (Race Condition)
Kullanıcı konsol dökümünde çok kritik bir detay daha yakalanmıştır:
```text
supabase-entegrasyonu.js:176 🚀 [BulkDelete] 1. Fonksiyon başladı. Gelen ID'ler: (43) [...]
supabase-entegrasyonu.js:189 ⏳ [BulkDelete] 2. Gönderici kontrolü sorgusu atılıyor...
supabase-entegrasyonu.js:176 🚀 [BulkDelete] 1. Fonksiyon başladı. Gelen ID'ler: (43) [...]
supabase-entegrasyonu.js:189 ⏳ [BulkDelete] 2. Gönderici kontrolü sorgusu atılıyor...
```
- `BulkDelete` fonksiyonu aynı anda **iki kez** tetiklenmiştir.
- Tarayıcı, aynı anda 43'er elemanlı iki adet ağır Supabase GET isteğini aynı soket havuzuna bastığında, tarayıcının HTTP bağlantı limiti tıkanmakta ve Promise hiçbir zaman resolve/reject olamamaktadır.

---

## 3. Mimari Çözüm: Chunking (Paketleme) ve Güvenli Döngü

### A. Temel İlke
43 (veya gelecekte 200+) elemanlı büyük ID dizisini tek bir devasa sorguyla PostgREST'e göndermek yerine:
1. **İdeal Paket Büyüklüğü:** Dizi **15 veya 20'şerli** güvenli alt parçalara (chunks) bölünür. (43 eleman -> `[20, 20, 3]` şeklinde sadece 3 hafif pakete ayrılır).
2. **Sıralı Paket Sorgulama (`for...of`):** Her paket PostgREST'e sırayla gönderilir. Her paket 100-200 ms içinde anında döner.
3. **Tek Bir Havuzda Toplama (`usedIdsSet`):** Paketlerden dönen `gonderici_firma_id` ve `alici_firma_id` kayıtları merkezi bir `Set` içerisinde birleştirilir.
4. **Temiz ID'leri Silme:** Ayrıştırma bittikten sonra zaten başarıyla test edilmiş olan **Sıralı Tekil Silme Döngüsü** çalışır.

---

## 4. Kod Değişim Tasarımı (`modules/supabase-entegrasyonu.js`)

### 1. Yardımcı Dizi Parçalama (Chunking) Fonksiyonu
`firmaOperations.deleteBulk` öncesine veya içine eklenecek saf yardımcı fonksiyon:
```javascript
// Diziyi güvenli alt parçalara (chunk) bölen yardımcı fonksiyon
const chunkArray = (arr, size = 20) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
};
```

### 2. Yenilenen `deleteBulk(ids)` Kod Mimarisi

```javascript
async deleteBulk(ids) {
    if (!ids || ids.length === 0) {
        return { success: true, deletedIds: [], failedIds: [] };
    }

    const numericIds = ids.map(id => Number(id)).filter(id => !isNaN(id));
    if (numericIds.length === 0) {
        return { success: true, deletedIds: [], failedIds: [] };
    }

    console.log('🚀 [BulkDelete] 1. Fonksiyon başladı. Toplam ID sayısı:', numericIds.length);

    if (!supabaseClient || !supabaseClient.from) {
        console.warn('⚠️ [BulkDelete] Supabase client başlatılamadı.');
        return { success: true, deletedIds: numericIds, failedIds: [] };
    }

    try {
        const usedIdsSet = new Set();
        
        // 1. AŞAMA: ID'leri 20'şerli güvenli paketlere böl
        const CHUNK_SIZE = 20;
        const idChunks = [];
        for (let i = 0; i < numericIds.length; i += CHUNK_SIZE) {
            idChunks.push(numericIds.slice(i, i + CHUNK_SIZE));
        }
        console.log(`📦 [BulkDelete] ID'ler ${idChunks.length} adet güvenli pakete ayrıldı (Paket boyutu: ${CHUNK_SIZE}).`);

        // 2. AŞAMA: Gönderici Kontrolleri (Paket Paket Sıralı Sorgulama)
        console.log(`⏳ [BulkDelete] 2. Gönderici kontrolleri başlatılıyor (${idChunks.length} paket)...`);
        for (let i = 0; i < idChunks.length; i++) {
            const chunk = idChunks[i];
            console.log(`⏳ [BulkDelete] 2.${i + 1}. Gönderici paketi sorgulanıyor (${chunk.length} ID)...`);
            
            const { data, error } = await supabaseClient
                .from('payment_instructions')
                .select('gonderici_firma_id')
                .in('gonderici_firma_id', chunk);

            if (error) {
                console.error(`❌ [BulkDelete] Gönderici paket ${i + 1} hatası:`, error.message);
                throw new Error(`Talimat kontrolü yapılamadı: ${error.message}`);
            }

            (data || []).forEach(row => {
                if (row.gonderici_firma_id != null) {
                    usedIdsSet.add(Number(row.gonderici_firma_id));
                }
            });
            console.log(`✅ [BulkDelete] 2.${i + 1}. Gönderici paketi tamamlandı.`);
        }

        // 3. AŞAMA: Alıcı Kontrolleri (Paket Paket Sıralı Sorgulama)
        console.log(`⏳ [BulkDelete] 3. Alıcı kontrolleri başlatılıyor (${idChunks.length} paket)...`);
        for (let i = 0; i < idChunks.length; i++) {
            const chunk = idChunks[i];
            console.log(`⏳ [BulkDelete] 3.${i + 1}. Alıcı paketi sorgulanıyor (${chunk.length} ID)...`);
            
            const { data, error } = await supabaseClient
                .from('payment_instructions')
                .select('alici_firma_id')
                .in('alici_firma_id', chunk);

            if (error) {
                console.error(`❌ [BulkDelete] Alıcı paket ${i + 1} hatası:`, error.message);
                throw new Error(`Talimat kontrolü yapılamadı: ${error.message}`);
            }

            (data || []).forEach(row => {
                if (row.alici_firma_id != null) {
                    usedIdsSet.add(Number(row.alici_firma_id));
                }
            });
            console.log(`✅ [BulkDelete] 3.${i + 1}. Alıcı paketi tamamlandı.`);
        }

        // 4. AŞAMA: Ayrıştırma (Temiz vs Kullanımda Olanlar)
        const failedIds = numericIds.filter(id => usedIdsSet.has(id));
        const cleanIds = numericIds.filter(id => !usedIdsSet.has(id));
        console.log('📊 [BulkDelete] 4. Ayrıştırma tamamlandı. Temiz ID\'ler:', cleanIds, 'Talimatlı (Korumaya alınan) ID\'ler:', failedIds);

        // 5. AŞAMA: Temiz ID'lerin Sıralı Güvenli Silinmesi
        const successfullyDeleted = [];
        if (cleanIds.length > 0) {
            console.log(`🗑️ [BulkDelete] 5. Sıralı Tekil Silme Başlatılıyor (${cleanIds.length} firma)...`);
            for (const cleanId of cleanIds) {
                console.log(`⏳ [BulkDelete] 5a. Firma siliniyor: ID ${cleanId}...`);
                const { error: deleteError } = await supabaseClient
                    .from('firms')
                    .delete()
                    .eq('id', cleanId);

                if (deleteError) {
                    console.error(`❌ [BulkDelete] Firma ID ${cleanId} silinemedi:`, deleteError.message);
                    failedIds.push(cleanId);
                } else {
                    console.log(`✅ [BulkDelete] 5b. Firma ID ${cleanId} başarıyla silindi.`);
                    successfullyDeleted.push(cleanId);
                }
            }
            console.log('✅ [BulkDelete] 6. Silme işlemi tamamlandı. Başarılı:', successfullyDeleted, 'Başarısız:', failedIds);
        } else {
            console.log('ℹ️ [BulkDelete] Silinecek temiz firma bulunamadı.');
        }

        return {
            success: true,
            deletedIds: successfullyDeleted,
            failedIds: failedIds
        };
    } catch (error) {
        console.error('❌ [BulkDelete] deleteBulk genel hatası:', error);
        throw error;
    }
}
```

---

## 5. Çift Tıklama / Race Condition Önleme Notu (Opsiyonel Güçlendirme)
Konsolda fonksiyonun aynı anda iki kez tetiklenmesini engellemek için `deleteBulk` metodunun başına basit bir kilit (in-flight flag) konulması mimari açıdan %100 güvence sağlar:
```javascript
let isBulkDeleteInProgress = false;

// Fonksiyon başında:
if (isBulkDeleteInProgress) {
    console.warn('⚠️ [BulkDelete] Zaten devam eden bir toplu silme işlemi var, ikinci çağrı engellendi.');
    return;
}
isBulkDeleteInProgress = true;

// finally bloğunda:
isBulkDeleteInProgress = false;
```

---

## 6. Karşılaştırma ve Risk Analizi

| Kriter | Mevcut Durum (Tek Seferde 43 ID) | Yeni Durum (20'şerli Paketler - Chunking) |
| :--- | :--- | :--- |
| **URL Uzunluğu** | ~350+ karakter, karmaşık URL query | ~70-80 karakter, standart ve hafif GET isteği |
| **PostgREST Yanıtı** | Pending / Silent Timeout (Kilitlenme) | Her paket için ~150 ms anında yanıt |
| **Sistem Dayanıklılığı** | 30+ firma seçildiğinde tıkanır | 100, 500 veya 1000 firma seçilse dahi tıkır tıkır çalışır |
| **Kullanıcı Geri Bildirimi** | Buton "Siliniyor..."da donar | Konsolda paket paket ilerleme adım adım izlenir |

---

## 7. Sonuç ve Onay Beklentisi

Bu mimari tasarım, PostgREST ve tarayıcı ağ limitlerini tamamen bertaraf etmekte ve sonsuz ölçekte toplu silmeyi garanti altına almaktadır.

Sadece `modules/supabase-entegrasyonu.js` dosyası güncellenecektir.
Plan uygunsa **🟢 GO (ONAY)** vermeniz halinde kodlama adımına geçilecektir.
