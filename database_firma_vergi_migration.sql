-- Migration script to add tax number and tax office fields to firms table
-- This script adds optional tax information fields to the firms table

-- Add tax number column (VKN/T.C. No) - optional field
ALTER TABLE firms 
ADD COLUMN IF NOT EXISTS vkn_tc_no TEXT;

-- Add tax office column (Vergi Dairesi) - optional field
ALTER TABLE firms 
ADD COLUMN IF NOT EXISTS vergi_dairesi TEXT;

-- Add comments for documentation
COMMENT ON COLUMN firms.vkn_tc_no IS 'Firma VKN/T.C. No (Opsiyonel)';
COMMENT ON COLUMN firms.vergi_dairesi IS 'Firma Vergi Dairesi (Opsiyonel)';

-- Add validation constraint for tax number (10 or 11 digits only)
ALTER TABLE firms 
ADD CONSTRAINT valid_vkn_tc_no 
CHECK (vkn_tc_no IS NULL OR (vkn_tc_no ~ '^[0-9]{10,11}$'));

-- Display success message
SELECT 'Firma vergi bilgileri başarıyla eklendi.' as message;