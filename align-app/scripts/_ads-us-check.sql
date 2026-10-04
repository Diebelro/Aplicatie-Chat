SELECT country, count(*)::int AS profiles
FROM "Profile"
GROUP BY 1
ORDER BY 2 DESC;

SELECT
  count(*) FILTER (WHERE country = 'United States')::int AS us_profiles,
  count(*) FILTER (WHERE country = 'United Kingdom')::int AS uk_profiles,
  count(*) FILTER (WHERE country = 'România' OR country = 'Romania')::int AS ro_profiles,
  count(*) FILTER (WHERE country = 'Deutschland' OR country = 'Germany')::int AS de_profiles,
  count(*) FILTER (WHERE country IS NULL OR trim(country) = '')::int AS empty_country
FROM "Profile";

SELECT date_trunc('day', u."createdAt")::date AS day,
       count(*)::int AS signups,
       count(*) FILTER (WHERE p.country = 'United States')::int AS us,
       count(*) FILTER (WHERE p.country = 'Deutschland' OR p.country = 'Germany')::int AS de,
       count(*) FILTER (WHERE p.country = 'România' OR p.country = 'Romania')::int AS ro,
       count(*) FILTER (WHERE p.country IS NULL OR trim(p.country) = '')::int AS no_country
FROM "User" u
LEFT JOIN "Profile" p ON p."userId" = u.id
WHERE u."createdAt" >= now() - interval '14 days'
GROUP BY 1
ORDER BY 1 DESC;

SELECT u.email, p.username, p.city, p.country, u."createdAt"
FROM "User" u
JOIN "Profile" p ON p."userId" = u.id
WHERE p.country = 'United States'
ORDER BY u."createdAt" DESC
LIMIT 20;