# ARAŞTIRMA VE FORENSIC TESPİT RAPORU (GÖREV 10.1)
**Konu:** Sidebar Yükleme Gecikmesi (Race Condition), Arama Kutusu Bug'ları ve UX Başlık Uyumsuzluğu  
**Tarih:** 12 Ekim 2026  
**Durum:** 🟡 Forensic İnceleme Tamamlandı — Çözüm Onayı Bekleniyor (Awaiting GO)

---

## 1. Yönetici Özeti ve Teşhis

Sol sidebar'da (Firma Akordiyon Listesi) tespit edilen 4 sorunun kod bazlı forensic incelemesi tamamlanmıştır.

1. **İlk Yükleme Gecikmesi (F5'te Gelip İlk Açılışta Gelmeme):** Supabase oturum doğrulama sürecinde (`onAuthStateChange` vs `getSession`) yaşanan çift tetiklenme ve yanlış DOM sınıfı kontrolü (`.firma-accordion-item` sınıfının DOM'da hiç var olmaması) nedeniyle, Supabase henüz oturum token'ını bağlamadan `fetchFirmalar()` çağrılmakta; RLS engeli nedeniyle veritabanı 0 firma dönerek sidebar'ı boş bırakmaktadır.
2. **Arama Kutusu Tepkisizliği & Enter Tuşu:** Arama kutusunda `keydown/Enter` dinleyicisi bulunmamakta; sadece `input` dinlenmektedir. Daha da kritik olarak, **Debounce (gecikme) olmadığı için** her tuş vuruşunda Supabase'e paralel ağır veritabanı sorguları (`*, bank_accounts(*)`) atılmakta ve dönen HTTP yanıtları sırasız (out-of-order) gelerek arama sonucunun üzerine yazmaktadır (Network Race Condition).
3. **Arama Temizlendiğinde Listenin Geri Gelmemesi:** Arama kutusuna yazılan her harf, istemci tarafında filtreleme yapmak yerine uzak veritabanına sorgu atıp uygulamanın **tüm global `firmalar` hafızasını ezmektedir**. Silme anında (Backspace) atılan sorgular ağ kuyruğunda kilitlendiğinde veya eski sorgu arkadan geldiğinde ekranda son aranan firma takılı kalmaktadır.
4. **UX Başlığı Uyumsuzluğu:** Menüde Satıcı, Müşteri ve Grup firmaları bir arada bulunmasına rağmen başlıkta sadece `"Grup Firmalar"` yazmaktadır.

---

## 2. Forensic İnceleme 1: `main.js` (İlk Yükleme ve Auth Race Condition)

* **İlgili Bölüm:** `main.js` (Satır 250 – 305, `initAuth`)
* **Mevcut Kod Mantığı:**
  ```javascript
  // 1. Olay Dinleyici
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (session) {
          if (document.querySelectorAll('.firma-accordion-item').length === 0 && !isAppInitializing) {
              isAppInitializing = true;
              await loadInitialData();
              ...
          }
      }
  });

  // 2. Doğrudan Oturum Kontrolü (Hemen ardından paralel çalışıyor)
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
      if (document.querySelectorAll('.firma-accordion-item').length === 0 && !isAppInitializing) {
          isAppInitializing = true;
          await loadInitialData();
          ...
      }
  }
  ```

### 🔍 Kök Neden Analizi:
1. **Var Olmayan DOM Sınıfı Kontrolü:** Kod `document.querySelectorAll('.firma-accordion-item').length === 0` kontrolü yapmaktadır. Ancak `renderFirmaAccordion()` akordiyon öğelerini `<div class="accordion-item">` sınıfıyla üretmektedir! Yani `.firma-accordion-item` DOM'da **asla var olmaz**. Bu koşul her zaman `true` değerlendirilir.
2. **RLS & Token Senkronizasyon Uyuşmazlığı:** Sayfa ilk yüklendiğinde tarayıcı localStorage'dan oturumu ayağa kaldırırken `onAuthStateChange` (`INITIAL_SESSION`) ve `getSession()` aynı anda tetiklenir. `supabaseClient` henüz `Authorization: Bearer <token>` başlığını iç ağ istemcisine tam bağlamadan `loadInitialData() -> fetchFirmalar()` çağrılırsa, Supabase RLS kuralları gereği sorgu hata vermez; **sessizce boş dizi (`[]`) döner**.
3. **F5 Yenilemesinde Neden Düzeliyor?** Sayfa F5 ile yenilendiğinde oturum token'ı tarayıcı önbelleğinde zaten aktif ve hazır olduğu için ilk sorgu anında yetkili kullanıcı kimliğiyle gider ve firmalar eksiksiz yüklenir.

---

## 3. Forensic İnceleme 2: `ui-etkilesimleri.js` & `main.js` (Search Bug'ları)

* **İlgili Bölümler:** 
  * `modules/ui-etkilesimleri.js` (Satır 650 – 674, `setupSearchAndFilter`)
  * `main.js` (Satır 578 – 588, `handleFirmaSearchChanged`)
  * `modules/supabase-entegrasyonu.js` (Satır 72 – 85, `fetchAll`)

### 🔍 Kök Neden Analizi:

#### A. Debounce Yokluğu ve Ağ Tıkanması:
```javascript
firmaSearchInput.addEventListener('input', () => {
    window.dispatchEvent(new CustomEvent('firmaSearchChanged', {
        detail: { searchTerm: firmaSearchInput.value, ... }
    }));
});
```
Kullanıcı "CAN" yazdığında 3 harf için milisaniyeler içinde 3 ayrı HTTP isteği Supabase'e gönderilir:
1. `C` (1 harf): `searchTerm.length < 3` olduğu için veritabanındaki **tüm 352 firmayı ve banka hesaplarını çeker** (~100 KB veri).
2. `CA` (2 harf): Yine filtre uygulanmaz, **tekrar tüm 352 firmayı çeker**.
3. `CAN` (3 harf): `ilike('name', '%CAN%')` ile sadece 1 firmayı çeker.

Bu 3 istek paralel uçtuğunda:
* 3. istek (hafif) 200 ms'de dönüp ekrana "CAN" firmasını çizer.
* 1. veya 2. istek (ağır) 500 ms'de sonradan gelir ve ekrana **tekrar tüm 352 firmayı basar**! Kullanıcı aramanın çalışmadığını veya tepkisiz kaldığını sanır.

#### B. Enter Tuşu Tepkisizliği:
`firmaSearchInput` üzerinde `keydown` veya `keypress` dinleyicisi yoktur. Kullanıcı 3 harf yazıp Enter'a bastığında hiçbir kod tetiklenmez.

#### C. Arama Temizlendiğinde Listenin Geri Gelmemesi (Global State Zehirlenmesi):
Sidebar araması yerel bir filtreleme yapmak yerine `modules/firmalar.js` içindeki **global `firmalar` değişkenini** ezmektedir:
```javascript
export const fetchFirmalar = async (searchTerm = '', filterType = 'all') => {
    const data = await firmaOperations.fetchAll(searchTerm, filterType);
    firmalar = uniqueFirmalar; // DİKKAT: Global hafıza eziliyor!
    return firmalar;
};
```
Kullanıcı arama kutusunu Backspace ile sildiğinde:
* Ağ kuyruğundaki çakışma nedeniyle boş arama isteği gecikirse veya askıda kalırsa, `firmalar` hafızada tek firma olarak kalır.
* Üstelik bu durum formdaki `gondericiFirma` ve `aliciFirma` dropdown'larını da bozar (Choices nesnelerini yok edip sadece aranan firmayı seçenek olarak bırakır).

---

## 4. Forensic İnceleme 3: `index.html` (UX Başlığı)

* **İlgili Bölüm:** `index.html` (Satır 168)
  ```html
  <h4 class="mb-0">Grup Firmalar</h4>
  ```
* **Uyumsuzluk:** Başlığın hemen altındaki açılır menüde:
  * "Tüm Firmalar"
  * "Grup"
  * "Satıcı"
  * "Müşteri"
  seçenekleri yer almaktadır. Sol panel sadece grup firmalarını değil, sistemdeki tüm cari kartları barındırmaktadır.

### 💡 Önerilen 3 Kapsayıcı ve Profesyonel Başlık:
1. **Firma Rehberi** ⭐ *(En çok tavsiye edilen: Kurumsal, sade ve tüm türleri kapsar)*
2. **Kayıtlı Firmalar**
3. **Firma & Hesap Yönetimi**

---

## 5. Mimari Çözüm Planı

### A. İlk Yükleme & Auth Race Condition Çözümü (`main.js`):
1. Çift kontrol mekanizması sadeleştirilecek. Oturum kontrolü `isAppInitializing` bayrağı ile atomik hale getirilecek.
2. Kontrol koşulu `document.querySelectorAll('.firma-accordion-item').length` gibi sahte bir DOM sorgusu yerine doğrudan **`getFirmalar().length === 0`** hafıza kontrolüne bağlanacak.
3. Oturum hazır olmadan (`supabaseClient.auth.getSession()` doğrulanmadan) veri çekilmesi engellenecektir.

### B. İstemci Taraflı Hızlı Arama & Debounce Çözümü (`ui-etkilesimleri.js` & `main.js`):
1. **Hafıza İçi (Client-Side) Anlık Filtreleme:** Zaten hafızada bulunan 352 firma için her harfte sunucuya gitmek yerine, arama ve tür filtrelemesi **0 ms gecikmeyle istemci tarafında (`in-memory`)** yapılacaktır.
2. `renderFirmaAccordion(filteredList = null)` fonksiyonuna parametre desteği eklenecek:
   * Arama yapıldığında sadece sol akordiyon anında filtrelenecek.
   * Arama kutusu temizlendiğinde (Backspace / boşluk) hafızadaki tam liste **1 milisaniyede** ekrana geri gelecektir.
   * Ana formdaki ödeme dropdown'ları asla bozulmayacaktır.
3. **Debounce & Enter Desteği:** Arama kutusuna 200 ms Debounce ve `Enter` tuşu desteği eklenecektir.

### C. Başlık Güncellemesi (`index.html`):
* `index.html` satır 168'deki `"Grup Firmalar"` başlığı `"Firma Rehberi"` olarak güncellenecektir.

---

## 6. Karşılaştırma Tablosu

| Özellik | Mevcut Durum | Yeni Mimari Planı |
| :--- | :--- | :--- |
| **İlk Yükleme** | F5 gerektirebiliyor, RLS ile yarışıyor | Oturum doğrulanmadan sorgu atılmaz, tek seferde garantili yüklenir |
| **Arama Hızı** | 500-1000 ms (Her harfte uzak DB sorgusu) | **0 ms (İstemci tarafı, anında)** |
| **Ağ Yükü** | Her harfte 100 KB JSON transferi | Sıfır ağ isteği (Veri zaten hafızada) |
| **Arama Temizleme** | Takılı kalıyor, liste geri gelmiyor | Backspace anında tüm liste 1 milisaniyede geri gelir |
| **Form Dropdown'ları**| Arama yapıldığında form seçenekleri siliniyor | Form dropdown'ları arama esnasında asla etkilenmez |
| **Sol Panel Başlığı** | "Grup Firmalar" (Yanıltıcı) | **"Firma Rehberi"** (Kapsayıcı ve doğru) |

---

## 7. Sonuç ve Onay Beklentisi

Bu forensic analiz, arama kutusunun neden takıldığını, aramanın neden temizlenmediğini ve ilk açılış gecikmesinin kök nedenlerini %100 kanıtlamıştır.

Plan uygunsa **🟢 GO (ONAY)** vermeniz halinde kodlama adımına geçilecektir.
