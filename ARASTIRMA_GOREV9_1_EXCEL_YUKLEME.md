# ARAŞTIRMA VE FORENSIC TESPİT RAPORU (GÖREV 9.1)
**Konu:** Toplu Excel Firma ve Banka Yükleme İşleminin 352 Satırının Tamamının Elenmesi (Validation Kilitleri ve Teşhis)  
**Tarih:** 12 Ekim 2026  
**Durum:** 🟡 Forensic İnceleme Tamamlandı — Çözüm Onayı Bekleniyor (Awaiting GO)

---

## 1. Yönetici Özeti ve Teşhis

352 satırlık Excel şablonu yüklendiğinde alınan:
```text
"0 yeni firma, 0 banka hesabı eklendi. 352 satır hatalı, atlandı."
```
uyarısının kök nedeni; konsolda JavaScript hatası olmaksızın, arka plandaki **`addBankaBulk` doğrulama (validation) filtrelerinin ve katı banka adı eşleştiricisinin 352 satırın tamamını sessizce elemesidir (Silent Rejection)**.

Ayrıca `main.js`, elenen satırların hata sebeplerini (`sebep`) konsola veya kullanıcı arayüzüne **asla yazdırmadığı için** hata sessiz ve görünmez kalmaktadır.

---

## 2. Forensic İnceleme 1: Excel Okuma ve Anahtar (Key) Mantığı

* **İlgili Dosya:** `main.js` (Satır 593 – 744, `setupExcelUploadEvents`)
* **Kütüphane Çağrısı (Satır 641):**
  ```javascript
  const json = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  ```
* **Kritik Tespit:** Kod nesne anahtarı (örn: `row['Firma Adı']` veya `row['FirmaAdi']`) **BEKLEMEMEKTEDİR**.
  SheetJS'e `{ header: 1 }` verildiği için dosya **Dizi Dizisi (Array of Arrays)** olarak okunmakta ve sütunlara **sabit sayısal indekslerle** erişilmektedir:
  * `row[0]`: Firma Adı
  * `row[1]`: Firma Türü
  * `row[2]`: Firma Bölümü (ENJ / TCT / ORTAK)
  * `row[3]`: VKN/T.C. No
  * `row[4]`: Vergi Dairesi
  * `row[5]`: SGK Sicil No
  * `row[6]`: SGK Adı
  * `row[7]`: Banka Adı
  * `row[8]`: IBAN
  * `row[9]`: Para Birimi
  * `row[10]`: Şube Adı
  * `row[11]`: Şube İli
  * `row[12]`: SWIFT Kodu
  * `row[13]`: Hesap No

> **Sütun Sırası Teşhisi:** Kullanıcının belirttiği 14 başlıklı şablon ile koddaki indeksler (0'dan 13'e kadar) birebir örtüşmektedir. `bankaSatirlari.push(...)` başarıyla çalışmış ve 352 satırın tamamı `addBankaBulk` fonksiyonuna iletilmiştir.

---

## 3. Forensic İnceleme 2: 352 Satırı Eleyen 4 Kritik Doğrulama Kilidi

`modules/bankalar.js` içerisindeki `addBankaBulk` fonksiyonu (Satır 238-283) adım adım simüle edilmiş ve satırların elenmesine yol açan 4 ana kilit laboratuvar ortamında kanıtlanmıştır:

### 🔒 Kilit 1: Kanonik Banka Adı Katılığı (`getCanonicalBankaAdi`) — [EN BÜYÜK KATİL]
* **Kod:** `const canonicalBankaAdi = getCanonicalBankaAdi(satir.banka_adi);`
* **Neden Reddediyor:** `modules/banka-listesi.js` dosyasında `BANKA_LISTESI` resmi tüzel unvanları (`TÜRKİYE İŞ BANKASI A.Ş.`, `TÜRKİYE GARANTİ BANKASI A.Ş.`, `YAPI VE KREDİ BANKASI A.Ş.`, `TÜRKİYE HALK BANKASI A.Ş.`) barındırır.
* `LEGACY_ALIAS` listesinde ise **sadece 3 banka** tanımlıdır (AKBANK, VAKIFBANK, ZİRAAT BANKASI).
* **Laboratuvar Test Sonuçları:**
  * `'İş Bankası'` ➡️ `null` ❌ *(Şablon dosyasında örnek olarak verilen isim bile sistem tarafından tanınmamaktadır!)*
  * `'Garanti'` / `'Garanti BBVA'` ➡️ `null` ❌
  * `'Yapı Kredi'` ➡️ `null` ❌
  * `'Halkbank'` ➡️ `null` ❌
  * `'Denizbank'` ➡️ `null` ❌
  * `'QNB Finansbank'` ➡️ `null` ❌
* **Sonuç:** Kullanıcının Excel dosyasındaki banka isimleri yaygın piyasa adlarıyla yazıldıysa, **istisnasız her bir satır** `"Banka adı tanınmadı: '...'. Lütfen kanonik listeden birini kullanın."` hatasıyla çöpe atılmaktadır.

---

### 🔒 Kilit 2: Grup Firmaları İçin Şube Adı ve Şube İli Zorunluluğu
* **Kod (`modules/bankalar.js` Satır 256-260):**
  ```javascript
  const isGrup = firma.turu === 'grup';
  if (isGrup && (!satir.sube_adi?.trim() || !satir.sube_il?.trim())) {
      hatali.push({ satirNo: satir.satirNo, sebep: 'Grup firmaları için Şube Adı ve Şube İli zorunludur.' });
      continue;
  }
  ```
* **Neden Reddediyor:** Kullanıcının örnek verdiği satır bir `"grup"` firmasıdır (`"CAN ULUSLARARASI YAT.HOL.A.Ş."`). Excel dosyalarında grup firmalarının banka hesaplarında Şube Adı veya Şube İli boş bırakılmışsa, bu kural **tüm grup firması banka satırlarını derhal reddeder**.

---

### 🔒 Kilit 3: Para Birimi Katılığı (`TL` ve Boş Değerler)
* **Kod (`modules/bankalar.js` Satır 261-266):**
  ```javascript
  const gecerliParaBirimleri = ['TRY', 'USD', 'EUR', 'GBP', 'CHF'];
  const paraBirimi = satir.para_birimi?.trim().toUpperCase();
  if (!gecerliParaBirimleri.includes(paraBirimi)) {
      hatali.push({ satirNo: satir.satirNo, sebep: `Geçersiz para birimi: ${satir.para_birimi}` });
      continue;
  }
  ```
* **Neden Reddediyor:**
  1. Türkiye'deki kullanıcıların Excel'de en sık yazdığı `"TL"` para birimi bu listede yoktur! (`TL !== TRY`).
  2. Eğer Excel hücresi boş bırakılmışsa (`undefined`), varsayılan olarak `TRY` atanmamakta; doğrudan `"Geçersiz para birimi: undefined"` hatası verilmektedir.

---

### 🔒 Kilit 4: Hata Sebeplerinin Gizlenmesi (Silent Drop)
* **Kod (`main.js` Satır 729-733):**
  ```javascript
  let msg = `${yeniFirmaSayisi} yeni firma, ${eklenenBank} banka hesabı eklendi.`;
  if (atlananBank > 0) msg += ` ${atlananBank} kayıt atlandı (zaten mevcut).`;
  if (hataliBank > 0) msg += ` ${hataliBank} satır hatalı, atlandı.`;
  showNotification(msg, hataliBank > 0 ? 'warning' : 'success');
  ```
* **Neden Sessiz:** `addBankaBulk` fonksiyonu `hatali` dizisinde her satırın neden reddedildiğini (`satirNo`, `sebep`) döndürmektedir. Ancak `main.js` bu diziyi ne konsola (`console.table` / `console.warn`) yazdırmakta ne de ekranda göstermektedir. Kullanıcı yalnızca "352 satır hatalı" görmektedir.

---

## 4. Mimari Çözüm Planı

Bu kilitleri ortadan kaldırmak ve esnek, dayanıklı bir içe aktarma sağlamak için 3 aşamalı çözüm önerilmektedir:

### 1. Kapsamlı Banka Alias Haritası (`modules/banka-listesi.js`):
Piyasadaki tüm yaygın banka yazılışları `LEGACY_ALIAS` sözlüğüne eklenecektir:
- `'İŞ BANKASI'`, `'IS BANKASI'`, `'ISBANK'`, `'İŞBANK'` ➡️ `TÜRKİYE İŞ BANKASI A.Ş.`
- `'GARANTİ'`, `'GARANTI'`, `'GARANTİ BBVA'`, `'GARANTI BBVA'` ➡️ `TÜRKİYE GARANTİ BANKASI A.Ş.`
- `'YAPI KREDİ'`, `'YAPI KREDI'`, `'YAPIKREDI'` ➡️ `YAPI VE KREDİ BANKASI A.Ş.`
- `'HALKBANK'`, `'HALK BANKASI'` ➡️ `TÜRKİYE HALK BANKASI A.Ş.`
- `'DENİZBANK'`, `'DENIZBANK'` ➡️ `DENİZBANK A.Ş.`
- `'QNB'`, `'QNB FİNANSBANK'`, `'FINANSBANK'` ➡️ `QNB BANK A.Ş.`
- `'TEB'` ➡️ `TÜRK EKONOMİ BANKASI A.Ş.`
- `'KUVEYT TÜRK'`, `'KUVEYTTURK'` ➡️ `KUVEYT TÜRK KATILIM BANKASI A.Ş.`

### 2. Akıllı Para Birimi ve Esnek Şube Kontrolü (`modules/bankalar.js`):
- `paraBirimi`: Boşsa veya `'TL'` ise otomatik olarak `'TRY'`'ye normalize edilecek.
- `sube_adi` ve `sube_il`: Grup firmalarında boşsa `"Merkez"` ve `"İstanbul"` varsayılan değerleri atanacak (veya zorunluluk esnetilecek), böylece tüm satırın reddedilmesi önlenecektir.

### 3. Konsol ve UI Telemetrisi (`main.js`):
- Hatalı satırlar varsa konsola `console.table(bankaSonuc.hatali)` ile satır satır hata nedenleri yazdırılacak. İlk 3 hatanın sebebi kullanıcıya gösterilerek tam şeffaflık sağlanacaktır.

---

## 5. Sonuç ve Onay Beklentisi

352 satırın tamamının reddedilmesinin ana nedeni **`getCanonicalBankaAdi` fonksiyonunun yaygın banka isimlerini ("İş Bankası", "Garanti" vb.) tanımaması**, **`TL` para biriminin reddedilmesi** ve **grup firması şube zorunluluğudur**.

Bu rapor doğrultusunda kodlama yapılması için onayınızı (**🟢 GO**) beklemekteyim.
