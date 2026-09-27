# UYGULAMA_PLANI_GOREV2_DINAMIK_NUMARA

## Adım 1: Supabase Veritabanı ve SQL İşlemleri
Bu adımdaki kodlar, Supabase SQL Editor üzerinden tek seferde çalıştırılacaktır. Mimari audit raporlarında belirtilen güvenlik standartları (SECURITY INVOKER, atomic sayaç) dikkate alınarak hazırlanmıştır.

```sql
-- 1. Yetki Tablosunun Oluşturulması ve RLS Eklenmesi
CREATE TABLE IF NOT EXISTS public.app_user_departments (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id),
    departments text[] NOT NULL
);

ALTER TABLE public.app_user_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanicilar kendi yetkilerini gorebilir" 
ON public.app_user_departments
FOR SELECT 
USING (auth.uid() = user_id);

-- 2. Sayac Tablosunun Oluşturulması
CREATE TABLE IF NOT EXISTS public.instruction_counters (
    prefix text,
    year integer,
    last_number integer DEFAULT 0,
    PRIMARY KEY (prefix, year)
);

-- 3. Payment Instructions Tablosu Güncellemeleri
ALTER TABLE public.payment_instructions
ADD COLUMN IF NOT EXISTS department_prefix text;

-- Mevcut IDENTITY (otomatik artan) özelliğini kaldırıp text tipe dönüştürülüyor
ALTER TABLE public.payment_instructions
ALTER COLUMN instruction_number DROP IDENTITY IF EXISTS;

ALTER TABLE public.payment_instructions
ALTER COLUMN instruction_number TYPE text USING instruction_number::text;

-- 4. Yetki Kontrolü ve Atomic Numara Üretim Trigger Fonksiyonu
CREATE OR REPLACE FUNCTION public.set_department_and_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_allowed_deps text[];
    v_year integer := extract(year from current_date);
    v_next_number integer;
BEGIN
    -- Yetkileri Çek
    SELECT departments INTO v_allowed_deps 
    FROM app_user_departments 
    WHERE user_id = auth.uid();

    IF v_allowed_deps IS NULL THEN
        RAISE EXCEPTION 'Kullanıcının herhangi bir bölüme yetkisi bulunmamaktadır.';
    END IF;

    -- Frontend prefix göndermediyse ve tek yetki varsa otomatik ata
    IF NEW.department_prefix IS NULL OR NEW.department_prefix = '' THEN
        IF array_length(v_allowed_deps, 1) = 1 THEN
            NEW.department_prefix := v_allowed_deps[1];
        ELSE
            RAISE EXCEPTION 'Birden fazla yetkiniz var, bölüm seçimi zorunludur.';
        END IF;
    END IF;

    -- Spoofing Kontrolü (Yetkisiz bölüm seçimi engelleme)
    IF NOT (NEW.department_prefix = ANY(v_allowed_deps)) THEN
        RAISE EXCEPTION 'Bu bölüm için talimat oluşturma yetkiniz bulunmamaktadır.';
    END IF;

    -- Atomic Upsert (Race-condition çözümü)
    INSERT INTO instruction_counters (prefix, year, last_number)
    VALUES (NEW.department_prefix, v_year, 1)
    ON CONFLICT (prefix, year) DO UPDATE
    SET last_number = instruction_counters.last_number + 1
    RETURNING last_number INTO v_next_number;

    -- Numarayı Ata (Örn: ENJ-2026-0001)
    NEW.instruction_number := NEW.department_prefix || '-' || v_year::text || '-' || LPAD(v_next_number::text, 4, '0');
    
    RETURN NEW;
END;
$$;

-- Fonksiyonu dışarıdan tetiklenmeye karşı koruma
REVOKE EXECUTE ON FUNCTION public.set_department_and_number() FROM PUBLIC, anon, authenticated;

-- Trigger'ı tabloya bağlama
DROP TRIGGER IF EXISTS tr_set_department_and_number ON public.payment_instructions;
CREATE TRIGGER tr_set_department_and_number
BEFORE INSERT ON public.payment_instructions
FOR EACH ROW
EXECUTE FUNCTION public.set_department_and_number();
```

## Adım 2: Frontend Değişiklikleri (`main.js` ve form HTML)
Formun olduğu HTML dosyasında (örneğin `index.html`), form başlangıcının hemen üstüne bölüm seçimi div'i eklenecek.

**A. Form HTML İçine Dinamik Alan:**
```html
<div id="departmentSelectionContainer" class="mb-3" style="display: none;">
    <label class="form-label fw-bold">Talimat Bölümü (Zorunlu)</label>
    <div id="departmentRadioButtons"></div>
</div>
```

**B. `main.js` Asenkron Yetki Yükleme (Sayfa açılışında):**
```javascript
// initAuth veya DOMContentLoaded içinde oturum kontrolünden sonra çalışacak:
async function loadUserDepartments() {
    const submitBtn = document.getElementById('talimatKaydetBtn'); // Kaydet butonu ID'si
    if(submitBtn) submitBtn.disabled = true; // Yetki gelene kadar butonu kilitle

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data, error } = await supabaseClient
        .from('app_user_departments')
        .select('departments')
        .eq('user_id', user.id)
        .single();

    if (error || !data) {
        console.error('Yetki yüklenemedi:', error);
        return;
    }

    const deps = data.departments;
    const container = document.getElementById('departmentSelectionContainer');
    const radioContainer = document.getElementById('departmentRadioButtons');

    if (deps.length > 1) {
        // Çift yetkili, radyoları göster
        container.style.display = 'block';
        let html = '';
        deps.forEach((dep, index) => {
            html += `
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" name="department_prefix" id="dep_${dep}" value="${dep}" ${index === 0 ? 'checked' : ''}>
                    <label class="form-check-label" for="dep_${dep}">${dep}</label>
                </div>
            `;
        });
        radioContainer.innerHTML = html;
    } else {
        // Tek yetkili, seçimi gizle arka planda kalsın
        container.style.display = 'none';
        radioContainer.innerHTML = `<input type="hidden" name="department_prefix" value="${deps[0]}">`;
    }

    if(submitBtn) submitBtn.disabled = false; // Kilidi aç
}
```

**C. `main.js` Form Submit Akışı (`createHavaleInstructionFromForm` fonksiyonu):**
Form toplanırken, formData objesine prefix de eklenecektir.
```javascript
// FormData objesini oluştururken:
const departmentPrefixInput = document.querySelector('input[name="department_prefix"]:checked') || document.querySelector('input[name="department_prefix"]');

const formData = {
    // ...diğer alanlar...
    department_prefix: departmentPrefixInput ? departmentPrefixInput.value : null
};
```
(Frontend kısmı, kullanıcının UI deneyimi pürüzsüz olacak şekilde sadece form verisine küçük bir property ekleyerek DB Trigger'ına işi devreder).

## Adım 3: Manuel Kullanıcı Yetki Tanımlaması (Supabase Dashboard)
Bu özellik devreye girdikten sonra 15 test kullanıcısının bölümlerini veritabanına eklemek zorunludur.
1. Supabase Dashboard'a girin.
2. Sol menüden **Authentication -> Users** bölümüne gidin ve kullanıcıların **User UID** değerlerini kopyalayın (Örn: `123e4567-e89b-12d3-a456-426614174000`).
3. **Table Editor -> `app_user_departments`** tablosunu açın ve "Insert row" (Satır Ekle) butonuna basın.
4. Çıkan pencerede:
   - `user_id`: Kopyaladığınız User UID'yi yapıştırın.
   - `departments`: Eğer kişi Enerji'deyse `["ENJ"]`, Tectone'daysa `["TCT"]`, her ikisindeyse `["ENJ", "TCT"]` şeklinde yazarak kaydedin.

Tüm test kullanıcıları için bu 4 adımı bir defaya mahsus uyguladığınızda, sistem hiçbir kesinti olmadan yeni dinamik numaralar (ENJ-2026-0001) üretmeye başlayacaktır.
