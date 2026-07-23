-- Migration script for RLS Hardening
-- Tarih: 2026-07-22
-- Neden: Veritabanı tablolarındaki (firms, bank_accounts, payment_instructions) public Anon erişimini kapatmak.
-- İşlem: Mevcut 'Enable all for anon' policy'leri silindi ve yalnızca 'authenticated' kullanıcılar için yetkilendirme sağlandı.
-- Not: Bu migration dosyası repodan kurulum yapacak yeni ortamlar için geçmişe dönük bir kayıt (history) olarak eklenmiştir.
-- (firm_assets tablosu canlı ortamda mevcut olmadığı için hariç tutulmuştur)

-- 1. Firms Tablosu
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for anon on firms" ON public.firms;
CREATE POLICY "Sadece giris yapanlar" ON public.firms 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- 2. Bank Accounts Tablosu
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for anon on bank_accounts" ON public.bank_accounts;
CREATE POLICY "Sadece giris yapanlar" ON public.bank_accounts 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- 3. Payment Instructions Tablosu
ALTER TABLE public.payment_instructions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for anon on payment_instructions" ON public.payment_instructions;
CREATE POLICY "Sadece giris yapanlar" ON public.payment_instructions 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');
