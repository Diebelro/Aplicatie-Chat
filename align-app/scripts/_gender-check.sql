SELECT coalesce(p.gender,'(gol)') AS gender, count(*)::int AS n
FROM "User" u
JOIN "Profile" p ON p."userId" = u.id
WHERE u."createdAt" >= now() - interval '7 days'
GROUP BY 1 ORDER BY 2 DESC;

SELECT coalesce(p.country,'(gol)') AS country, coalesce(p.gender,'(gol)') AS gender, count(*)::int AS n
FROM "User" u
JOIN "Profile" p ON p."userId" = u.id
WHERE u."createdAt" >= now() - interval '7 days'
  AND (p.country = 'United States' OR p.country IS NULL OR trim(p.country)='')
GROUP BY 1,2 ORDER BY 1, 3 DESC;

SELECT coalesce(p.gender,'(gol)') AS gender, count(*)::int AS n
FROM "Profile" p
WHERE p.country = 'United States'
GROUP BY 1 ORDER BY 2 DESC;

SELECT u.email, p.username, p.gender, p.city, p.country, u."createdAt"
FROM "User" u
JOIN "Profile" p ON p."userId" = u.id
WHERE p.country = 'United States'
ORDER BY u."createdAt" DESC;