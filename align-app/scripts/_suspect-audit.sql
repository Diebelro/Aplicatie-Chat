-- Duplicate email / username
SELECT 'dup_email' AS kind, lower(email) AS v, count(*)::int AS n
FROM "User" GROUP BY 1 HAVING count(*) > 1
UNION ALL
SELECT 'dup_username', lower(p.username), count(*)::int
FROM "Profile" p WHERE p.username IS NOT NULL AND trim(p.username) <> ''
GROUP BY 1 HAVING count(*) > 1;

-- Gen + țară (ultimele 14 zile)
SELECT coalesce(p.gender,'(gol)') AS gender, coalesce(nullif(trim(p.country),''),'(gol)') AS country, count(*)::int AS n
FROM "User" u JOIN "Profile" p ON p."userId" = u.id
WHERE u."createdAt" >= now() - interval '14 days'
GROUP BY 1,2 ORDER BY n DESC LIMIT 40;

-- Același hash/prefix poză (primele 80 chars din photos[0] dacă e URL)
SELECT left(p.photos[1], 80) AS photo_prefix, count(*)::int AS n,
       array_agg(p.username ORDER BY u."createdAt" DESC) FILTER (WHERE p.username IS NOT NULL) AS users
FROM "User" u JOIN "Profile" p ON p."userId" = u.id
WHERE p.photos IS NOT NULL AND cardinality(p.photos) > 0 AND p.photos[1] IS NOT NULL AND length(p.photos[1]) > 20
GROUP BY 1 HAVING count(*) > 1
ORDER BY n DESC LIMIT 25;

-- Conturi noi US male cu username/email suspect
SELECT u.email, p.username, p.gender, p.city, p.country, u."createdAt",
       CASE WHEN p.photos IS NULL OR cardinality(p.photos)=0 THEN 0 ELSE cardinality(p.photos) END AS n_photos,
       left(coalesce(p.bio,''), 60) AS bio_short
FROM "User" u JOIN "Profile" p ON p."userId" = u.id
WHERE u."createdAt" >= now() - interval '14 days'
ORDER BY u."createdAt" DESC
LIMIT 40;

-- Username-uri ofensive / spammy (pattern)
SELECT u.email, p.username, p.gender, p.country, u."createdAt"
FROM "User" u JOIN "Profile" p ON p."userId" = u.id
WHERE p.username ~* '(cock|sex|fuck|pussy|nude|slut|whore|cooch|dick|penis|xxx|onlyfans|escort)'
   OR p.username ~* '(test|fake|admin|bot)[0-9]*$'
ORDER BY u."createdAt" DESC
LIMIT 30;

-- Totaluri
SELECT
  (SELECT count(*) FROM "User")::int AS users,
  (SELECT count(*) FROM "Profile")::int AS profiles,
  (SELECT count(*) FROM "Profile" WHERE gender='female')::int AS females,
  (SELECT count(*) FROM "Profile" WHERE gender='male')::int AS males,
  (SELECT count(*) FROM "Profile" WHERE photos IS NULL OR cardinality(photos)=0)::int AS no_photos;