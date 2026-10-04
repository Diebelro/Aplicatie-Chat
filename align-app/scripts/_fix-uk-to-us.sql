-- Americani marcați greșit ca United Kingdom (locale en → UK).
-- Criteriu: oraș cu state/nume tipic US SAU email/username evident US + UK pe profil.
UPDATE "Profile" p
SET country = 'United States'
WHERE p.country = 'United Kingdom'
  AND (
    p.city ~* '(michigan|philadelphia|texas|florida|california|arizona|ohio|georgia|illinois|colorado|nevada|carolina|virginia|tennessee|missouri|indiana|wisconsin|minnesota|alabama|louisiana|oklahoma|kentucky|oregon|washington|massachusetts|connecticut|maryland|new york|new jersey|pennsylvania|chicago|houston|dallas|atlanta|miami|seattle|denver|phoenix|detroit|boston|vegas|brooklyn|manhattan|urbana|milford|southfield|copperas|cove)'
    OR p.city ~* '\y(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\y'
  );

-- Raport după
SELECT country, count(*) FROM "Profile" GROUP BY 1 ORDER BY 2 DESC;
