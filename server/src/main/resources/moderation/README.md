# On-device moderation word list (spec §9)

- `en.txt`: the English list from "List of Dirty, Naughty, Obscene, and Otherwise Bad Words"
  (https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words), by
  Shutterstock and contributors, licensed CC BY 4.0 (`LICENSE-LDNOOBW.txt`). Unmodified.
- `exclusions.txt`: our changes. Entries from `en.txt` we do not block, because they are ordinary
  trivia (titles, names, places, anatomy, everyday words), each with the reason.
- `roots.txt`: words also caught inside other words ("fuckface"). Only roots no ordinary word
  contains belong here (not "cunt": Scunthorpe).

To update `en.txt`, replace it with the upstream file and re-run the server tests.
