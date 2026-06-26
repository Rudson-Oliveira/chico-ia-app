# Security Specification - Chico IA

## Data Invariants
1. **User Ownership**: All user-specific data (Profile, Conversations, FocoFlow items, RPA workflows, Custom Agents, Generated Images, Bug Reports) must be owned by the user (`uid` or `user_id` field).
2. **Relational Integrity**: 
   - Messages must belong to a conversation owned by the same user.
   - RPA workflows must have a valid `uid` matching the author.
3. **Immutable Fields**: `createdAt`, `uid`, `user_id` should not be modified after creation.
4. **Admin Access**: Only users with the `admin` role (verified via document lookup or hardcoded email for bootstrap) can access all data and system notifications.
5. **System Notifications**: Read-only for all authenticated users, write-able only by admins.
6. **Connectivity Test**: Open for read (authenticated or not) to allow initial health checks.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing (UserProfile)**: A user tries to create a profile with a different `uid`.
2. **Privilege Escalation (UserProfile)**: A user tries to set their own `role` to 'admin'.
3. **Ghost Field Injection**: A user tries to add an unregistered field (e.g., `isVerified: true`) to their profile.
4. **Cross-User Conversation Access**: User A tries to read User B's conversation.
5. **Message Injection**: User A tries to add a message to User B's conversation.
6. **Orphaned Message**: A user tries to create a message without a valid parent conversation ID.
7. **Resource Poisoning (RPA)**: A user tries to inject a 1MB string into a workflow title.
8. **Relational Bypass (FocoFlow)**: User A tries to update a FocoFlow item belonging to User B.
9. **Outcome Tampering (BugReport)**: A user tries to change the status of their bug report to 'resolved' (admin only).
10. **System Notification Hijack**: A non-admin user tries to create a global system notification.
11. **Timestamp Spoofing**: A user tries to set a `createdAt` date in the future.
12. **PII Leak**: A non-admin user tries to list all users.

## Conflict Report

| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning |
|------------|-------------------|--------------------|--------------------|
| /users | Blocked via `uid` match | N/A | Blocked via size checks |
| /conversations | Blocked via `uid` match | N/A | Blocked via size checks |
| /messages | Blocked via parent check | N/A | Blocked via size checks |
| /focuflow_items | Blocked via `user_id` match | Blocked via enum check | Blocked via size checks |
| /rpa_workflows | Blocked via `uid` match | Blocked via enum check | Blocked via size checks |
| /bug_reports | Blocked via `uid` match | Blocked via admin-only updates | Blocked via size checks |
| /system_notifications | Blocked via admin check | N/A | Blocked via size checks |
