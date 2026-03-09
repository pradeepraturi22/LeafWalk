-- GST Bill & Invoice Enhancement - FIXED VERSION
-- Run this in Supabase SQL Editor

-- 1. Create invoice sequence
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1000;

-- 2. Add GST and invoice fields to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS cgst DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS sgst DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS gst_total DECIMAL(10,2);

-- 3. Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq_val INTEGER;
  fiscal_year TEXT;
BEGIN
  SELECT nextval('invoice_seq') INTO seq_val;
  
  -- Get fiscal year (Apr-Mar format: 2024-25)
  IF EXTRACT(MONTH FROM NOW()) >= 4 THEN
    fiscal_year := EXTRACT(YEAR FROM NOW())::TEXT || '-' || 
                   LPAD((EXTRACT(YEAR FROM NOW()) + 1 - 2000)::TEXT, 2, '0');
  ELSE
    fiscal_year := (EXTRACT(YEAR FROM NOW()) - 1)::TEXT || '-' || 
                   LPAD((EXTRACT(YEAR FROM NOW()) - 2000)::TEXT, 2, '0');
  END IF;
  
  RETURN 'LWR/' || fiscal_year || '/' || LPAD(seq_val::TEXT, 4, '0');
END;
$$;

-- 4. Function to calculate GST breakdown
CREATE OR REPLACE FUNCTION calculate_gst_breakdown()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only calculate if payment is confirmed and invoice not yet generated
  IF NEW.payment_status = 'paid' AND NEW.invoice_number IS NULL THEN
    -- Generate invoice number
    NEW.invoice_number := generate_invoice_number();
    
    -- Calculate GST breakdown
    -- Assuming total_amount includes GST (18% = 9% CGST + 9% SGST)
    NEW.subtotal := ROUND(NEW.total_amount / 1.18, 2);
    NEW.gst_total := NEW.total_amount - NEW.subtotal;
    NEW.cgst := ROUND(NEW.gst_total / 2, 2);
    NEW.sgst := ROUND(NEW.gst_total / 2, 2);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. Create trigger for auto GST calculation
DROP TRIGGER IF EXISTS auto_calculate_gst ON bookings;
CREATE TRIGGER auto_calculate_gst
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION calculate_gst_breakdown();

-- 6. Drop existing notification_logs if it exists (to recreate with correct schema)
DROP TABLE IF EXISTS notification_logs CASCADE;

-- 7. Create notification_logs table with correct schema
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'sms', 'whatsapp')),
  recipient VARCHAR(255) NOT NULL,
  subject TEXT,
  content TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_logs_booking ON notification_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);

-- 9. Enable RLS
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policy
DROP POLICY IF EXISTS "Admins can view all notifications" ON notification_logs;
CREATE POLICY "Admins can view all notifications" ON notification_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- 11. Update existing paid bookings to have invoice numbers (optional - small batch)
DO $$
DECLARE
  booking_record RECORD;
  counter INTEGER := 0;
BEGIN
  FOR booking_record IN 
    SELECT id, total_amount 
    FROM bookings 
    WHERE payment_status = 'paid' 
    AND invoice_number IS NULL
    ORDER BY created_at DESC
    LIMIT 50 -- Process only 50 at a time
  LOOP
    UPDATE bookings
    SET 
      invoice_number = generate_invoice_number(),
      subtotal = ROUND(booking_record.total_amount / 1.18, 2),
      gst_total = booking_record.total_amount - ROUND(booking_record.total_amount / 1.18, 2),
      cgst = ROUND((booking_record.total_amount - ROUND(booking_record.total_amount / 1.18, 2)) / 2, 2),
      sgst = ROUND((booking_record.total_amount - ROUND(booking_record.total_amount / 1.18, 2)) / 2, 2)
    WHERE id = booking_record.id;
    
    counter := counter + 1;
  END LOOP;
  
  RAISE NOTICE 'Updated % existing bookings with invoice numbers', counter;
END $$;

-- 12. Verification queries
SELECT 
  'Invoice system ready' as status,
  COUNT(*) as invoices_generated
FROM bookings 
WHERE invoice_number IS NOT NULL;

SELECT 
  'Notification logs table ready' as status,
  COUNT(*) as total_logs
FROM notification_logs;

-- Success message
SELECT '✅ GST & Invoice Enhancement Complete!' as message;
