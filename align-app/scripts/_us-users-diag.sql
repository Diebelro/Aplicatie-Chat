-- Profiluri cu țară US / America / gol, plus ultimele login-uri dacă există IP
SELECT p.username, p.country, p.city, u.email, u."createdAt"
FROM "Profile" p
JOIN "User" u ON u.id = p."userId"
WHERE lower(coalesce(p.country,'')) LIKE '%united%'
   OR lower(coalesce(p.country,'')) LIKE '%america%'
   OR lower(coalesce(p.country,'')) LIKE '%usa%'
   OR lower(coalesce(p.country,'')) = 'us'
ORDER BY u."createdAt" DESC
LIMIT 30;

-- Ultimele conturi create (posibil din ads US)
SELECT p.username, coalesce(nullif(trim(p.country),''),'(gol)') AS country, u.email, u."createdAt"
FROM "Profile" p
JOIN "User" u ON u.id = p."userId"
ORDER BY u."createdAt" DESC
LIMIT 40;
