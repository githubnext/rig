# 550 - Venue Booking Diff Writer

```rig
import { agent, p, s } from "rig";

// Agent role: compare two embedded venue booking snapshots, compute the
// incremental diff itself, write a changelog, and report the diff counts.
const venueBookingDiffWriter = agent({
  model: "mini",
  instructions: p`Yesterday's venue booking schedule (venue, time slot, event name):
    ${p.bash(`cat <<'EOF'
Oakview Hall, 09:00-11:00, Pottery Workshop
Oakview Hall, 14:00-16:00, Chess Club Meetup
Riverside Pavilion, 10:00-12:00, Farmers Market Kickoff
Riverside Pavilion, 18:00-20:00, Jazz Night
Maple Community Center, 13:00-15:00, Youth Soccer Tryouts
Maple Community Center, 19:00-21:00, Book Club Discussion
EOF`)}

    Today's venue booking schedule (venue, time slot, event name):
    ${p.bash(`cat <<'EOF'
Oakview Hall, 09:00-11:00, Pottery Workshop
Oakview Hall, 16:00-18:00, Chess Club Meetup
Riverside Pavilion, 18:00-20:00, Jazz Night
Maple Community Center, 13:00-15:00, Youth Soccer Tryouts
Maple Community Center, 19:00-21:00, Book Club Discussion
Maple Community Center, 20:00-22:00, Trivia Night
EOF`)}

    No external diff tool has been run on these; you must compute the diff
    yourself by matching bookings on (venue, event name) across the two
    snapshots:
    - A booking present only in today's snapshot (no matching venue+event in
      yesterday's) is "added".
    - A booking present only in yesterday's snapshot (no matching venue+event
      in today's) is "removed".
    - A booking present in both with the same venue and event name but a
      different time slot is "rescheduled" (do not also count it as added or
      removed).
    - A booking unchanged in venue, event name, and time slot is not part of
      the changelog.

    Draft a markdown changelog with three sections: "Added", "Removed", and
    "Rescheduled" (for rescheduled entries show the old time slot and new
    time slot). Then write that changelog to booking-changelog.md via
    ${p.write("booking-changelog.md", "<!-- incremental venue booking changelog -->")}

    Return the declared output: the path the changelog was written to, and
    the counts of added, removed, and rescheduled bookings.`,
  output: s.object({
    changelogPath: s.path,
    added: s.int,
    removed: s.int,
    rescheduled: s.int,
  }),
});

export default venueBookingDiffWriter;
```
