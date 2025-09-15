-- Migration script to add SGK fields to firms table
-- This script adds optional SGK information fields to the firms table

-- Add SGK sicil no column (SGK Sicil Numarası) - optional field
ALTER TABLE firms 
ADD COLUMN IF NOT EXISTS sgk_sicil_no TEXT;

-- Add SGK adi column (SGK Adı) - optional field
ALTER TABLE firms 
ADD COLUMN IF NOT EXISTS sgk_adi TEXT;

-- Add comments for documentation
COMMENT ON COLUMN firms.sgk_sicil_no IS 'SGK Sicil Numarası (Opsiyonel)';
COMMENT ON COLUMN firms.sgk_adi IS 'SGK Adı (Opsiyonel)';

-- Display success message
SELECT 'Firma SGK bilgileri başarıyla eklendi.' as message;