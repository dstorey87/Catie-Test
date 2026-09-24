## Changelog
- Fixed: the admin could silently lose the admin screens. `TTAuth.profile()` asked the server
  for "one profile" without saying whose; the admin may read every profile, so the server
  returned whichever row it stores first. Proven on the live database (inside a rolled-back
  transaction): after Darren's own profile row is written, that first row is Catie's, and
  `isAdmin()` answered no. It now asks for the signed-in account's own row by id, and asks
  nothing when signed out.

## Requirements
- No REQUIREMENTS.md line changes status: this keeps the existing admin screens working.

## Status
- Bug found while starting issue #4 (server-privacy); fixed and tested before that feature
  work, because the new "save my age" call writes the admin's own profile row and would
  have triggered it every time.
