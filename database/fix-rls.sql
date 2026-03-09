-- Fix RLS Security Warnings
-- Run this AFTER running schema.sql

-- Enable RLS on missing tables
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Blog Posts Policies
DROP POLICY IF EXISTS "Published blogs are public" ON blog_posts;
DROP POLICY IF EXISTS "Admins can manage blogs" ON blog_posts;

CREATE POLICY "Published blogs are public" ON blog_posts
    FOR SELECT USING (published = TRUE);

CREATE POLICY "Admins can manage blogs" ON blog_posts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'manager')
        )
    );

-- Offers Policies
DROP POLICY IF EXISTS "Active offers are public" ON offers;
DROP POLICY IF EXISTS "Admins can manage offers" ON offers;

CREATE POLICY "Active offers are public" ON offers
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage offers" ON offers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'manager')
        )
    );

-- Gallery Images Policies
DROP POLICY IF EXISTS "Gallery images are public" ON gallery_images;
DROP POLICY IF EXISTS "Admins can manage gallery" ON gallery_images;

CREATE POLICY "Gallery images are public" ON gallery_images
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage gallery" ON gallery_images
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'manager')
        )
    );

-- Inquiries Policies
DROP POLICY IF EXISTS "Users can create inquiries" ON inquiries;
DROP POLICY IF EXISTS "Users can view own inquiries" ON inquiries;
DROP POLICY IF EXISTS "Admins can view all inquiries" ON inquiries;

CREATE POLICY "Users can create inquiries" ON inquiries
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own inquiries" ON inquiries
    FOR SELECT USING (
        email = (SELECT email FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Admins can view all inquiries" ON inquiries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'manager')
        )
    );
