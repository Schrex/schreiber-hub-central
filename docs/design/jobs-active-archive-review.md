# Jobs Active/Archive: review

Exported from `jobs-active-archive.html` (2026-10-26).

## v1
- Active / Archive tabs on /jobs
- Status control on the job page (office/admin)
- completed_at + completed_by, set by a trigger
- Archive search + year filter + paging
- Archived banner + Reopen (full read-only moved to later in rev 2)
- Fix status badge contrast
- Hold reason
- 'Today' line + crew-on-site dot
- Future schedule assignment + whiteboard tile cleanup (added in rev 2)
- Schedule carry-forward limited to active jobs; job picker rules (added in rev 2)

## Later
- Company pulse strip (moved from v1 in rev 2)
- Full read-only sections on archived jobs (moved from v1 in rev 2)
- Notify the foreman and crew when a job goes on hold or is completed
- Group by foreman view
- Progress bar
- Closeout summary on archived jobs
- Map view of active jobs
- Home tile: 'X jobs running'
- Server-side read-only enforcement

## Dropped
- (none)

## Decisions
- Where do on-hold jobs live? **Active tab, with a badge**
- Who can see the Archive? **Everyone**
- Source of truth for jobs? **Manual in the Hub**
- Default Active card style? **A · Rich**
