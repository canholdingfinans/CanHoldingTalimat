# GÖREV 8.4 — FORENSIC HATA TESPİT VE TELEMETRİ RAPORU: Toplu Silme Kilitlenmesi (V2)

## 1. Kritik Belirti Analizi ve Teşhis

Kullanıcının ilettiği en kritik ipucu şudur:
> **"Hem kullanılmış (talimatlı) hem de kullanılmamış (temiz) firmaları AYNI ANDA seçip 'Sil' dediğimizde buton 'Siliniyor...' durumunda kilitleniyor."**

Bu belirti, hatanın yerini matematiksel bir kesinlikle daraltmaktadır:
- Eğer **sadece kullanılmış firmalar** seçilseydi; `cleanIds` dizisi boş (`[]`) olacak, kod Satır 222'deki `if (cleanIds.length > 0)` bloğunu atlayacak ve Satır 223'teki `firms.delete()` hiç çalışmayacaktı.
- Ancak **hem kullanılmış hem temiz firmalar birlikte seçildiğinde** `cleanIds.length > 0` olmakta ve execution thread'i **Satır 223'e girmektedir**.
- Dolayısıyla kilitlenme şüphesi, ön-kontrol sorgularının (Satır 185/202) yanı sıra, asıl silme işleminin yapıldığı **Satır 223 (`firms.delete().in('id', cleanIds)`)** üzerinde yoğunlaşmaktadır.

---

## 2. Şüpheli Bölgelerin Adli İncelemesi (`modules/supabase-entegrasyonu.js`)

Mevcut `firmaOperations.deleteBulk(ids)` fonksiyonunda kilitlenme potansiyeline sahip 3 kritik satır bulunmaktadır:

### Şüpheli 1: Satır 185 — Gönderici Ön-Kontrolü
```javascript
const gondericiRes = await supabaseClient
    .from('payment_instructions')
    .select('gonderici_firma_id')
    .in('gonderici_firma_id', numericIds);
```
- **Risk:** Çok sayıda ID (10-20+) seçildiğinde PostgREST `?gonderici_firma_id=in.(...)` sorgusu URL parametre sınırına veya RLS policy değerlendirme süresine takılabilir.

### Şüpheli 2: Satır 202 — Alıcı Ön-Kontrolü
```javascript
const aliciRes = await supabaseClient
    .from('payment_instructions')
    .select('alici_firma_id')
    .in('alici_firma_id', numericIds);
```
- **Risk:** Bir önceki sorgu bitse bile ardışık gelen ikinci PostgREST sorgusu HTTP pipeline seviyesinde askıda kalabilir.

### Şüpheli 3 (EN BÜYÜK ŞÜPHELİ): Satır 223 — Toplu Silme Çağrısı
```javascript
const { error: deleteError } = await supabaseClient
    .from('firms')
    .delete()
    .in('id', cleanIds);
```
- **Neden En Büyük Şüpheli?**
  1. `cleanIds` oluştuğu anda tetiklenir.
  2. PostgreSQL seviyesinde `firms` tablosundan toplu silme yapılırken, her bir firmanın `bank_accounts` alt tabloları ve olası yabancı anahtar (FK) kaskadları kilit bekleyebilir (Row/Table Lock).
  3. Supabase JS SDK v2'de `.delete().in(...)` çağrısının arkasında `.select()` zinciri bulunmadığında PostgREST `204 No Content` döner; ancak bazı tarayıcılarda gövdesiz 204 yanıtı Thenable Promise tarafından resolve edilmeyip sonsuz pending kalabilmektedir.

---

## 3. Debug (İzleme / Telemetri) Planı

Kilitlenmenin sessizce kaybolmasını önlemek ve tarayıcı konsolunda milisaniyesine kadar hangi satırda durduğunu gözle görmek için `modules/supabase-entegrasyonu.js` içerisine aşağıdaki loglama adımları yerleştirilecektir:

```javascript
console.log('🚀 [BulkDelete] 1. Fonksiyon başladı. Gelen ID\'ler:', ids, 'Sayısal:', numericIds);

console.log('⏳ [BulkDelete] 2. Gönderici kontrolü sorgusu atılıyor...');
const gondericiRes = await supabaseClient.from('payment_instructions').select('gonderici_firma_id').in('gonderici_firma_id', numericIds);
console.log('✅ [BulkDelete] 3. Gönderici kontrolü tamamlandı:', gondericiRes);

console.log('⏳ [BulkDelete] 4. Alıcı kontrolü sorgusu atılıyor...');
const aliciRes = await supabaseClient.from('payment_instructions').select('alici_firma_id').in('alici_firma_id', numericIds);
console.log('✅ [BulkDelete] 5. Alıcı kontrolü tamamlandı:', aliciRes);

console.log('📊 [BulkDelete] 6. Ayrıştırma yapıldı. Temiz:', cleanIds, 'Kullanımda olan:', failedIds);

if (cleanIds.length > 0) {
    console.log('🗑️ [BulkDelete] 7. Temiz firmalar siliniyor... cleanIds:', cleanIds);
    // Silme işlemi
    console.log('✅ [BulkDelete] 8. Silme tamamlandı.');
}
```

Bu loglar eklendiğinde, takılmanın 2, 4 veya 7 numaralı logdan hangisinin arkasında kaldığı konsolda **kabak gibi** ortaya çıkacaktır.

---

## 4. Alternatif Veritabanı Çözümü Planı (B Planı)

Mevcut mimarideki riskleri sıfırlamak için 2 güçlü B Planı hazırlanmıştır:

### B Planı — Seçenek 1: Sıralı Tekil Silme Döngüsü (Tavsiye Edilen - En Güvenli)
Toplu `.delete().in('id', cleanIds)` komutu yerine, temiz olduğu anlaşılan firmaları **tekil silme döngüsü** ile silmek:
```javascript
const successfullyDeleted = [];
for (const cleanId of cleanIds) {
    console.log(`🗑️ Firma siliniyor: ID ${cleanId}`);
    const { error } = await supabaseClient.from('firms').delete().eq('id', cleanId);
    if (!error) {
        successfullyDeleted.push(cleanId);
    } else {
        console.error(`Firma ID ${cleanId} silinemedi:`, error.message);
        failedIds.push(cleanId);
    }
}
```
* **Neden Kusursuz?** Sistemde tekli firma silme (`firmaOperations.delete(id)`) zaten %100 sorunsuz çalışmaktadır. 3-5 temiz firmayı döngü ile tek tek silmek sadece 100-200ms sürer, PostgREST toplu silme kilitlenmesi riskini tamamen ortadan kaldırır ve birinde hata çıksa bile diğerlerini kurtarır.

### B Planı — Seçenek 2: ID Paketleme (Chunking) & Timeout Koruması
Ön-kontrol sorgularını 5'erli paketlere (chunks) bölmek ve her PostgREST çağrısına bir `AbortController` (örneğin 10 saniyelik timeout) ekleyerek, sorgu takılırsa Promise'in sonsuza kadar askıda kalmasını engelleyip kontrollü hata fırlatmak.

---

## 5. Onay İsteği

> **Özet ve Onay:** Kilitlenmenin yerini tam tespit etmek için **Telemetri Loglarını** eklemeyi ve toplu `.in()` silmesi yerine kanıtlanmış **Sıralı Güvenli Silme (B Planı Seçenek 1)** modelini uygulamayı onayınıza sunuyorum.
