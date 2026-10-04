-- Ban conturi cu username/bio ofensiv sau spam WhatsApp (nu ștergem datele)
UPDATE "User"
SET "isBanned" = true
WHERE email IN (
  'josephbrown20304111@gmail.com',
  'reahwallace49@gmail.com',
  'cretorseheen@gmail.com',
  'lovejoy654321@gmail.com',
  'johnlabosky993@gmail.com',
  'negoitaciprian909@gmail.com',
  'djangelsb2019@gmail.com'
)
RETURNING id, email, "isBanned";