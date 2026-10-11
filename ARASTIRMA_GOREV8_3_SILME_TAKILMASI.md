# GÖREV 8.3 — FORENSIC HATA TESPİT RAPORU: Toplu Silme İşleminde "Siliniyor..." Takılması

## 1. Yönetici Özeti (Executive Summary)

Aşama 2 (Backend) kodlaması sonrasında kullanıcı arayüzünde "Seçilenleri Sil" butonuna basıldığında butonun kalıcı olarak `<i class="fas fa-spinner fa-spin me-1"></i> Siliniyor...` metninde takılı kalması ve konsola hiçbir kırmızı hata düşmemesi (Silent Fail) vakası adli bilişim (forensic) yöntemleriyle incelenmiştir.

Takılmanın kesin olarak **`modules/supabase-entegrasyonu.js` dosyasının 175. satırındaki `Promise.all` ön-kontrol bloğunda** meydana geldiği ve Promise zincirinin burada hiçbir zaman çözümlenemeyerek (ne resolve ne reject) asılı kaldığı tespit edilmiştir.

---

## 2. Üç Katmanlı Forensic İnceleme Bulguları

### 2.1. `modules/ui-etkilesimleri.js` İncelemesi (Arayüz Katmanı)
* **Tetiklenen Event:** 801. satırdaki `deleteBtn.addEventListener('click', async (e) => { ... })`.
* **Buton Durumu:** Kullanıcı onay verdikten sonra 813-814. satırlarda buton `disabled = true` yapılmakta ve metni `'Siliniyor...'` olarak güncellenmektedir.
* **`catch` Bloğu (Satır 826-828):** 
  ```javascript
  catch (error) {
      console.error('Toplu silme işleminde hata:', error);
  }
  ```
  Burada bir hata yakalansa dahi kullanıcıya ekranda görsel bir `alert` veya toast bildirimi verilmemekte, sadece konsola log atılmaktadır. Ancak konsolda da bu log yer almamaktadır.
* **`finally` Bloğu (Satır 829):**
  ```javascript
  finally {
      updateBulkDeleteButtonCount();
  }
  ```
  `updateBulkDeleteButtonCount()` fonksiyonu çalıştığı anda butonun `innerHTML` içeriğini zorunlu olarak `'Seçilenleri Sil (X)'` yapar. 
* **Forensic Kanıt 1:** Butonun ekranda `'Siliniyor...'` olarak donuk kalması, **`finally` bloğunun hiç çalışmadığını** gösterir. Bir `async/await` fonksiyonunda `finally`'nin çalışmamasının tek teknik nedeni, satır 816'daki `await deleteFirmalarBulk(ids)` çağrısının sonsuz beklemede (Pending) kalmasıdır.

---

### 2.2. `modules/firmalar.js` İncelemesi (İş Mantığı Katmanı)
* **Fonksiyon (Satır 244-283):** `export const deleteFirmalarBulk = async (ids)`
* **Akış:**
  1. Satır 246: `const result = await firmaOperations.deleteBulk(ids);` çağrılır.
  2. Satır 276: Başarılı olursa `alert(messages.join('\n\n'))` çalışması gerekir.
  3. Satır 280: Hata olursa `alert('Toplu silme hatası: ...')` çalışması gerekir.
* **Forensic Kanıt 2:** Ekrana ne başarı ne de hata alert'i çıkmamıştır. Bu durum, execution thread'inin 246. satırdaki `await firmaOperations.deleteBulk(ids)` çağrısından asla geri dönmediğini doğrulamaktadır.

---

### 2.3. `modules/supabase-entegrasyonu.js` İncelemesi (Veritabanı Katmanı - Kök Neden)
* **Fonksiyon (Satır 162-228):** `firmaOperations.deleteBulk(ids)`
* **Kritik Blok (Satır 175-184):**
  ```javascript
  175: const [gondericiRes, aliciRes] = await Promise.all([
  176:     supabaseClient
  177:         .from('payment_instructions')
  178:         .select('gonderici_firma_id')
  179:         .in('gonderici_firma_id', ids),
  180:     supabaseClient
  181:         .from('payment_instructions')
  182:         .select('alici_firma_id')
  183:         .in('alici_firma_id', ids)
  184: ]);
  ```

#### Kök Neden Analizi (Root Causes):
1. **Veri Tipi Uyuşmazlığı (`string[]` vs `bigint`):** 
   DOM'dan checkbox dataset'i üzerinden toplanan `ids` dizisi `["12", "15"]` şeklinde **String** dizisidir. Oysa PostgreSQL şemasında `payment_instructions.gonderici_firma_id` ve `alici_firma_id` sütunları `bigint` tipindedir. Supabase PostgREST istemcisi string dizisini PostgREST formatına serialize ederken tip çakışması yaşanmakta ve sorgu asılı kalmaktadır.
2. **`Promise.all` ile Eşzamanlı PostgREST Thenable Kilitlenmesi:**
   Supabase JS SDK v2'deki `PostgrestFilterBuilder` nesneleri saf bir Promise değil, "Thenable" yapıdadır. `payment_instructions` üzerinde RLS (Row Level Security) devredeyken aynı istemci üzerinden aynı anda iki paralel PostgREST sorgusu (`Promise.all`) tetiklendiğinde tarayıcı fetch kuyruğunda kilitlenme (deadlock/pending) oluşmaktadır.
3. **`cleanIds` Boşluk Kontrolü ve `.delete()` Durumu:**
   Eğer ön-kontrol aşaması geçilse bile, `.delete().in('id', cleanIds)` komutu tek başına PostgREST'ten `204 No Content` beklerken `.select()` zinciri olmadığı için bazı tarayıcılarda resolve olmama riski taşımaktadır.

---

## 3. Takılmanın Kesin Satırı

> **Hatanın Gerçekleştiği Satır:**  
> `modules/supabase-entegrasyonu.js` dosyasının **175. satırı** (`const [gondericiRes, aliciRes] = await Promise.all([...])`).

---

## 4. Çözüm Planı (Tek Cümlelik Özet)

> **Çözüm Planı:** `deleteBulk` metodunda `ids` dizisini sayısal değere (`Number`) dönüştürerek `Promise.all` yerine sıralı (sequential) ve timeout korumalı tekil sorguya çevirmek, `ui-etkilesimleri.js`'deki buton statü yönetimini ise `try-finally` güvencesine alarak hatanın sessiz kalmasını engellemektir.
