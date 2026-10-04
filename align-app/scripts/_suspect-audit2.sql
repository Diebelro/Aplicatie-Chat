-- Totals
SELECT
  (SELECT count(*) FROM "User")::int AS users,
  (SELECT count(*) FROM "Profile")::int AS profiles,
  (SELECT count(*) FROM "Profile" WHERE gender='female')::int AS females,
  (SELECT count(*) FROM "Profile" WHERE gender='male')::int AS males,
  (SELECT count(*) FROM "Profile" WHERE gender IS NULL OR gender='')::int AS no_gender,
  (SELECT count(DISTINCT p.id) FROM "Profile" p LEFT JOIN "ProfilePhoto" ph ON ph."profileId"=p.id WHERE ph.id IS NULL)::int AS no_photos;

-- Duplicate emails / usernames
SELECT 'dup_email' AS kind, lower(email) AS v, count(*)::int AS n
FROM "User" GROUP BY lower(email) HAVING count(*) > 1;
SELECT 'dup_username' AS kind, lower(username) AS v, count(*)::int AS n
FROM "Profile" GROUP BY lower(username) HAVING count(*) > 1;

-- Same photo URL used by multiple profiles
SELECT left(ph.url, 100) AS url_prefix, count(DISTINCT ph."profileId")::int AS n_profiles,
       string_agg(DISTINCT p.username, ', ' ORDER BY p.username) AS usernames
FROM "ProfilePhoto" ph
JOIN "Profile" p ON p.id = ph."profileId"
GROUP BY left(ph.url, 100)
HAVING count(DISTINCT ph."profileId") > 1
ORDER BY n_profiles DESC
LIMIT 20;

-- Offensive / spam usernames + bios
SELECT u.id, u.email, p.username, p.gender, p.country, p.city, left(coalesce(p.bio,''),80) AS bio,
       (SELECT count(*) FROM "ProfilePhoto" ph WHERE ph."profileId"=p.id) AS n_photos,
       u."createdAt"
FROM "User" u JOIN "Profile" p ON p."userId"=u.id
WHERE p.username ~* '(cock|sex|fuck|pussy|nude|slut|whore|cooch|dick|penis|xxx|onlyfans|escort|rape|nazi|hitler)'
   OR p.bio ~* '(cock|sex|fuck|pussy|nude|slut|whore|cooch|dick|penis|xxx|onlyfans|escort|rape|nazi|hitler|telegram|whatsapp|cashapp)'
   OR p.username ~* '^(test|fake|admin|bot)[0-9]*$'
ORDER BY u."createdAt" DESC
LIMIT 40;

-- Recent US males sample with photo count
SELECT u.email, p.username, p.gender, p.city, p.country,
       (SELECT count(*) FROM "ProfilePhoto" ph WHERE ph."profileId"=p.id) AS n_photos,
       left(coalesce(p.bio,''),50) AS bio,
       u."createdAt"
FROM "User" u JOIN "Profile" p ON p."userId"=u.id
WHERE u."createdAt" >= now() - interval '14 days'
  AND coalesce(p.country,'') ILIKE '%united states%'
ORDER BY u."createdAt" DESC
LIMIT 30;

-- Reports / bans if any
SELECT count(*)::int AS reports FROM "Report";
SELECT status, count(*)::int AS n FROM "Report" GROUP BY status;
SELECT left(reason,60) AS reason, count(*)::int AS n FROM "Report" GROUP BY 1 ORDER BY n DESC LIMIT 15;