# ARAŞTIRMA VE MİMARİ PLAN RAPORU (GÖREV 8.6)
**Konu:** Supabase Sorgusunun Asılı Kalması (Pending) ve `withTimeout` Kalkanı Mimarisi  
**Tarih:** 12 Ekim 2026  
**Durum:** 🟡 Araştırma Tamamlandı — Onay Bekleniyor (Awaiting GO)

---

## 1. Yönetici Özeti ve Telemetri Bulguları

Görev 8.5 kapsamında geliştirilen Chunking (20'şerli paketleme) ve Concurrency Kilidi (`isBulkDeleteInProgress`) sayesinde **38 firmalık dev toplu silme işlemi başarıyla tamamlanmış** ve mükerrer istekler başarıyla engellenmiştir.

Ancak yapılan yeni testte, sadece **5 firma** seçilmesine rağmen işlem şu satırda takılmıştır:
```text
⏳ [BulkDelete] 2.1. Gönderici paketi sorgulanıyor (5 ID)...
```
Bu noktada Supabase istemcisi ne bir veri (`data`) ne de bir hata (`error`) döndürmüş, HTTP isteği tarayıcı ağ katmanında **sonsuza kadar "Pending" (askıda)** kalmıştır. Kullanıcı arayüzde tekrar sil butonuna bastığında ise haklı olarak `isBulkDeleteInProgress` kilidi uyarı vermiştir; çünkü önceki işlem hiçbir zaman sonlanmamıştır.

---

## 2. Forensic İnceleme: Neden Ufak Sorgularda Bile Asılı Kalma (Hanging) Yaşanır?

### A. Web API Standartlarında `fetch()` Timeout Yokluğu
1. **RFC & Tarayıcı Davranışı:** Modern tarayıcılardaki standart `window.fetch()` API'sinin **varsayılan bir timeout (zaman aşımı) süresi YOKTUR**. Fetch, sunucudan bir TCP RST (Reset) veya FIN (Finish) paketi gelmediği sürece sonsuza kadar beklemek üzere tasarlanmıştır.
2. **PostgREST & TCP Idle Drop:** WiFi, kurumsal güvenlik duvarı, proxy veya mobil ağ bağlantılarında, boşta kalan veya yanıtı geciken TCP soketleri ara ağ cihazları tarafından "sessizce düşürülebilir" (silent packet drop). Tarayıcı soketin koptuğunu anlayamaz ve HTTP isteğini sonsuz "Pending" statüsünde bekletir.
3. **Supabase-js İstemcisinin Durumu:** Supabase istemcisi arka planda doğrudan standart `fetch` kullanır ve sorgular için varsayılan bir iptal zamanlayıcısı (AbortController/Timeout) çalıştırmaz.

### B. Sonsuz Pending'in Sisteme Maliyeti
Sorgu askıda kaldığında:
- JavaScript `await` satırında sonsuza kadar donar.
- Fonksiyonun altındaki `catch` veya `finally` bloğu **ASLA ÇALIŞMAZ**.
- `isBulkDeleteInProgress = true` kilidi hafızada sonsuza kadar kilitli kalır.
- UI'daki buton "Siliniyor..." spinner'ında donar.
- Kullanıcı sayfayı `F5` ile yenilemeden bir daha asla silme işlemi yapamaz.

---

## 3. Mimari Çözüm: `Promise.race()` Tabanlı "Timeout Kalkanı" (`withTimeout`)

Bu sorunu çözmek için tüm kritik Supabase asenkron operasyonlarının etrafına **10 saniyelik (10000ms)** bir zaman aşımı kalkanı (wrapper) yerleştirilecektir.

### ⚠️ Kritik Forensic Keşif: Supabase Nesneleri Saf Promise Değil, "Thenable"dır!
Yapılan laboratuvar testinde hayati bir JavaScript detayı tespit edilmiştir:
- Supabase sorguları (`supabaseClient.from(...).select(...)`) doğrudan bir `Promise` örneği değildir.
- Supabase sorguları yalnızca `.then()` metoduna sahip olan bir **`PostgrestFilterBuilder` (Thenable)** nesnesidir; üzerinde yerel `.finally()` veya `.catch()` **BULUNMAZ**.
- Doğrudan `query.finally()` çağrılırsa tarayıcıda `TypeError: query.finally is not a function` hatası patlar.
- Bu nedenle `withTimeout` fonksiyonunda gelen sorgu mutlaka `Promise.resolve(promise)` ile standart ES6 Promise'e dönüştürülmelidir.

---

## 4. `withTimeout` Yardımcı Fonksiyonunun Tasarımı

`modules/supabase-entegrasyonu.js` içerisine eklenecek güvenli ve bellek sızıntısız (memory-leak free) timeout kalkanı:

```javascript
/**
 * Asenkron bir işlemi belirtilen süre içinde tamamlanmaya zorlar (Timeout Kalkanı)
 * Supabase thenable nesnelerini güvenle Promise'e sarar ve süre aşımında kontrollü hata fırlatır.
 * 
 * @param {Promise|Object} promise - Supabase sorgusu veya asenkron işlem
 * @param {number} ms - Zaman aşımı süresi (milisaniye, varsayılan: 10000ms = 10sn)
 * @param {string} label - Telemetri ve hata mesajı etiketi
 * @returns {Promise}
 */
const withTimeout = (promise, ms = 10000, label = 'İşlem') => {
    let timeoutId;
    
    // 10 saniye sonra patlayacak alarm Promise'i
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`⏱️ [Timeout] ${label} ${ms / 1000} saniye içinde sunucudan yanıt alamadı.`));
        }, ms);
    });

    // Promise.resolve ile Thenable desteği sağlanır; işlem bittiğinde alarm temizlenir (clearTimeout)
    return Promise.race([
        Promise.resolve(promise).finally(() => clearTimeout(timeoutId)),
        timeoutPromise
    ]);
};
```

---

## 5. `deleteBulk` Fonksiyonuna Entegrasyon Planı

`deleteBulk` içerisindeki 3 kritik veritabanı sorgusu `withTimeout` kalkanı ile sarılacaktır:

### 1. Gönderici Kontrolü Sorgusu:
```javascript
// ÖNCEKİ:
const { data, error } = await supabaseClient
    .from('payment_instructions')
    .select('gonderici_firma_id')
    .in('gonderici_firma_id', chunk);

// YENİ (Timeout Kalkanlı):
const { data, error } = await withTimeout(
    supabaseClient
        .from('payment_instructions')
        .select('gonderici_firma_id')
        .in('gonderici_firma_id', chunk),
    10000,
    `Gönderici kontrolü (Paket ${i + 1})`
);
```

### 2. Alıcı Kontrolü Sorgusu:
```javascript
// ÖNCEKİ:
const { data, error } = await supabaseClient
    .from('payment_instructions')
    .select('alici_firma_id')
    .in('alici_firma_id', chunk);

// YENİ (Timeout Kalkanlı):
const { data, error } = await withTimeout(
    supabaseClient
        .from('payment_instructions')
        .select('alici_firma_id')
        .in('alici_firma_id', chunk),
    10000,
    `Alıcı kontrolü (Paket ${i + 1})`
);
```

### 3. Sıralı Tekil Silme Sorgusu:
```javascript
// ÖNCEKİ:
const { error: deleteError } = await supabaseClient
    .from('firms')
    .delete()
    .eq('id', cleanId);

// YENİ (Timeout Kalkanlı):
const { error: deleteError } = await withTimeout(
    supabaseClient
        .from('firms')
        .delete()
        .eq('id', cleanId),
    10000,
    `Firma ID ${cleanId} silme işlemi`
);
```

---

## 6. Hata ve Kilit Zincirinin Kurtarılma Akışı (Fail-Safe)

Eğer ağ takılır ve 10 saniye geçerse ne olur?

1. `withTimeout`, `⏱️ [Timeout] ... 10 saniye içinde sunucudan yanıt alamadı` hatası fırlatır (`reject`).
2. `deleteBulk` fonksiyonundaki `catch (error)` bloğu devreye girer ve hatayı loglar.
3. **En Kritik Adım:** `deleteBulk`'ın `finally` bloğu anında çalışır:
   ```javascript
   } finally {
       isBulkDeleteInProgress = false; // KİLİT ANINDA ÇÖZÜLÜR!
   }
   ```
4. Hata `firmalar.js`'ye fırlar ve kullanıcıya net bir uyarı çıkar:  
   `"Toplu silme hatası: ⏱️ [Timeout] Gönderici kontrolü (Paket 1) 10 saniye içinde sunucudan yanıt alamadı."`
5. `ui-etkilesimleri.js`'nin `finally` bloğu çalışır ve butonu eski haline getirir:
   `deleteBtn.disabled = false`, `"Seçilenleri Sil (5)"`.
6. Sayfayı yenilemeye gerek kalmadan kullanıcı hemen tekrar deneyebilir veya bağlantısını kontrol edebilir!

---

## 7. Sonuç ve Onay Beklentisi

- Bu çözüm, tarayıcının ve ağ sağlayıcılarının asılı kalma (hang/pending) zafiyetini kökten çözmektedir.
- Kod değişikliği yalnızca `modules/supabase-entegrasyonu.js` dosyası ile sınırlı kalacaktır.
- Hazırlanan laboratuvar testinde fonksiyonun hem başarılı sorgularda hem de asılı kalan sorgularda kusursuz çalıştığı doğrulanmıştır.

Plan uygunsa **🟢 GO (ONAY)** vermeniz halinde kodlama adımına geçilecektir.
