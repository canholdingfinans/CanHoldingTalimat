-- ==============================================================================
-- GÖREV 12.1 — AKILLI REVİZYON İÇİN VERİTABANI DEĞİŞİKLİKLERİ
-- Güvenli: IF NOT EXISTS korumalıdır, tekrar çalıştırılabilir.
-- ==============================================================================

BEGIN;

-- ADIM 1: 'durum' sütunu — CHECK constraint ile geçersiz değer engellenir
ALTER TABLE public.payment_instructions
  ADD COLUMN IF NOT EXISTS durum TEXT NOT NULL DEFAULT 'aktif'
  CHECK (durum IN ('aktif', 'iptal', 'revize_edildi'));

-- ADIM 2: 'revize_edilen_no' sütunu — TEXT olarak tutulur (FK değil).
-- Revize edilen talimat silinse bile audit trail kaybolmasın diye TEXT tercih edildi.
-- Örnek değer: 'ENJ-2026-0005'. NULL = normal talimat (revizyon değil).
ALTER TABLE public.payment_instructions
  ADD COLUMN IF NOT EXISTS revize_edilen_no TEXT DEFAULT NULL;

-- ADIM 3: Mevcut kayıtları 'aktif' olarak işaretle
UPDATE public.payment_instructions
  SET durum = 'aktif'
  WHERE durum IS NULL;

-- ADIM 4: Durum filtresi için performans indeksi
-- Arşiv sayfası varsayılan olarak durum='aktif' filtresiyle açılacağından kritik.
CREATE INDEX IF NOT EXISTS idx_payment_instructions_durum
  ON public.payment_instructions(durum);

-- ADIM 5: Çapraz sorgular için bileşik indeks (departman + durum)
CREATE INDEX IF NOT EXISTS idx_payment_instructions_dept_durum
  ON public.payment_instructions(department_prefix, durum);

COMMIT;
