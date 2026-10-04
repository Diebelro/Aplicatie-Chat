-- Găsește user + șterge pozele de profil
SELECT u.id, u.email, p.username, p.id AS profile_id,
       (SELECT count(*) FROM "ProfilePhoto" ph WHERE ph."profileId"=p.id) AS photos_before
FROM "User" u
JOIN "Profile" p ON p."userId"=u.id
WHERE lower(p.username) = 'sorinioan'
   OR lower(p.username) LIKE 'sorinioan%'
   OR lower(u.email) LIKE '%sorinioan%';

DELETE FROM "ProfilePhoto"
WHERE "profileId" IN (
  SELECT p.id FROM "Profile" p
  WHERE lower(p.username) = 'sorinioan'
     OR lower(p.username) LIKE 'sorinioan%'
);

SELECT u.id, u.email, p.username,
       (SELECT count(*) FROM "ProfilePhoto" ph WHERE ph."profileId"=p.id) AS photos_after
FROM "User" u
JOIN "Profile" p ON p."userId"=u.id
WHERE lower(p.username) = 'sorinioan'
   OR lower(p.username) LIKE 'sorinioan%';
