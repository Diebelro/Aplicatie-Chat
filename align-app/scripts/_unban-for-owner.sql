-- Deblocare temporară: owner-ul le moderează din admin
UPDATE "User"
SET "isBanned" = false
WHERE email IN (
  'josephbrown20304111@gmail.com',
  'reahwallace49@gmail.com',
  'cretorseheen@gmail.com',
  'lovejoy654321@gmail.com',
  'johnlabosky993@gmail.com',
  'negoitaciprian909@gmail.com',
  'djangelsb2019@gmail.com'
)
RETURNING email, "isBanned";
