SELECT u.id, u.email, p.username, p.name, u."isBanned",
       (SELECT count(*) FROM "ProfilePhoto" ph WHERE ph."profileId"=p.id) AS photos
FROM "User" u
JOIN "Profile" p ON p."userId"=u.id
WHERE lower(p.username) LIKE '%sorin%'
   OR lower(u.email) LIKE '%soryn%'
   OR lower(u.email) LIKE '%sorin%';
