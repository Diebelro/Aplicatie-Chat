-- Bărbați care s-au trecut femeie (email/username masculin). NU atinge femei reale.
-- Owner diebel nu e în listă.

BEGIN;

DELETE FROM "PendingIncomingCall"
WHERE "toUserId" IN (
  'cmssevld7000u12gbwazspcpf',
  'cmsqfdu7g0bwx5h769fxjqukb',
  'cmsp21bb2084p5h762x8y2ogt',
  'cmsm732wh01c75h76w9vmvx3p',
  'cmslv417x00ks5h7635p8631j',
  'cmselzdrw02m3q0w9i1jys9bq',
  'cmsd7v47n02ggcqaif2v5k7pf',
  'cmsc03tgv00nucqaiprzbw38i',
  'cms8c0fsc03d956uyvw9pzbsz',
  'cms70ryz201pb56uycv55ag0v',
  'cms2utoci00sjo68r1798q4cn',
  'cms7ndynx02l556uyb82ms9o2',
  'cmsslnyrz013qiv3bmc1osqyf'
) OR "fromId" IN (
  'cmssevld7000u12gbwazspcpf',
  'cmsqfdu7g0bwx5h769fxjqukb',
  'cmsp21bb2084p5h762x8y2ogt',
  'cmsm732wh01c75h76w9vmvx3p',
  'cmslv417x00ks5h7635p8631j',
  'cmselzdrw02m3q0w9i1jys9bq',
  'cmsd7v47n02ggcqaif2v5k7pf',
  'cmsc03tgv00nucqaiprzbw38i',
  'cms8c0fsc03d956uyvw9pzbsz',
  'cms70ryz201pb56uycv55ag0v',
  'cms2utoci00sjo68r1798q4cn',
  'cms7ndynx02l556uyb82ms9o2',
  'cmsslnyrz013qiv3bmc1osqyf'
);

DELETE FROM "MissedCall"
WHERE "fromId" IN (
  'cmssevld7000u12gbwazspcpf',
  'cmsqfdu7g0bwx5h769fxjqukb',
  'cmsp21bb2084p5h762x8y2ogt',
  'cmsm732wh01c75h76w9vmvx3p',
  'cmslv417x00ks5h7635p8631j',
  'cmselzdrw02m3q0w9i1jys9bq',
  'cmsd7v47n02ggcqaif2v5k7pf',
  'cmsc03tgv00nucqaiprzbw38i',
  'cms8c0fsc03d956uyvw9pzbsz',
  'cms70ryz201pb56uycv55ag0v',
  'cms2utoci00sjo68r1798q4cn',
  'cms7ndynx02l556uyb82ms9o2',
  'cmsslnyrz013qiv3bmc1osqyf'
);

INSERT INTO "AdminLog" (id, "adminId", action, "targetId", details, "createdAt")
SELECT
  'clndel' || substr(md5(u.id || 'fakefem'), 1, 18),
  'cmqds5xsq00002t3cri37tn5m',
  'DELETE_USER',
  u.id,
  'Ștergere: s-a trecut femeie, e bărbat (' || coalesce(p.username,'?') || ' / ' || u.email || ')',
  now()
FROM "User" u
JOIN "Profile" p ON p."userId" = u.id
WHERE u.id IN (
  'cmssevld7000u12gbwazspcpf',
  'cmsqfdu7g0bwx5h769fxjqukb',
  'cmsp21bb2084p5h762x8y2ogt',
  'cmsm732wh01c75h76w9vmvx3p',
  'cmslv417x00ks5h7635p8631j',
  'cmselzdrw02m3q0w9i1jys9bq',
  'cmsd7v47n02ggcqaif2v5k7pf',
  'cmsc03tgv00nucqaiprzbw38i',
  'cms8c0fsc03d956uyvw9pzbsz',
  'cms70ryz201pb56uycv55ag0v',
  'cms2utoci00sjo68r1798q4cn',
  'cms7ndynx02l556uyb82ms9o2',
  'cmsslnyrz013qiv3bmc1osqyf'
)
AND u.id <> 'cmqds5xsq00002t3cri37tn5m';

DELETE FROM "User"
WHERE id IN (
  'cmssevld7000u12gbwazspcpf',
  'cmsqfdu7g0bwx5h769fxjqukb',
  'cmsp21bb2084p5h762x8y2ogt',
  'cmsm732wh01c75h76w9vmvx3p',
  'cmslv417x00ks5h7635p8631j',
  'cmselzdrw02m3q0w9i1jys9bq',
  'cmsd7v47n02ggcqaif2v5k7pf',
  'cmsc03tgv00nucqaiprzbw38i',
  'cms8c0fsc03d956uyvw9pzbsz',
  'cms70ryz201pb56uycv55ag0v',
  'cms2utoci00sjo68r1798q4cn',
  'cms7ndynx02l556uyb82ms9o2',
  'cmsslnyrz013qiv3bmc1osqyf'
)
AND id <> 'cmqds5xsq00002t3cri37tn5m'
RETURNING id, email;

COMMIT;
