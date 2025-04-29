-- First, make email nullable temporarily
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Update any null emails with a default value
UPDATE users SET email = 'default' || id || '@example.com' WHERE email IS NULL;

-- Now make email not null again
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Add dob column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'users' AND column_name = 'dob') THEN
        ALTER TABLE users ADD COLUMN dob timestamp;
    END IF;
END $$;

-- Update any null dob values to a default date
UPDATE users SET dob = '2000-01-01' WHERE dob IS NULL; 