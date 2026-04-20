-- Migrasi URL R2 ke custom domain `storage.appnustech.cloud`.
-- Script ini idempotent & aman dijalankan berulang — menangani:
--   1. `pub-1ec15515999a4e768da42c7368911097.r2.dev` → storage.appnustech.cloud
--   2. `storage.atenndensx.com`                      → storage.appnustech.cloud (cleanup alias lama)
--
-- Cara jalankan di VPS:
--   docker cp backend/scripts/migrate-r2-domain.sql attendenx_postgres:/tmp/migrate.sql
--   docker exec -it attendenx_postgres psql -U attendenx_prod -d attendenx_db -f /tmp/migrate.sql

\set new_host 'storage.appnustech.cloud'

BEGIN;

-- Kolom TEXT tunggal
UPDATE users SET avatar_url = REPLACE(REPLACE(avatar_url, 'pub-1ec15515999a4e768da42c7368911097.r2.dev', :'new_host'), 'storage.atenndensx.com', :'new_host') WHERE avatar_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR avatar_url LIKE '%storage.atenndensx.com%';
UPDATE announcements SET attachment_url = REPLACE(REPLACE(attachment_url, 'pub-1ec15515999a4e768da42c7368911097.r2.dev', :'new_host'), 'storage.atenndensx.com', :'new_host') WHERE attachment_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR attachment_url LIKE '%storage.atenndensx.com%';
UPDATE leave_requests SET attachment_url = REPLACE(REPLACE(attachment_url, 'pub-1ec15515999a4e768da42c7368911097.r2.dev', :'new_host'), 'storage.atenndensx.com', :'new_host') WHERE attachment_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR attachment_url LIKE '%storage.atenndensx.com%';
UPDATE leave_objections SET evidence_url = REPLACE(REPLACE(evidence_url, 'pub-1ec15515999a4e768da42c7368911097.r2.dev', :'new_host'), 'storage.atenndensx.com', :'new_host') WHERE evidence_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR evidence_url LIKE '%storage.atenndensx.com%';
UPDATE business_trips SET doc_url = REPLACE(REPLACE(doc_url, 'pub-1ec15515999a4e768da42c7368911097.r2.dev', :'new_host'), 'storage.atenndensx.com', :'new_host') WHERE doc_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR doc_url LIKE '%storage.atenndensx.com%';
UPDATE warning_letters SET doc_url = REPLACE(REPLACE(doc_url, 'pub-1ec15515999a4e768da42c7368911097.r2.dev', :'new_host'), 'storage.atenndensx.com', :'new_host') WHERE doc_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR doc_url LIKE '%storage.atenndensx.com%';
UPDATE clients SET contract_doc_url = REPLACE(REPLACE(contract_doc_url, 'pub-1ec15515999a4e768da42c7368911097.r2.dev', :'new_host'), 'storage.atenndensx.com', :'new_host') WHERE contract_doc_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR contract_doc_url LIKE '%storage.atenndensx.com%';
UPDATE company_profile SET logo_url = REPLACE(REPLACE(logo_url, 'pub-1ec15515999a4e768da42c7368911097.r2.dev', :'new_host'), 'storage.atenndensx.com', :'new_host') WHERE logo_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR logo_url LIKE '%storage.atenndensx.com%';

-- Visit photos (3 kolom)
UPDATE visit_photos SET
  original_url = REPLACE(REPLACE(original_url, 'pub-1ec15515999a4e768da42c7368911097.r2.dev', :'new_host'), 'storage.atenndensx.com', :'new_host'),
  thumbnail_url = REPLACE(REPLACE(thumbnail_url, 'pub-1ec15515999a4e768da42c7368911097.r2.dev', :'new_host'), 'storage.atenndensx.com', :'new_host'),
  watermarked_url = REPLACE(REPLACE(watermarked_url, 'pub-1ec15515999a4e768da42c7368911097.r2.dev', :'new_host'), 'storage.atenndensx.com', :'new_host')
WHERE original_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR original_url LIKE '%storage.atenndensx.com%'
   OR thumbnail_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR thumbnail_url LIKE '%storage.atenndensx.com%'
   OR watermarked_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR watermarked_url LIKE '%storage.atenndensx.com%';

-- Service reports (3 kolom)
UPDATE service_reports SET
  tech_signature_url = REPLACE(REPLACE(tech_signature_url, 'pub-1ec15515999a4e768da42c7368911097.r2.dev', :'new_host'), 'storage.atenndensx.com', :'new_host'),
  client_signature_url = REPLACE(REPLACE(client_signature_url, 'pub-1ec15515999a4e768da42c7368911097.r2.dev', :'new_host'), 'storage.atenndensx.com', :'new_host'),
  pdf_url = REPLACE(REPLACE(pdf_url, 'pub-1ec15515999a4e768da42c7368911097.r2.dev', :'new_host'), 'storage.atenndensx.com', :'new_host')
WHERE tech_signature_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR tech_signature_url LIKE '%storage.atenndensx.com%'
   OR client_signature_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR client_signature_url LIKE '%storage.atenndensx.com%'
   OR pdf_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR pdf_url LIKE '%storage.atenndensx.com%';

-- Kolom JSONB array of URL (cast → replace → cast balik)
UPDATE task_holds
SET evidence_urls = REPLACE(REPLACE(evidence_urls::text, 'pub-1ec15515999a4e768da42c7368911097.r2.dev', :'new_host'), 'storage.atenndensx.com', :'new_host')::jsonb
WHERE evidence_urls::text LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR evidence_urls::text LIKE '%storage.atenndensx.com%';

UPDATE expense_claims
SET receipt_urls = REPLACE(REPLACE(receipt_urls::text, 'pub-1ec15515999a4e768da42c7368911097.r2.dev', :'new_host'), 'storage.atenndensx.com', :'new_host')::jsonb
WHERE receipt_urls::text LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR receipt_urls::text LIKE '%storage.atenndensx.com%';

COMMIT;

-- Verifikasi setelah commit
\echo 'Sisa URL lama (pub-xxx.r2.dev + storage.atenndensx.com) di seluruh tabel (harusnya 0):'
SELECT 'users.avatar_url' AS kolom, COUNT(*) FROM users WHERE avatar_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR avatar_url LIKE '%storage.atenndensx.com%'
UNION ALL SELECT 'announcements.attachment_url', COUNT(*) FROM announcements WHERE attachment_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR attachment_url LIKE '%storage.atenndensx.com%'
UNION ALL SELECT 'leave_requests.attachment_url', COUNT(*) FROM leave_requests WHERE attachment_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR attachment_url LIKE '%storage.atenndensx.com%'
UNION ALL SELECT 'leave_objections.evidence_url', COUNT(*) FROM leave_objections WHERE evidence_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR evidence_url LIKE '%storage.atenndensx.com%'
UNION ALL SELECT 'business_trips.doc_url', COUNT(*) FROM business_trips WHERE doc_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR doc_url LIKE '%storage.atenndensx.com%'
UNION ALL SELECT 'warning_letters.doc_url', COUNT(*) FROM warning_letters WHERE doc_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR doc_url LIKE '%storage.atenndensx.com%'
UNION ALL SELECT 'clients.contract_doc_url', COUNT(*) FROM clients WHERE contract_doc_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR contract_doc_url LIKE '%storage.atenndensx.com%'
UNION ALL SELECT 'company_profile.logo_url', COUNT(*) FROM company_profile WHERE logo_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR logo_url LIKE '%storage.atenndensx.com%'
UNION ALL SELECT 'visit_photos.* (any)', COUNT(*) FROM visit_photos WHERE original_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR thumbnail_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR watermarked_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR original_url LIKE '%storage.atenndensx.com%' OR thumbnail_url LIKE '%storage.atenndensx.com%' OR watermarked_url LIKE '%storage.atenndensx.com%'
UNION ALL SELECT 'service_reports.* (any)', COUNT(*) FROM service_reports WHERE tech_signature_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR client_signature_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR pdf_url LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR tech_signature_url LIKE '%storage.atenndensx.com%' OR client_signature_url LIKE '%storage.atenndensx.com%' OR pdf_url LIKE '%storage.atenndensx.com%'
UNION ALL SELECT 'task_holds.evidence_urls', COUNT(*) FROM task_holds WHERE evidence_urls::text LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR evidence_urls::text LIKE '%storage.atenndensx.com%'
UNION ALL SELECT 'expense_claims.receipt_urls', COUNT(*) FROM expense_claims WHERE receipt_urls::text LIKE '%pub-1ec15515999a4e768da42c7368911097.r2.dev%' OR receipt_urls::text LIKE '%storage.atenndensx.com%';
