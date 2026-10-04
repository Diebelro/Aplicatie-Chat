SELECT count(*)::int AS swipes, count(DISTINCT "fromUserId")::int AS swipers FROM "Swipe";
SELECT count(*)::int AS messages FROM "Message";
SELECT count(*)::int AS matches FROM "Match";
SELECT count(DISTINCT "userId")::int AS with_session FROM "UserSession";
SELECT count(DISTINCT "userId")::int AS with_push FROM "UserPushDevice";

-- câte poze unice vs default
SELECT count(*)::int AS distinct_photo_blobs
FROM (SELECT md5(url) AS h FROM "ProfilePhoto" GROUP BY 1) x;

SELECT md5(url) AS h, count(*)::int AS n
FROM "ProfilePhoto"
GROUP BY 1
ORDER BY n DESC
LIMIT 8;

-- femei cu nume masculin evident
SELECT p.username, p.gender, u.email
FROM "Profile" p JOIN "User" u ON u.id = p."userId"
WHERE p.gender = 'female'
  AND p.username ~* '^(marius|costel|stefan|sorin|madalin|cornel|mircea|daniel|ionut|alexandru|vasile|gheorghe)';
