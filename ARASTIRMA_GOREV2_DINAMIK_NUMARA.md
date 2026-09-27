# ARASTIRMA_GOREV2_DINAMIK_NUMARA

## 1. Mevcut Numara Üretim Mimarisi
*   **Mevcut Durum:** `payment_instructions` tablosunda `instruction_number` alanı `bigint` türündedir ve veritabanındaki bir `SEQUENCE` kullanılarak (otomatik artan sayı olarak) tamamen DB tarafında üretilmektedir.
*   **Frontend Rolü:** `talimatlar.js` içindeki `formatInstructionNumber(instructionNumber)` fonksiyonu, DB'den gelen tam sayıyı (örn: `1`) alıp sadece ekranda (UI) gösterim amacıyla `2026-0001` formatına dönüştürmektedir.
*   **Tespit:** Numaralandırma işlemi şu an tamamen veritabanı (PostgreSQL Sequence) tabanlıdır. Ancak mevcut Sequence yapısı globaldir, prefix'e (ENJ/TCT) göre bağımsız sayı üretemez. 

## 2. Yeni Tablolar (`app_user_departments` ve `instruction_counters`)

### A. `app_user_departments` Tablosu
Görev 1'de kullanıcı ismini (`olusturan_kullanici`) metin olarak tutsak da, bölüm **yetkilendirmesi** yüksek güvenlikli bir RLS ve Trigger denetimi gerektireceğinden doğrudan Supabase'in eşsiz kimliği olan `UUID` ile bağlanmalıdır.

```sql
CREATE TABLE public.app_user_departments (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id),
    departments text[] NOT NULL -- Örn: '{ENJ}', '{ENJ, TCT}'
);
-- RLS: Kullanıcı sadece kendi yetkilerini görebilir
CREATE POLICY "Kullanici kendi yetkilerini gorur" ON app_user_departments
FOR SELECT USING (auth.uid() = user_id);
```

### B. `instruction_counters` Tablosu
Her yıl ve her bölüm için ayrı sayacı tutacak yapı.
```sql
CREATE TABLE public.instruction_counters (
    prefix text,            -- 'ENJ' veya 'TCT'
    year integer,           -- 2026
    last_number integer,    -- En son verilen numara
    PRIMARY KEY (prefix, year)
);
```

## 3. Concurrency (Race-Condition) Çözümü
PostgreSQL'de iki kişinin milisaniye farkla çakışmasını engellemenin en güvenli yolu **Atomic INSERT/UPDATE** (Upsert) komutudur. Bu komut, kilit (row-level lock) mekanizmasını kendi içinde güvenle yönetir. Ayrı bir RPC yerine, işlemi doğrudan bir **BEFORE INSERT Trigger** içinde yapmak en stabil ve güvenli yöntemdir.

**Kullanılacak SQL Tekniği:**
```sql
INSERT INTO instruction_counters (prefix, year, last_number)
VALUES (v_prefix, v_year, 1)
ON CONFLICT (prefix, year) DO UPDATE
SET last_number = instruction_counters.last_number + 1
RETURNING last_number INTO v_next_number;
```
Bu sayede iki kişi tam aynı milisaniyede butona bassa bile, Postgres bu işlemi sıraya sokar ve asla aynı sayıyı iki kişiye vermez.

## 4. Güvenlik ve Yetkilendirme (Spoofing Koruması)
Frontend'in `department_prefix: "TCT"` olarak gönderdiği veriye körü körüne güvenilemez. Ya yetkisi olmayan biri (örn: sadece ENJ kullanıcısı) TCT göndermeye çalışırsa?

Bunun çözümü, yukarıda tasarladığımız Counter Trigger'ının içine şu kontrolü eklemektir:
```sql
-- DB Trigger İçi Spoofing Koruması
SELECT departments INTO v_allowed_deps FROM app_user_departments WHERE user_id = auth.uid();

IF NOT (NEW.department_prefix = ANY(v_allowed_deps)) THEN
    RAISE EXCEPTION 'Bu bölüm için talimat oluşturma yetkiniz bulunmamaktadır.';
END IF;
```
Bu sayede Frontend hacklense dahi veritabanı işlemi reddedecektir.

## 5. Veri Tipi Migration Stratejisi
Test ortamında eski veriler temizleneceği (TRUNCATE) için migration oldukça basittir. 
`instruction_number` alanı `bigint`'ten `text`'e çevrilecek ve default SEQUENCE bağı koparılacaktır.
```sql
ALTER TABLE public.payment_instructions
ADD COLUMN department_prefix text; -- Frontend'den gelen seçimi tutmak için

ALTER TABLE public.payment_instructions
ALTER COLUMN instruction_number DROP DEFAULT,
ALTER COLUMN instruction_number TYPE text USING instruction_number::text;
```
Not: `talimatlar.js` içindeki `formatInstructionNumber` fonksiyonu halihazırda `return instructionNumber.toString()` fallback'ine sahip olduğu için, DB'den `ENJ-2026-0001` formatında gelen String veri uygulamayı **hiçbir şekilde bozmadan** doğrudan ekranda görünecektir.

## 6. Frontend - Backend Veri Akışı & UI Değişiklik Planı
1. **Veri Yükleme:** `arsiv.html` ve `index.html` yüklendiğinde, giriş yapan kullanıcının UUID'si ile `app_user_departments` tablosuna bir `SELECT` isteği atılır.
2. **UI Kararı:** 
   - Eğer gelen dizi `['ENJ']` ise -> Bölüm radyo butonları GİZLENİR. Form submit edilirken arkada otomatik olarak `department_prefix: 'ENJ'` eklenir.
   - Eğer gelen dizi `['ENJ', 'TCT']` ise -> Formun (Talimat Türü seçiminin üstüne) bir "Bölüm Seçiniz (ENJ / TCT)" radyo butonu grubu EKLENİR ve kullanıcının seçmesi zorunlu tutulur.
3. **Backend:** Frontend'den `instructionData` içine eklenen `department_prefix` değeri DB'ye gönderilir, Trigger gerisini (Doğrulama ve Numara Üretimi) halleder.

## 7. Uygulamaya Geçmek İçin Belirsizlikler
Hiçbir mimari belirsizlik kalmamıştır. Tüm race-condition ve spoofing (güvenlik) riskleri Postgres seviyesinde çözülmüştür. 
Sadece: 
Uygulamaya başlarken `app_user_departments` tablosuna test kullanıcılarının (admin, ayseayaz vb.) `user_id` karşılıklarının manuel olarak bir sefere mahsus Supabase üzerinden tanımlanması (INSERT edilmesi) gerekecektir.

*Bu rapor bağlamında sistem, geliştirme (uygulama) adımlarına %100 hazırdır.*
