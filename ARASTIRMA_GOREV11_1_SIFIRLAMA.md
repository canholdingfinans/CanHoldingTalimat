# ARASTIRMA RAPORU: GÖREV 11.1 — CANLIYA GEÇİŞ (PRODUCTION) ÖNCESİ SİSTEMİ SIFIRLAMA

**Tarih:** 12 Ekim 2026  
**Durum:** 🟢 Tamamlandı (Uygulamaya Hazır / Ready for Execution)  
**Hedef:** Canlıya geçiş öncesinde mevcut tüm test talimatlarının veritabanından güvenle temizlenmesi, firma ve banka verilerine asla dokunulmaması ve yeni talimat numaralarının her iki bölüm için de (`TCT-2026-0001` ve `ENJ-2026-0001`) baştan başlamasını sağlayacak kesin sıfırlama (Hard Reset) planı.

---

## 1. Forensic İnceleme: Talimat Numarası (`instruction_number`) Üretim Mimarisi

Yapılan kod ve canlı veritabanı incelemelerinde talimat numaralarının nasıl üretildiği netleştirilmiştir:

### A. Frontend Rolü (`modules/talimatlar.js` & `main.js`)
* Frontend talimat oluştururken numarayı kendisi **üretmez** (`main.js` ve `talimatlar.js` içindeki `getNextInstructionNumber` fonksiyonları kaldırılmıştır).
* Frontend sadece kullanıcının seçtiği veya yetkili olduğu bölüm bilgisini (`department_prefix: 'ENJ'` veya `'TCT'`) payload nesnesine ekleyerek Supabase `payment_instructions` tablosuna bir `INSERT` isteği atar.

### B. Veritabanı Rolü (Trigger: `tr_set_department_and_number`)
* `payment_instructions` tablosu üzerinde çalışan bir **BEFORE INSERT** trigger'ı bulunmaktadır:
  ```sql
  CREATE TRIGGER tr_set_department_and_number
  BEFORE INSERT ON public.payment_instructions
  FOR EACH ROW EXECUTE FUNCTION public.set_department_and_number();
  ```

### C. Sayaç Mekanizması: Ayrı Tablo (`public.instruction_counters`)
* **Kritik Tespit:** Sistem en son eklenen kaydı `MAX(instruction_number)` ile arayıp `+1` yapmaz!
* Numaralandırma, bağımsız ve eşzamanlı (concurrency/race-condition korumalı) çalışan **`public.instruction_counters`** tablosunda tutulmaktadır.
* Trigger fonksiyonu her yeni kayıtta şu atomik sorguyu çalıştırır:
  ```sql
  INSERT INTO instruction_counters (prefix, year, last_number)
  VALUES (NEW.department_prefix, v_year, 1)
  ON CONFLICT (prefix, year) DO UPDATE
  SET last_number = instruction_counters.last_number + 1
  RETURNING last_number INTO v_next_number;
  ```
* Ardından numarayı string olarak birleştirir:
  `NEW.instruction_number := NEW.department_prefix || '-' || v_year || '-' || LPAD(v_next_number::text, 4, '0');`

### D. Canlı Veritabanı İnceleme Kanıtı (Live Telemetry)
Canlı Supabase REST API üzerinden `instruction_counters` tablosu sorgulanmış ve mevcut durum tespit edilmiştir:
```json
[
  { "prefix": "TCT", "year": 2026, "last_number": 3 },
  { "prefix": "ENJ", "year": 2026, "last_number": 47 }
]
```
> [!IMPORTANT]
> **HAYATİ BULGU:** Sadece `payment_instructions` tablosu silinirse, sayaç tablosu (`instruction_counters`) sıfırlanmadığı için oluşturulacak ilk talimatlar `TCT-2026-0004` ve `ENJ-2026-0048` olarak devam eder!
> Bu nedenle tam sıfırlama için **hem `payment_instructions` hem de `instruction_counters` tabloları birlikte sıfırlanmalıdır.**

---

## 2. Foreign Key (Yabancı Anahtar) ve Tablo Güvenlik Analizi

### A. İlişki Yönü (Dependency Direction)
* `payment_instructions` tablosu:
  * `gonderici_firma_id` ➡️ `firms(id)`
  * `alici_firma_id` ➡️ `firms(id)`
  * `gonderici_banka_hesap_id` ➡️ `bank_accounts(id)`
  * `alici_banka_hesap_id` ➡️ `bank_accounts(id)`
* `payment_instructions` tablosu bu ilişkilerde **çocuk (child)** tablodur.
* `firms` ve `bank_accounts` ise **ebeveyn (parent)** tablolardır.

### B. Alt Tablo (Child Tables) Kontrolü
* `payment_instructions` tablosuna referans veren (foreign key ile bağlı olan) **hiçbir alt tablo (child table) bulunmamaktadır**.
* Dolayısıyla `CASCADE` kullanımı zorunlu değildir; ancak `TRUNCATE TABLE ... RESTART IDENTITY` komutu veritabanını en saf fabrika ayarlarına döndürür.

### C. Dokunulmaması Gereken Kritik Tablolar
1. **`public.firms`**: Sistemdeki tüm firma kayıtları (350+ firma) korunacaktır. KESİNLİKLE DOKUNULMAZ.
2. **`public.bank_accounts`**: Firmalara ait tüm banka hesapları ve IBAN'lar korunacaktır. KESİNLİKLE DOKUNULMAZ.
3. **`public.firm_assets`**: Varsa firmalara ait antet/kaşe URL'leri korunacaktır. KESİNLİKLE DOKUNULMAZ.
4. **`public.app_user_departments`**: Kullanıcıların hangi departmanlara (ENJ, TCT) yetkili olduğunu tutan tablodur. KESİNLİKLE DOKUNULMAZ (Aksi halde kullanıcılar form açarken "Yetkisiz kullanıcı" hatası alır).

---

## 3. Güvenli Sıfırlama (Hard Reset) SQL Senaryosu

Aşağıdaki SQL bloğu bir **Transaction (`BEGIN ... COMMIT`)** içinde hazırlanmıştır. İşlem sırasında herhangi bir hata oluşursa hiçbir veri kaybolmaz.

### 📋 Supabase SQL Editor'de Çalıştırılacak SQL Scripti:

```sql
-- ==============================================================================
-- CANLIYA GEÇİŞ ÖNCESİ SİSTEM SIFIRLAMA (HARD RESET) SCRİPTİ
-- ==============================================================================
-- DİKKAT: Sadece test talimatlarını ve sayaçları sıfırlar. 
-- Firmalar (firms), Banka Hesapları (bank_accounts) ve Kullanıcı Yetkilerine DOKUNMAZ.
-- ==============================================================================

BEGIN;

-- 1. Test Talimatlarını Temizle ve Tablo ID Sayacını Başa Al
TRUNCATE TABLE public.payment_instructions RESTART IDENTITY;

-- 2. Departman Sayaçlarını Sıfırla (TCT ve ENJ sayaç kayıtlarını sil)
TRUNCATE TABLE public.instruction_counters;

-- 3. Eski/Artık PostgreSQL Sequence Varsa Tedbiren 1'e Çek
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'talimat_no_seq') THEN
        ALTER SEQUENCE public.talimat_no_seq RESTART WITH 1;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'payment_instructions_id_seq') THEN
        ALTER SEQUENCE public.payment_instructions_id_seq RESTART WITH 1;
    END IF;
END $$;

COMMIT;

-- ==============================================================================
-- DOĞRULAMA (VERIFICATION) SORGULARI
-- ==============================================================================
-- Aşağıdaki sorguların sonuçlarını kontrol edin:
-- 1. talimat_sayisi: 0 olmalı
-- 2. sayac_sayisi: 0 olmalı
-- 3. firma_sayisi: 40+ (mevcut firmalarınız eksiksiz durmalı)
-- 4. banka_sayisi: 50+ (mevcut bankalarınız eksiksiz durmalı)
-- 5. yetki_sayisi: kullanıcı yetkileri eksiksiz durmalı

SELECT COUNT(*) AS talimat_sayisi FROM public.payment_instructions;
SELECT COUNT(*) AS sayac_sayisi FROM public.instruction_counters;
SELECT COUNT(*) AS firma_sayisi FROM public.firms;
SELECT COUNT(*) AS banka_sayisi FROM public.bank_accounts;
SELECT COUNT(*) AS yetkili_kullanici_sayisi FROM public.app_user_departments;
```

---

## 4. Sıfırlama Sonrası İlk Talimat Davranışı

Script çalıştırıldıktan sonra sistem ilk talimat oluşturulduğunda şu şekilde davranacaktır:

| Bölüm | İlk Talimat No | İkinci Talimat No | Açıklama |
| :--- | :--- | :--- | :--- |
| **Tectone (TCT)** | `TCT-2026-0001` | `TCT-2026-0002` | `instruction_counters` boş olduğu için trigger ilk satırı 1 ile başlatır. |
| **Enerji (ENJ)** | `ENJ-2026-0001` | `ENJ-2026-0002` | `instruction_counters` boş olduğu için trigger ilk satırı 1 ile başlatır. |

* Her iki bölüm de birbirinden tamamen bağımsız olarak **0001**'den saymaya başlayacaktır.
* Firma listeleri, banka hesapları ve arama kutusu özellikleri aynen korunacaktır.

---

## 5. Sonuç ve Onay Beklentisi

Forensic araştırma tamamlanmış ve canlı veritabanı durumu tescil edilmiştir. 
Kullanıcı talimatı gereği bu aşamada hiçbir kod dosyası değiştirilmemiştir.

Rapor ve yukarıdaki SQL scripti onayınızdadır. 🟢
