ALTER TABLE books   ADD COLUMN IF NOT EXISTS summary TEXT NULL,
                    ADD COLUMN IF NOT EXISTS summary_model VARCHAR(100) NULL,
                    ADD COLUMN IF NOT EXISTS summary_generated_at DATETIME NULL;
ALTER TABLE borrows ADD COLUMN IF NOT EXISTS payment_status ENUM('pending','paid','free') NOT NULL DEFAULT 'free';
ALTER TABLE users   ADD COLUMN IF NOT EXISTS subscription_status ENUM('free','premium') NOT NULL DEFAULT 'free';