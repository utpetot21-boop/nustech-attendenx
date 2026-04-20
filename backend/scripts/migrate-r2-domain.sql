-- Migrasi URL R2: pub-1ec15515999a4e768da42c7368911097.r2.dev → storage.atenndensx.com
-- Jalankan SETELAH custom domain di Cloudflare R2 aktif dan env R2_PUBLIC_URL diupdate.
--
-- Cara jalankan di VPS:
--   docker cp backend/scripts/migrate-r2-domain.sql postgres:/tmp/migrate-r2-domain.sql
--   docker exec -it postgres psql -U nustech -d attendenx -f /tmp/migrate-r2-domain.sql

\set old_host 'pub-1ec15515999a4e768da42c7368911097.r2.dev'
\set new_host 'storage.atenndensx.com'

BEGIN;

-- Kolom TEXT tunggal
UPDATE users SET avatar_url = REPLACE(avatar_url, :'old_host', :'new_host') WHERE avatar_url LIKE '%' || :'old_host' || '%';
UPDATE announcements SET attachment_url = REPLACE(attachment_url, :'old_host', :'new_host') WHERE attachment_url LIKE '%' || :'old_host' || '%';
UPDATE leave_requests SET attachment_url = REPLACE(attachment_url, :'old_host', :'new_host') WHERE attachment_url LIKE '%' || :'old_host' || '%';
UPDATE leave_objections SET evidence_url = REPLACE(evidence_url, :'old_host', :'new_host') WHERE evidence_url LIKE '%' || :'old_host' || '%';
UPDATE business_trips SET doc_url = REPLACE(doc_url, :'old_host', :'new_host') WHERE doc_url LIKE '%' || :'old_host' || '%';
UPDATE warning_letters SET doc_url = REPLACE(doc_url, :'old_host', :'new_host') WHERE doc_url LIKE '%' || :'old_host' || '%';
UPDATE clients SET contract_doc_url = REPLACE(contract_doc_url, :'old_host', :'new_host') WHERE contract_doc_url LIKE '%' || :'old_host' || '%';
UPDATE company_profile SET logo_url = REPLACE(logo_url, :'old_host', :'new_host') WHERE logo_url LIKE '%' || :'old_host' || '%';

-- Visit photos (3 kolom)
UPDATE visit_photos SET
  original_url = REPLACE(original_url, :'old_host', :'new_host'),
  thumbnail_url = REPLACE(thumbnail_url, :'old_host', :'new_host'),
  watermarked_url = REPLACE(watermarked_url, :'old_host', :'new_host')
WHERE original_url LIKE '%' || :'old_host' || '%'
   OR thumbnail_url LIKE '%' || :'old_host' || '%'
   OR watermarked_url LIKE '%' || :'old_host' || '%';

-- Service reports (3 kolom)
UPDATE service_reports SET
  tech_signature_url = REPLACE(tech_signature_url, :'old_host', :'new_host'),
  client_signature_url = REPLACE(client_signature_url, :'old_host', :'new_host'),
  pdf_url = REPLACE(pdf_url, :'old_host', :'new_host')
WHERE tech_signature_url LIKE '%' || :'old_host' || '%'
   OR client_signature_url LIKE '%' || :'old_host' || '%'
   OR pdf_url LIKE '%' || :'old_host' || '%';

-- Kolom JSONB array of URL (cast → replace → cast balik)
UPDATE task_holds
SET evidence_urls = REPLACE(evidence_urls::text, :'old_host', :'new_host')::jsonb
WHERE evidence_urls::text LIKE '%' || :'old_host' || '%';

UPDATE expense_claims
SET receipt_urls = REPLACE(receipt_urls::text, :'old_host', :'new_host')::jsonb
WHERE receipt_urls::text LIKE '%' || :'old_host' || '%';

COMMIT;

-- Verifikasi setelah commit
\echo 'Sisa URL lama di seluruh tabel (harusnya 0):'
SELECT 'users.avatar_url' AS kolom, COUNT(*) FROM users WHERE avatar_url LIKE '%' || :'old_host' || '%'
UNION ALL SELECT 'announcements.attachment_url', COUNT(*) FROM announcements WHERE attachment_url LIKE '%' || :'old_host' || '%'
UNION ALL SELECT 'leave_requests.attachment_url', COUNT(*) FROM leave_requests WHERE attachment_url LIKE '%' || :'old_host' || '%'
UNION ALL SELECT 'leave_objections.evidence_url', COUNT(*) FROM leave_objections WHERE evidence_url LIKE '%' || :'old_host' || '%'
UNION ALL SELECT 'business_trips.doc_url', COUNT(*) FROM business_trips WHERE doc_url LIKE '%' || :'old_host' || '%'
UNION ALL SELECT 'warning_letters.doc_url', COUNT(*) FROM warning_letters WHERE doc_url LIKE '%' || :'old_host' || '%'
UNION ALL SELECT 'clients.contract_doc_url', COUNT(*) FROM clients WHERE contract_doc_url LIKE '%' || :'old_host' || '%'
UNION ALL SELECT 'company_profile.logo_url', COUNT(*) FROM company_profile WHERE logo_url LIKE '%' || :'old_host' || '%'
UNION ALL SELECT 'visit_photos.* (any)', COUNT(*) FROM visit_photos WHERE original_url LIKE '%' || :'old_host' || '%' OR thumbnail_url LIKE '%' || :'old_host' || '%' OR watermarked_url LIKE '%' || :'old_host' || '%'
UNION ALL SELECT 'service_reports.* (any)', COUNT(*) FROM service_reports WHERE tech_signature_url LIKE '%' || :'old_host' || '%' OR client_signature_url LIKE '%' || :'old_host' || '%' OR pdf_url LIKE '%' || :'old_host' || '%'
UNION ALL SELECT 'task_holds.evidence_urls', COUNT(*) FROM task_holds WHERE evidence_urls::text LIKE '%' || :'old_host' || '%'
UNION ALL SELECT 'expense_claims.receipt_urls', COUNT(*) FROM expense_claims WHERE receipt_urls::text LIKE '%' || :'old_host' || '%';
