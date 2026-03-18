# Revenire dacă greșești ceva la aplicație

**Doar pentru lucrul tău local.** Dacă ai stricat ceva și vrei să revii la starea din repo:

## Variantă 1: Renunți la TOATE modificările locale (necomitate)

```bash
git checkout -- .
```

Revii la ultima versiune comisă. Modificările necomitate se pierd.

---

## Variantă 2: Revii la exact ce e pe GitHub (origin/main)

```bash
git fetch origin
git reset --hard origin/main
```

**Atenție:** Șterge și modificările comitate local care nu sunt pe origin. După asta, codul local = GitHub.

---

## Variantă 3: Vezi ultimele commit-uri și revii la unul anume

```bash
git log --oneline -10
```

Copiezi hash-ul commit-ului la care vrei să revii (ex. `abc1234`), apoi:

```bash
git reset --hard abc1234
```

---

*.env nu e în Git – nu se schimbă la revert. Dacă ai stricat .env, refă-l din .env.example sau din backup.*
