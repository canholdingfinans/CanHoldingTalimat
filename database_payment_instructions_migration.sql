-- Migration script for payment_instructions table
-- Tarih: 2026-07-22
-- Neden: Frontend "vergi_donem" alanini gonderdigi halde (Supabase PGRST204 hatasi) canli veritabaninda (production) bu sutun eksikti. 
-- Islem: "vergi_donem" sutunu canli veritabanina elle eklendi (Supabase SQL Editor uzerinden).
-- Not: Bu migration dosyasi repodan kurulum yapacak yeni ortamlar icin gecmise donuk bir kayit (history) olarak eklenmistir.

ALTER TABLE payment_instructions 
   ADD COLUMN IF NOT EXISTS vergi_donem text;
   
COMMENT ON COLUMN payment_instructions.vergi_donem IS 'Vergi ve SGK ödemeleri için dönem bilgisi (Örn: 2026-07)';
