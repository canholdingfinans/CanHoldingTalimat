1. Öncelikli Görevler (Sprint 1)
1.1. Modül: Altyapı ve Veritabanı Kurulumu
[x] Görevin Adı: Supabase Projesi Oluşturma ve Veritabanı Tasarımı

Açıklama: Projenin temelini oluşturacak olan Supabase projesinin kurulumu ve veritabanı tablolarının, ilişkileriyle birlikte oluşturulması.

Alt Görevler:

[x] Supabase'de yeni bir proje başlat.

[x] firms tablosu (firma adı, türü: grup/satıcı/müşteri) oluştur.

[x] bank_accounts tablosu (IBAN, hesap numarası, para birimi, firm_id ilişkisi) oluştur.

[x] payment_instructions tablosu (talimat numarası, gönderici/alıcı bilgileri, tutar) oluştur.

[~] firm_assets tablosu (antetli kağıt, kaşe dosyaları, firm_id ilişkisi) oluştur.

Öncelik: 🔥 Yüksek

[x] Görevin Adı: Kullanıcı Arayüzü İçin Temel Bileşenleri Oluşturma

Açıklama: Belirtilen arayüz tasarımına uygun olarak, temel HTML, CSS ve JavaScript bileşenlerini hazırlama.

Alt Görevler:

[x] Sol taraf için firma listesini barındıran akordiyon sidebar yapısını oluştur.

[x] Firma ekleme, düzenleme ve silme işlemlerini gerçekleştirecek modal pencerelerini tasarla.

[x] Firma türüne göre filtreleme ve arama kutusu bileşenlerini ekle.

[x] Orta bölümdeki talimat türü seçim menüsü için akordiyon yapısını oluştur.

Öncelik: 🔥 Yüksek

2. İkinci Öncelik (Sprint 2)
2.1. Modül: Güvenlik ve İş Mantığı
[~] Görevin Adı: Talimat ve Para Birimi Doğrulaması

Açıklama: Güvenlik gereksinimlerini karşılamak üzere, mükerrer hareket ve para birimi farklılıkları için kontrol mekanizmalarını Supabase üzerinde uygulama.

Alt Görevler:

[~] Mükerrer Hareket Kontrolü: Talimat kaydetme öncesinde, aynı firma için aynı ödemenin mükerrer olup olmadığını kontrol eden bir function yaz.

[x] IBAN Doğrulama: Girilen IBAN'ın 26 hane kuralına uygunluğunu kontrol et.

[x] Para Birimi Kontrolü: Gönderici ve alıcı hesaplarının para birimlerinin farklı olması durumunda kullanıcıya uyarı göster.

Bağımlılıklar: payment_instructions tablosu

Öncelik: 🔥 Yüksek

[~] Görevin Adı: Dinamik Talimat Formları ve Görselleştirme

Açıklama: Seçilen talimat türüne göre formun ve sağ taraftaki önizleme alanının dinamik olarak değişmesini sağlama.

Alt Görevler:

[x] Talimat türü seçimine göre orta bölümde farklı form alanları (örneğin, "Vergi Türü") göster.

[x] Form verileri değiştikçe, sağdaki önizleme alanını anlık olarak güncelle.

[~] Görüntüle, Yazdır ve Kaydet butonlarının işlevselliğini tanımla.

Öncelik: ⚡ Orta

[~] Görevin Adı: Sıralı Talimat Numarası Sistemi

Açıklama: Her yeni talimat için benzersiz ve sıralı bir talimat numarası atama.

Öncelik: ⚡ Orta

3. Gelecek Sprintler (Yol Haritası)
3.1. Modül: Çıktı ve Arşivleme
[ ] Görevin Adı: Antetli Kağıda PDF Çıktısı Oluşturma

Açıklama: Antetli kağıt ve kaşe görsellerini kullanarak, oluşturulan talimatı PDF formatında çıktı alabilecek bir sistem geliştirme.

Alt Görevler:

[ ] Supabase Edge Function oluştur.

[ ] Fonksiyonun puppeteer veya playwright kütüphanesiyle HTML'i PDF'e çevirmesini sağla.

[ ] Oluşturulan PDF'i Supabase Storage'a kaydet ve kullanıcıya indirme bağlantısı sun.

[ ] "Yazdır" butonu için tarayıcının yazdırma işlevini tetikle.

Öncelik: ⚡ Orta

[~] Görevin Adı: Talimat Arşivi Modülü

Açıklama: Kaydedilen tüm talimatların listelendiği, filtrelenebildiği ve detaylarının görüntülenebildiği bir arşiv sayfası oluşturma.

Alt Görevler:

[~] arsiv.html adında yeni bir HTML sayfası oluştur.

[~] supabase-entegrasyonu.js modülünü kullanarak Supabase'den tüm talimat verilerini çek.

[~] JavaScript kullanarak talimat türü, tarih veya diğer özelliklere göre filtreleme işlevleri ekle.

[~] Her talimat için "Detay" butonu ekle ve Bootstrap modal veya yeni bir sayfa içinde talimatın tüm ayrıntılarını göster.

Öncelik: 🌀 Düşük

[x] Görevin Adı: Yeni Talimat Türü: Cari Hesap Ödemesi

Açıklama: Mevcut talimatlar.js ve firmalar.js modüllerinin işlevselliğini genişletmek ve kullanıcıya dinamik olarak farklı formlar yükleyebilen yeni bir talimat türü eklemek.

Alt Görevler:

[x] Navbar ve Kullanıcı Arayüzü Güncellemesi: Talimat Türü menüsüne "Cari Hesap Ödemesi" kategorisi ve alt seçeneklerini ekle.

[x] Dinamik Form Alanları: Kullanıcı seçimine göre alıcı firma listesini filtrele (Satıcı/Müşteri).

[x] Çoklu Ödeme İşlevi: "Yeni Ödeme Ekle" butonu ile dinamik form oluşturma.

[x] Veri Yönetimi: Ödeme verilerini toplama ve işleme.

[x] Supabase Entegrasyonu: Veritabanı şeması ve CRUD fonksiyonları güncelleme.

Öncelik: 🔥 Yüksek

[ ] Görevin Adı: Detaylı Firma Yönetimi

Açıklama: Firmaların türüne göre (Grup, Satıcı, Müşteri) kategorize edilmesi ve sol menüde gösterilmesi.

Öncelik: 🌀 Düşük

Supabase Tabloları (Güncel):

Aşağıdaki tablo yapıları, projenin (`script.js`) kullandığı mevcut ve doğru şemayı yansıtmaktadır.

**1. `firms` Tablosu**
*   `id`: `bigint` (Primary Key, Otomatik artan)
*   `name`: `text` (Firma adı)
*   `turu`: `text` (Firma türü: "grup", "satıcı", "müşteri")

**2. `bank_accounts` Tablosu**
*   `id`: `bigint` (Primary Key, Otomatik artan)
*   `firm_id`: `bigint` (Foreign Key -> `firms.id`)
*   `banka_adi`: `text` (Banka adı)
*   `sube_adi`: `text` (Şube adı)
*   `sube_il`: `text` (Şubenin bulunduğu il)
*   `iban`: `text` (IBAN numarası, benzersiz olmalı)
*   `para_birimi`: `text` (Para birimi: "TRY", "USD", "EUR" vb.)
*   `hesap_no`: `text` (Hesap numarası, opsiyonel)
*   `swift_kodu`: `text` (SWIFT/BIC kodu, dış transferler için opsiyonel)

**SWIFT Kodu Güvenlik Kuralları:**
- ✅ Sadece 8 veya 11 haneli kodlara izin verilir (9, 10, 12+ hane yasaktır)
- ✅ Yalnızca büyük harfler (A-Z) ve rakamlar (0-9) kabul edilir
- ✅ Gerçek zamanlı doğrulama ve görsel geri bildirim
- ✅ Hem frontend (JavaScript) hem backend (PostgreSQL) doğrulaması
- ✅ Veritabanı seviyesinde CHECK constraint ile güvenlik
- ⚠️ Dış transfer işlemlerinde kullanım önerilir, iç transferlerde isteğe bağlı

**3. `payment_instructions` Tablosu**
*   `id`: `bigint` (Primary Key, Otomatik artan)
*   `instruction_number`: `bigint` (Otomatik artan sıralı talimat numarası, Sequence'den gelir)
*   `gonderici_firma_id`: `bigint` (Foreign Key -> `firms.id`)
*   `gonderici_banka_hesap_id`: `bigint` (Foreign Key -> `bank_accounts.id`)
*   `alici_firma_id`: `bigint` (Foreign Key -> `firms.id`, Vergi ödemesinde `null` olabilir)
*   `alici_banka_hesap_id`: `bigint` (Foreign Key -> `bank_accounts.id`, Vergi ödemesinde `null` olabilir)
*   `tutar`: `numeric` (İşlem tutarı)
*   `para_birimi`: `text` (İşlem para birimi)
*   `aciklama`: `text` (İşlem açıklaması)
*   `talimat_tarihi`: `timestamp with time zone` (Talimatın oluşturulduğu tarih)
*   `talimat_turu`: `text` ("Havale/EFT" veya "Vergi Ödemesi")
*   `vergi_turu`: `text` (Sadece `talimat_turu` "Vergi Ödemesi" ise kullanılır)
*   `vergi_dairesi`: `text` (Sadece `talimat_turu` "Vergi Ödemesi" ise kullanılır)
*   `vergi_kimlik_no`: `text` (Sadece `talimat_turu` "Vergi Ödemesi" ise kullanılır)
*   `sgk_sicil_no`: `text` (Opsiyonel, SGK ödemeleri için)
*   `gumruk_beyanname_no`: `text` (Opsiyonel, Gümrük ödemeleri için)
*   `tahakkuk_no`: `text` (Opsiyonel, Vergi/SGK tahakkuk no için)

**4. `firm_assets` Tablosu (Gelecek Sprintler İçin Planlanan)**
*Bu tablo henüz kodda kullanılmamaktadır.*
*   `id`: `bigint` (Primary Key, Otomatik artan)
*   `firm_id`: `bigint` (Foreign Key -> `firms.id`)
*   `letterhead_url`: `text` (Antetli kağıt dosyasının URL'si)
*   `stamp_url`: `text` (Kaşe dosyasının URL'si)