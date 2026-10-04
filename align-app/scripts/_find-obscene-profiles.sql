-- Caută bio/nume suspect + poze recente
SELECT u.id, u.email, p.username, p.name,
       left(coalesce(p.bio,''), 120) AS bio,
       (SELECT count(*) FROM "ProfilePhoto" ph WHERE ph."profileId"=p.id) AS photo_count
FROM "User" u
JOIN "Profile" p ON p."userId"=u.id
WHERE p.bio ILIKE '%futai%'
   OR p.bio ILIKE '%singur acasa%'
   OR p.bio ILIKE '%trag cu tine%'
   OR p.bio ILIKE '%pula%'
   OR p.name ILIKE '%futai%'
   OR p.username ILIKE '%futai%'
LIMIT 30;

SELECT ph.id AS photo_id, ph."createdAt", u.id AS user_id, u.email, p.username,
       left(ph.url, 80) AS url_preview
FROM "ProfilePhoto" ph
JOIN "Profile" p ON p.id = ph."profileId"
JOIN "User" u ON u.id = p."userId"
ORDER BY ph."createdAt" DESC
LIMIT 25;
