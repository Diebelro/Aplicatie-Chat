-- Semnale: oameni reali vs conturi goale / ads / spam

SELECT
  count(*)::int AS users,
  count(*) FILTER (WHERE "emailVerified" IS NOT NULL)::int AS email_verified,
  count(*) FILTER (WHERE "emailVerified" IS NULL)::int AS email_unverified
FROM "User";

-- Activitate
SELECT
  (SELECT count(DISTINCT "fromUserId") FROM "Swipe")::int AS users_who_swiped,
  (SELECT count(DISTINCT "fromId") FROM "Message")::int AS users_who_messaged,
  (SELECT count(*) FROM "Message")::int AS messages_total,
  (SELECT count(*) FROM "Swipe")::int AS swipes_total,
  (SELECT count(*) FROM "Match")::int AS matches_total,
  (SELECT count(DISTINCT "userId") FROM "UserSession")::int AS users_with_session,
  (SELECT count(DISTINCT "userId") FROM "DeviceFingerprint")::int AS users_with_device,
  (SELECT count(DISTINCT "userId") FROM "UserPushDevice")::int AS users_with_push;

-- Același fingerprint pe mai multe conturi (farm)
SELECT left(fingerprint, 24) AS fp, count(DISTINCT "userId")::int AS n_users,
       string_agg(DISTINCT u.email, ', ') AS emails
FROM "DeviceFingerprint" d
JOIN "User" u ON u.id = d."userId"
GROUP BY fingerprint
HAVING count(DISTINCT "userId") > 1
ORDER BY n_users DESC
LIMIT 15;

-- Același IP pe mai multe conturi
SELECT ip, count(DISTINCT "userId")::int AS n_users
FROM "DeviceFingerprint"
WHERE ip IS NOT NULL AND ip <> ''
GROUP BY ip
HAVING count(DISTINCT "userId") > 2
ORDER BY n_users DESC
LIMIT 15;

-- Femei: poze, bio, țară
SELECT p.username, p.country, p.city,
       (SELECT count(*) FROM "ProfilePhoto" ph WHERE ph."profileId"=p.id) AS n_photos,
       left(coalesce(p.bio,''), 50) AS bio,
       u."emailVerified" IS NOT NULL AS verified,
       u."createdAt"
FROM "User" u JOIN "Profile" p ON p."userId"=u.id
WHERE p.gender = 'female'
ORDER BY u."createdAt" DESC
LIMIT 35;

-- Bărbați US recenți: câte au poză reală vs default vs zero
SELECT
  count(*)::int AS us_males_14d,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "ProfilePhoto" ph WHERE ph."profileId"=p.id))::int AS with_any_photo,
  count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "ProfilePhoto" ph WHERE ph."profileId"=p.id))::int AS no_photo,
  count(*) FILTER (WHERE u."emailVerified" IS NOT NULL)::int AS verified
FROM "User" u JOIN "Profile" p ON p."userId"=u.id
WHERE u."createdAt" >= now() - interval '14 days'
  AND p.gender = 'male'
  AND coalesce(p.country,'') ILIKE '%united states%';

-- Poze: câte sunt data: (default) vs URL upload
SELECT
  count(*)::int AS photos_total,
  count(*) FILTER (WHERE url LIKE 'data:%')::int AS data_uri_defaultish,
  count(*) FILTER (WHERE url LIKE '/uploads%' OR url LIKE 'http%')::int AS uploaded_url,
  count(DISTINCT "profileId")::int AS profiles_with_photo_row
FROM "ProfilePhoto";

-- Signups pe zi ultimele 14 zile
SELECT date_trunc('day', "createdAt")::date AS d, count(*)::int AS n
FROM "User"
WHERE "createdAt" >= now() - interval '14 days'
GROUP BY 1 ORDER BY 1;
