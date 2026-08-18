# JIRA Mail / SAP Time Tracking Extension

Chrome extension that composes emails, tracks Jira issues, and logs time entries into SAP (Fiori app `ZONETIME5`, OData service `Z_ONETIME_SRV`).

## Language

**TO_BE_MODIFIED entry**:
A SAP time entry posted with the literal string `TO_BE_MODIFIED` at the start of its comment/text field, used as a placeholder when the PSP element and Issue reference aren't known yet at logging time. Resolved later by editing the entry once both are known.
_Avoid_: placeholder entry, draft entry

**Issue reference**:
The incident or RFC identifier (e.g. `INC1234567`) prepended to a time entry's comment as `<reference>: <comment>`. Auto-detected from the active Jira tab during normal time logging; entered manually when resolving a TO_BE_MODIFIED entry, since there's no associated live Jira tab at that point.
_Avoid_: itsm, ticket ID

**PSP element**:
The SAP work breakdown element (`TargetElementKey`/`TargetElementType` on a time entry) that time is booked against.
_Avoid_: WBS, order, target element

**Time entry profile**:
A saved bundle (name, type de prestation, PSP element, position) configured in Options for quick reuse when logging time. Applying one to a TO_BE_MODIFIED entry overwrites the entry's type de prestation, PSP element, and position wholesale — not just the PSP element — since these entries were logged with placeholder values across the board, not just a missing PSP.
