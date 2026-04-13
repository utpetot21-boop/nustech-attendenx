-- Init script untuk PostgreSQL
-- Dijalankan otomatis saat container pertama kali dibuat

-- Extension UUID (diperlukan untuk gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Extension untuk full-text search (opsional, berguna untuk pencarian karyawan)
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Timezone
SET TIME ZONE 'Asia/Makassar';

-- Info
DO $$ BEGIN
  RAISE NOTICE 'AttendenX DB initialized. Timezone: %', current_setting('TIMEZONE');
END $$;
