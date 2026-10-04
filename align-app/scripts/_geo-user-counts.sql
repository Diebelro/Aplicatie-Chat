SELECT coalesce(nullif(trim(p.country), ''), '(gol)') AS country, count(*) AS n
FROM "Profile" p
JOIN "User" u ON u.id = p."userId"
WHERE coalesce(u."isBanned", false) = false
GROUP BY 1
ORDER BY n DESC
LIMIT 40;
