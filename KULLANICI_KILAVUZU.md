# CAN HOLDİNG FİNANSAL TALİMAT YÖNETİM SİSTEMİ
## KULLANICI KILAVUZU (USER MANUAL)

**Sürüm:** 2.0 (Kurumsal Sürüm)  
**Tarih:** Ekim 2026  
**Hedef Kitle:** Can Holding Finans Departmanı, Muhasebe Birimi ve Yetkili Yöneticiler  

---

## 🧭 HIZLI BAŞLANGIÇ: İŞLEM YÖNLENDİRME HARİTASI

Finans veya muhasebe işlemi yapmak istediğinizde, doğrudan aşağıdaki yönlendirmeleri izleyerek doğru ekrana ulaşabilirsiniz:

| Yapmak İstediğiniz İşlem | İzlenecek Menü Yolu | Açıklama |
|:---|:---|:---|
| **Grup Şirketler İçi Transfer (Virman)** | `Talimat Türü` > `Havale/EFT Talimatları` > `İç Transfer` | Holding grup şirketlerinin kendi hesapları arasındaki para aktarımları. |
| **Dış Transfer (Üçüncü Şahıs / Tedarikçi)** | `Talimat Türü` > `Havale/EFT Talimatları` > `Dış Transfer` | Dış piyasa firmalarına yapılan tekil havale ve EFT işlemleri. |
| **Satıcı / Tedarikçi Cari Ödemesi** | `Talimat Türü` > `Cari Hesap Ödemeleri` > `Satıcı Ödemesi` | Birden fazla tedarikçiye toplu fatura ve cari hesap ödemeleri. |
| **Müşteri Cari İade / Ödemesi** | `Talimat Türü` > `Cari Hesap Ödemeleri` > `Müşteri Ödemesi` | Müşterilere yapılan cari mahsup veya iade ödemeleri. |
| **KDV-1 / KDV-2 Tevkifat Ödemesi** | `Talimat Türü` > `Vergi Ödemeleri` > `KDV-1` veya `KDV-2` | Aylık katma değer vergisi ve tevkifat beyanname ödemeleri. |
| **Muhtasar Vergi Ödemesi** | `Talimat Türü` > `Vergi Ödemeleri` > `Muhtasar Hizmet` / `Muhtasar Ücret` | Kira, serbest meslek ve ücret stopaj vergisi ödemeleri. |
| **Geçici Vergi / Damga / GEKAP** | `Talimat Türü` > `Vergi Ödemeleri` > `Kurumlar Geçici`, `Damga` veya `Gekap` | Dönemsel geçici kurumlar vergisi, damga pulu ve çevre harçları. |
| **SGK Prim Ödemesi** | `Talimat Türü` > `SGK Ödemeleri` > `SGK Primi` | Aylık personel SGK prim ve idari ödemeleri. |
| **Gümrük Vergisi ve İthalat Harçları** | `Talimat Türü` > `Gümrük Ödemeleri` > `Gümrük Vergisi`, `ÖTV` veya `İthalat Harcı` | İthalat beyannamelerine bağlı vergi, harç ve gümrük ödemeleri. |
| **Döviz Alım İşlemi (TL -> Döviz)** | `Talimat Türü` > `Döviz İşlemleri` > `Döviz Alım` | TL hesabından döviz (USD, EUR vb.) satın alma talimatı. |
| **Döviz Satım İşlemi (Döviz -> TL)** | `Talimat Türü` > `Döviz İşlemleri` > `Döviz Satım` | Döviz hesabından döviz bozdurarak TL hesabına aktarma talimatı. |
| **Eski / Hatalı Talimatı Düzeltme (Revizyon)** | `Talimat Arşivi` > Talimat Kartı > `Revize Et` Butonu | Hatalı oluşturulmuş talimatı bilgileriyle yeni forma çekip düzeltme. |
| **Hatalı Talimatı İptal Etme (Soft Delete)** | `Talimat Arşivi` > Talimat Kartı > `İptal Et` Butonu | Talimatı denetim izini koruyarak iptal statüsüne alma. |
| **Toplu Firma Listesi Yükleme** | Sol Panel > `Toplu Firma Yükle (Excel)` | Excel dosyasından tek seferde yüzlerce firma ve cari kartı sisteme aktarma. |

---

## İÇİNDEKİLER

1. [Sisteme Giriş ve Departman Yönetimi](#1-sisteme-giriş-ve-departman-yönetimi)
2. [Firma ve Banka Hesabı Yönetimi (Sol Panel)](#2-firma-ve-banka-hesabı-yönetimi-sol-panel)
3. [Talimat Oluşturma İşlemleri (Merkezi Form)](#3-talimat-oluşturma-işlemleri-merkezi-form)
4. [Talimat Çıktısı, Yazdırma ve Banka İmza Süreci](#4-talimat-çıktısı-yazdırma-ve-banka-imza-süreci)
5. [Talimat Arşivi ve İzleme](#5-talimat-arşivi-ve-i̇zleme)
6. [Akıllı Revizyon (Düzeltme) Mekanizması](#6-akıllı-revizyon-düzeltme-mekanizması)
7. [Talimat İptali (Soft Delete ve Denetim İzi)](#7-talimat-i̇ptali-soft-delete-ve-denetim-i̇zi)
8. [Sıkça Karşılaşılan Sorular ve Çözüm Rehberi (SSS)](#8-sıkça-karşılaşılan-sorular-ve-çözüm-rehberi-sss)
9. [Destek ve Yetkilendirme](#9-destek-ve-yetkilendirme)

---

## 1. SİSTEME GİRİŞ VE DEPARTMAN YÖNETİMİ

### 1.1. Sisteme Erişim ve Oturum Açma
1. Web tarayıcınızdan kurum içi uygulama adresine (`https://can-holding-talimat.web.app`) giriniz.
2. Giriş ekranında **Kullanıcı Adı** alanına şirket e-posta ön adınızı (Örn: `ahmet.yilmaz`) veya tam e-posta adresinizi giriniz.
3. Şifrenizi yazdıktan sonra **Giriş Yap** butonuna basınız.

ℹ️ **BİLGİ:** Sisteme başarılı giriş yapıldığında, kullanıcı yetkileriniz merkezi sistemden otomatik olarak taranır ve arayüz yetkili olduğunuz bölümlere göre hazırlanır.

---

### 1.2. Yetkili Departman Yapısı (ENJ ve TCT)
Can Holding bünyesindeki faaliyetler iki ana bölüm (prefix) altında yürütülmektedir:
* **ENJ:** Can Enerji Grubu ve bağlı enerji şirketleri.
* **TCT:** Tectone Grubu ve bağlı teknoloji/üretim şirketleri.

#### A. Tek Departman Yetkisi Bulunan Kullanıcılar
Yalnızca tek bir bölüme (Örn: sadece ENJ) yetkili olan personelin ekranında departman seçim kutusu gizlenir. Sistem, oluşturulacak tüm talimatlara kullanıcının yetkili olduğu bölüm kodunu otomatik olarak uygular.

#### B. Çoklu Departman Yetkisi Bulunan Kullanıcılar (Çapraz Yetki)
Hem ENJ hem TCT grubunda işlem yetkisi bulunan kullanıcıların formunun üzerinde **"Talimat Bölümü (Zorunlu)"** başlıklı seçim kutusu görünür:
* İşlem yapmak istediğiniz şirketin ait olduğu departmanı (**ENJ** veya **TCT**) radyo butonu ile seçiniz.
* **Kritik Kural:** Seçilen radyo butonu, oluşturulacak talimatın numarasını (Örn: `ENJ-2026-0001` veya `TCT-2026-0001`) belirler.

⛔ **KRİTİK KURAL (KAT İZOLASYON):**  
"Talimat Bölümü" olarak **ENJ** seçildiğinde, Gönderici Firma listesinde **yalnızca ENJ grubuna ait firmalar** yer alır; TCT firmaları listelenmez. TCT seçildiğinde ise yalnızca TCT firmaları listelenir. Başka bir departmanın firmasından para çıkışı yapılması sistem tarafından tamamen engellenmiştir.

---

## 2. FİRMA VE BANKA HESABI YÖNETİMİ (SOL PANEL)

Ana ekranın sol tarafında yer alan dikey panel, sistemde kayıtlı tüm şirket, tedarikçi, müşteri ve banka hesaplarının yönetildiği alandır.

### 2.1. Firma Listesinde Arama ve Filtreleme
* **Arama Çubuğu:** Firmanın adını veya VKN numarasını yazarak anında hızlı filtreleme yapabilirsiniz.
* **Tür Filtresi:** Açılır menüden `Grup Firmaları`, `Satıcılar` veya `Müşteriler` seçeneğini işaretleyerek yalnızca ilgili kategorideki firmaları listeleyebilirsiniz.
* **Firma Akordiyonu:** Firmanın adına tıkladığınızda, o firmaya ait kayıtlı tüm banka hesapları, IBAN numaraları ve para birimleri aşağı doğru açılır.

---

### 2.2. Yeni Firma Tanımlama Adımları
1. Sol panelin en üstünde yer alan yeşil **"+ Yeni Firma Ekle"** butonuna basınız.
2. Açılan pencerede aşağıdaki alanları doldurunuz:
   * **Firma Adı (Zorunlu):** Firmanın resmi ticaret unvanı.
   * **Firma Türü (Zorunlu):**
     * `Grup`: Can Holding bünyesindeki öz şirketler.
     * `Satıcı`: Mal/hizmet alınan dış tedarikçiler.
     * `Müşteri`: Mal/hizmet satılan müşteriler.
   * **Firma Bölümü (Zorunlu):**
     * `Sadece Enerji (ENJ)`: Firmanın sadece ENJ talimatlarında gönderici olabilmesini sağlar.
     * `Sadece Tectone (TCT)`: Firmanın sadece TCT talimatlarında gönderici olabilmesini sağlar.
     * `Ortak`: Her iki bölüm tarafından görüntülenebilir (Örn: genel tedarikçiler).
   * **VKN / T.C. Kimlik No:** 10 haneli vergi kimlik numarası veya 11 haneli T.C. kimlik numarası.
   * **Vergi Dairesi:** Firmanın bağlı bulunduğu vergi dairesi.
   * **SGK Sicil Numarası & SGK Adı:** SGK ödemelerinde otomatik gelmesi için tanımlanır.
3. **Kaydet** butonuna basarak işlemi tamamlayınız.

---

### 2.3. Firmaya Banka Hesabı Tanımlama ve Düzenleme
Bir firmanın üzerinden talimat oluşturabilmek için en az bir banka hesabı tanımlı olmalıdır:
1. Sol listeden ilgili firmayı bulunuz ve sağındaki **"+ Banka Ekle"** butonuna basınız.
2. Açılan formda:
   * **Banka Adı:** Açılır listeden bankayı seçiniz (Garanti, Akbank, İş Bankası, Yapı Kredi, Ziraat vb.).
   * **Şube Adı ve İl:** Hesabın bağlı olduğu şube ve şehir bilgisi.
   * **Para Birimi (Zorunlu):** `TRY`, `USD`, `EUR`, `GBP` veya `CHF` seçiniz.
   * **IBAN (Zorunlu):** `TR` ile başlayan 26 haneli IBAN numarasını giriniz.
   * **SWIFT Kodu (Opsiyonel):** Yurt dışı transferleri için 8 veya 11 haneli uluslararası banka kodu.
3. **Kaydet** butonuna basınız.

⚠️ **DİKKAT:** Transfer işlemlerinde gönderici ve alıcı hesapların **para birimleri aynı olmalıdır**. TRY hesabından EUR hesabına doğrudan havale yapılamaz; bu işlem için `Döviz Alım/Satım` modülü kullanılmalıdır.

---

### 2.4. Excel ile Toplu Firma Yükleme
Yüzlerce tedarikçi veya müşteri kartını sisteme tek tek girmek yerine Excel ile saniyeler içinde yükleyebilirsiniz:
1. Sol panelin altındaki **"Şablon İndir"** butonuna basarak örnek Excel dosyasını bilgisayarınıza kaydediniz.
2. Excel dosyasında sütun başlıklarını değiştirmeden verilerinizi giriniz:
   * `Firma Adı` (Zorunlu)
   * `Firma Türü` (Zorunlu: `grup`, `satıcı` veya `müşteri`)
   * `Firma Bölümü` (Opsiyonel: `ENJ`, `TCT` veya `ORTAK`)
   * `VKN/TC No`, `Vergi Dairesi`, `SGK Sicil No` (Opsiyonel)
3. **Dosya Seç** butonuna tıklayarak doldurduğunuz Excel dosyasını seçiniz.
4. Sistem verileri kontrol eder, mükerrer kayıtları engeller ve başarı bildirimini ekranda gösterir.

---

### 2.5. Güvenli Toplu Firma Silme (Onay Kalkanı)
Yanlış yüklenen veya pasife alınan firmaları toplu olarak temizlemek için:
1. Sol paneldeki **"Toplu İşlem"** butonuna basınız.
2. Onay kutularından silmek istediğiniz firmaları tek tek veya açılır menüden `Tüm Satıcıları Seç` gibi hızlı filtrelerle seçiniz.
3. Kırmızı **"Seçilenleri Sil"** butonuna basınız.
4. Sistem veritabanı kilitlenmelerini önleyen özel koruma kalkanı (chunking mekanizması) ile firmaları güvenle siler.

---

## 3. TALİMAT OLUŞTURMA İŞLEMLERİ (MERKEZİ FORM)

### 3.1. Genel Talimat Akışı
Tüm talimat türlerinde temel işleyiş 4 adımdan oluşur:
1. Üst menüden **Talimat Türü**'nü seçiniz.
2. Üstteki radyo butonundan **Talimat Bölümü**'nü (`ENJ` veya `TCT`) seçiniz.
3. **Gönderici Firma** ve bağlı **Banka Hesabı**'nı seçiniz.
4. Alıcı, tutar, tarih ve açıklama detaylarını doldurup **Talimat Oluştur** butonuna basınız.

---

### 3.2. Çapraz Departman İzolasyonu ve Virman Kuralları
Sistemde iki katı güvenlik kuralı işletilmektedir:
* **Gönderici Firma İzolasyonu (Katı Güvenlik):**  
  Parayı ödeyecek olan Gönderici Firma listesinde, yalnızca seçili olan departmanın grup şirketleri listelenir. (ENJ seçiliyken TCT şirketinden ödeme çıkarılamaz).
* **Alıcı Firma Serbestisi (Holding İçi Virman İzni):**  
  Alıcı Firma listesinde departman kısıtlaması yoktur. ENJ şirketinden TCT şirketine holding içi borçlandırma/virman transferi yapılabilmesi için Alıcı firma listesi tüm holding şirketlerini kapsar.
* **Departman Değişimi Temizliği:**  
  Form doldurulurken departman radyo butonu ENJ'den TCT'ye değiştirilirse, eski departmana ait banka seçimleri güvenlik gereği otomatik olarak sıfırlanır.

---

### 3.3. Havale / EFT Talimatı (İç Transfer ve Dış Transfer)
* **İç Transfer (Virman):**  
  Can Holding şirketlerinin birbirleri arasındaki fon aktarımlarıdır. Gönderici firma da Alıcı firma da `Grup` şirketidir.
* **Dış Transfer:**  
  Üçüncü şahıslara veya kurumlara yapılan tekil ödemelerdir. Alıcı firmanın IBAN ve banka bilgileri seçilir.
* **Zorunlu Alanlar:** Gönderici Firma, Gönderici Banka, Alıcı Firma, Alıcı Banka, Tutar, Talimat Tarihi ve Açıklama.

---

### 3.4. Vergi Ödemeleri Talimatı (7 Vergi Türü)
Vergi dairesine hitaben bankaya yazılan resmi vergi ödeme talimatıdır. Sistem 7 farklı vergi türünü destekler:
1. `KDV-1`
2. `KDV-2 - Tevkifat`
3. `Muhtasar Hizmet`
4. `Muhtasar Ücret`
5. `Kurumlar Geçici Vergi`
6. `Damga Vergisi`
7. `GEKAP (Geri Kazanım Katılım Payı)`

* **Form Alanları:**
  * **Tahakkuk Fiş No (Zorunlu):** Vergi dairesi tahakkuk fişindeki numara.
  * **Vergi Dairesi & VKN:** Gönderici firma kartından otomatik doldurulur, gerekirse düzenlenebilir.
  * **Vergi Dönemi (Zorunlu):** `Ay/Yıl` formatında vergilendirme dönemi (Örn: `10/2026`).
  * **Tutar ve Tarih:** Ödenecek net vergi tutarı.

---

### 3.5. SGK Prim Ödemeleri Talimatı
* Sosyal Güvenlik Kurumu prim borçlarının banka aracılığıyla ödenmesini sağlar.
* **SGK Sicil Numarası:** Firma kartından otomatik aktarılır.
* **Dönem:** Primin ait olduğu ay ve yıl (Örn: `Eylül 2026`).

---

### 3.6. Gümrük ve Dış Ticaret Ödemeleri Talimatı
İthalat ve gümrükleme süreçlerindeki resmi ödemeleri kapsar:
* `Gümrük Vergisi`
* `İthalat ÖTV Ödemesi`
* `İthalat Harcı`
* **Gümrük Beyanname No:** 16 haneli tescil/beyanname numarası.
* **GTİP Kodu (Gümrük Tarife İstatistik Pozisyonu):** İlgili ürünün gümrük tarife kodu.

---

### 3.7. Cari Hesap Ödemeleri (Toplu Liste)
Birden fazla satıcı veya müşteriye tek bir talimat metniyle toplu ödeme yapılmasını sağlar:
1. Üst menüden `Cari Hesap Ödemeleri` > `Satıcı Ödemesi` (veya `Müşteri`) seçiniz.
2. Gönderici firma ve banka hesabını belirleyiniz.
3. Tabloya **"Satır Ekle"** butonuna basarak ödeme yapılacak firmaları, IBAN'ları, tutarları ve fatura açıklamalarını ekleyiniz.
4. **Talimat Oluştur** butonuna basıldığında sistem her satırı tek bir kurumsal liste talimatında birleştirir.

---

### 3.8. Döviz Alım ve Satım Talimatı
Banka nezdinde döviz alım (TL verip Döviz alma) veya döviz satım (Döviz verip TL alma) işlemleridir.
* **İşlem Yönü:** `Alım` veya `Satım` seçilir.
* **Döviz Cinsi:** `USD`, `EUR`, `GBP` vb.
* **Döviz Miktarı ve Anlaşılan Kur:** İşlem kuru ve döviz tutarı girildiğinde TL karşılığı sistem tarafından otomatik hesaplanır.
* **Hesaplar:** Gönderici Banka (kaynak fonun çıkacağı hesap) ve Alıcı Banka (dönüştürülen paranın gireceği hesap) seçilir.

---

## 4. TALİMAT ÇIKTISI, YAZDIRMA VE BANKA İMZA SÜRECİ

Talimat oluşturulduğunda ekranın sağında kurumsal banka talimat şablonu üretilir:
1. **Banka Anteti:** İlgili bankanın şube müdürlüğüne hitaben yazılmış resmi metin.
2. **Talimat Numarası ve Tarih:** Sol üstte sistemin atadığı benzersiz numara (Örn: `ENJ-2026-0042`).
3. **Hesap ve Transfer Tablosu:** Çıkış yapılacak hesap, IBAN, alıcı bilgileri ve tutar yazıyla/rakamla net şekilde dökülür.
4. **Çift İmza Alanı:** Can Holding imza sirkülerine uygun olarak **1. Derece Yetkili** ve **2. Derece Yetkili** için ayrılmış ıslak imza / e-imza kutucukları yer alır.
5. **Yazdırma / PDF Kaydetme:** Formun altındaki mavi **"Talimatı Yazdır"** butonuna basarak doğrudan yazıcıya gönderebilir veya hedef olarak *"PDF Olarak Kaydet"* seçeneğini işaretleyebilirsiniz.

---

## 5. TALİMAT ARŞİVİ VE İZLEME

Oluşturulan tüm talimatlar merkezi arşivde denetim iziyle birlikte saklanır.
* Sayfanın sağ üstündeki gri **"Talimat Arşivi"** butonuna basarak `arsiv.html` sayfasına geçiniz.

### 5.1. Görünüm Modları
* **Kart Görünümü:** Talimatları özet kartlar halinde yan yana listeler; hızlı göz gezdirme için idealdir.
* **Liste Görünümü:** Talimatları kompakt bir muhasebe tablosu halinde satır satır sunar; geniş veri taraması için uygundur.

### 5.2. Arama ve Filtreleme Seçenekleri
* **Bölüm Filtresi:** `Tüm Bölümler`, `ENJ (Enerji)` veya `TCT (Tectone)`.
* **Firma Filtresi:** Yalnızca belirli bir firmanın verdiği talimatları filtreler.
* **Talimat Türü Filtresi:** Havale, Vergi, SGK, Gümrük, Döviz vb.
* **Tarih Aralığı:** Başlangıç ve bitiş tarihi belirleyerek dönemsel raporlama yapabilirsiniz.
* **Durum Filtresi:**
  * `✅ Aktif Talimatlar`: Geçerli, yürürlükteki talimatlar (varsayılan).
  * `🔄 Revize Edilmiş`: Düzeltilerek yerine yeni talimat üretilmiş eski kayıtlar.
  * `🚫 İptal Edilmiş`: İptal edilen pasif kayıtlar.
  * `🔍 Tümünü Göster`: Statü ayrımı yapmaksızın tüm geçmiş.

---

## 6. AKILLI REVİZYON (DÜZELTME) MEKANİZMASI

Daha önce oluşturulmuş ancak tutarı, açıklaması veya bankası hatalı girilmiş bir talimatın yeniden düzenlenmesi sürecidir.

### 6.1. Revizyon Adımları
1. **Arşiv Sayfasına Giriniz:** Düzenlemek istediğiniz talimatın kartını bulunuz.
2. **"Revize Et" Butonuna Basınız:**  
   Sistem talimatın tüm verilerini (firma, banka, tutar, vergi detayları) güvenli hafızaya alır ve sizi otomatik olarak ana form sayfasına yönlendirir.
3. **Sarı Revizyon Banner'ı:**  
   Formun tepesinde sarı renkli **"Akıllı Revizyon Modu Aktif"** başlığı açılır ve revize ettiğiniz kaynak talimat numarasını (Örn: `ENJ-2026-0005`) gösterir.
4. **Hatalı Alanı Düzeltiniz:**  
   Formdaki tüm kutucuklar kaynak talimattan birebir otomatik dolmuş olarak gelir. Yalnızca düzeltmek istediğiniz alanı (Örn: 50.000 TL yerine 60.000 TL) değiştiriniz.
5. **Kaydet ve Tamamla:**  
   **Talimat Oluştur** butonuna bastığınızda:
   * Yeni talimata yeni bir numara atanır (Örn: `ENJ-2026-0018`).
   * Yeni talimatın detayında *"Bu talimat ENJ-2026-0005 numaralı talimatın revizyonudur"* damgası yer alır.
   * Eski talimat arşivde otomatik olarak `🔄 Revize Edildi` statüsüne çekilir.

ℹ️ **BİLGİ:** Revizyon esnasında yanlışlıkla formu açtıysanız, sarı banner'ın sağındaki **"Revizyonu İptal Et"** butonuna basarak formu sıfırlayabilirsiniz.

---

## 7. TALİMAT İPTALİ (SOFT DELETE VE DENETİM İZİ)

Finansal ERP ve denetim standartları gereği, bankacılık sisteminde üretilen hiçbir resmi talimat numarası **veritabanından kalıcı olarak silinemez (hard delete yapılmaz)**.

### 7.1. İptal Süreci
1. Arşiv sayfasında iptal etmek istediğiniz aktif talimatın altındaki kırmızı **"İptal Et"** (`fas fa-ban`) butonuna basınız.
2. Açılan onay penceresinde talimat numarasını doğrulayıp kırmızı onay butonuna basınız.
3. Talimat kalıcı olarak silinmez; statüsü `🚫 İptal` olarak güncellenir.
4. İptal edilen talimatın üzerinde "Revize Et" veya yeniden "İptal Et" butonları gizlenir; işlem kilitlenir.

---

## 8. SIKÇA KARŞILAŞILAN SORULAR VE ÇÖZÜM REHBERİ (SSS)

### S1: Gönderici Firma listesinde aradığım grup şirketini bulamıyorum. Neden?
**Cevap:** Formun üst kısmındaki **"Talimat Bölümü (Zorunlu)"** radyo butonunu kontrol ediniz. Eğer aradığınız firma bir Tectone şirketi ise ve ekranda `ENJ` seçili ise, sistem katı izolasyon gereği firmayı gizler. Radyo butonunu `TCT` olarak değiştiriniz.

### S2: "Bu talimat daha önce oluşturulmuş. Mükerrer kayıt yapılamaz" uyarısı alıyorum.
**Cevap:** Sistem aynı gönderici firma, aynı alıcı firma, aynı tutar ve aynı açıklama ile mükerrer talimat basılmasını engelleyen güvenlik filtresine sahiptir. Açıklama alanına fatura numarası veya ek bilgi ekleyerek talimatı özelleştiriniz. (Akıllı revizyon modunda bu kontrol otomatik esnetilir).

### S3: IBAN kutusuna numara yazarken boşluk bırakmalı mıyım?
**Cevap:** Hayır, boşluk bırakmanıza gerek yoktur. Sistem yazdığınız 26 haneli IBAN'ı kurumsal standartta 4'erli bloklar halinde otomatik olarak hizalar.

### S4: Revizyon yaparken bölümü ENJ'den TCT'ye değiştirirsem numara ne olur?
**Cevap:** Sistem deterministik sayaç mimarisi kullanır. Bölümü değiştirdiğiniz anda yeni talimatınız TCT sayacının sıradaki boş numarasını (Örn: `TCT-2026-XXXX`) alır. Eski ENJ talimatı ise arşivde `revize_edildi` olarak kalır; denetim zinciri hiçbir zaman kopmaz.

### S5: Excel toplu yüklemesinde dosya hata veriyor, ne yapmalıyım?
**Cevap:** Dosyanızın `.xlsx` veya `.xls` uzantılı olduğundan ve sol paneldeki **"Şablon İndir"** butonundan indirilen dosyanın sütun başlıklarının birebir korunduğundan emin olunuz. Özellikle `Firma Türü` sütununda yalnızca `grup`, `satıcı` veya `müşteri` yazmalıdır.

---

## 9. DESTEK VE YETKİLENDİRME

Sistem yetkilendirmeleri, yeni kullanıcı tanımları veya departman değişiklikleri için:
* **Can Holding Finans Direktörlüğü / Sistem Yöneticisi:** `finans@canholding.com.tr`
* **Kurumsal E-Posta:** `canholdingfinans@gmail.com`
* **Teknik Destek Dahili:** Sistem Yönetimi ve Muhasebe Bilgi İşlem Masası

---
*Can Holding Finansal Talimat Yönetim Sistemi — Güvenli, İzole ve Denetlenebilir Finans Altyapısı*
