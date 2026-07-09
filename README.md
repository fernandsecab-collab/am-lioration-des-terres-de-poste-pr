# SECAB Couplage Expert Premium V20.3

Correction ciblée de la V20.2.

## Correctifs V20.3
- Correction du plantage écran blanc dans l’onglet **Registre EDF / DOE**.
- Ajout de `syncAudit` dans le composant Registre.
- Ajout des fonctions manquantes `saveAudit()` et `saveBackup()`.
- Conservation des modules V19/V20 : packages `.secabpkg`, `.secabday`, UUID, photos intégrées, import bureau, checksum, sauvegarde, audit sync.
- Formule EDF verrouillée : `Rc = (RM + RNi - RMN) / 2`, puis `c = Rc / RM`.

## GitHub
Remplacer les fichiers du dépôt, commit, puis relancer **Windows Electron Build**.
