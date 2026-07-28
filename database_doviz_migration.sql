-- ============================================================
-- Migration: Döviz Alım/Satım Talimatı — Yeni Sütunlar
-- Tarih: 2026-07-27
-- Neden: payment_instructions tablosuna Döviz Alım/Satım talimat
--        türü için gereken 5 yeni sütun ekleniyor.
-- Önceki durum (doğrulandı): 19 sütun
-- Sonraki durum (beklenen): 24 sütun
-- RLS: payment_instructions zaten RLS altında — ek işlem GEREKMİYOR.
-- ============================================================

ALTER TABLE payment_instructions
  ADD COLUMN IF NOT EXISTS doviz_islemi_turu text;

ALTER TABLE payment_instructions
  ADD COLUMN IF NOT EXISTS doviz_cinsi text;

ALTER TABLE payment_instructions
  ADD COLUMN IF NOT EXISTS doviz_miktari numeric(18,4);

ALTER TABLE payment_instructions
  ADD COLUMN IF NOT EXISTS kur numeric(18,6);

ALTER TABLE payment_instructions
  ADD COLUMN IF NOT EXISTS valor_tarihi date;

COMMENT ON COLUMN payment_instructions.doviz_islemi_turu IS 'Döviz işlem yönü: alım veya satım';
COMMENT ON COLUMN payment_instructions.doviz_cinsi       IS 'Yabancı para cinsi: USD, EUR, GBP, CHF vb.';
COMMENT ON COLUMN payment_instructions.doviz_miktari     IS 'Yabancı para birimi cinsinden işlem miktarı (4 ondalık hassasiyet)';
COMMENT ON COLUMN payment_instructions.kur               IS '1 birim yabancı para = kaç TRY (6 ondalık hassasiyet)';
COMMENT ON COLUMN payment_instructions.valor_tarihi      IS 'Valör tarihi (opsiyonel; boşsa talimat_tarihi geçerlidir)';

-- ============================================================
-- DOĞRULAMA SORGUSU (migration sonrası çalıştır):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'payment_instructions'
-- ORDER BY ordinal_position;
-- Beklenen: 24 satır
-- ============================================================
