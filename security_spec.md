# ONEHUB 2.0 — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **PII Isolation**: Private user records in `/users/{userId}` (containing `email` and `role`) are readable and writable exclusively by `request.auth.uid == userId`. Public discovery queries `/publicProfiles/{userId}`, which never stores email addresses.
2. **Verified Identity for Writes**: All write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Immutable Ownership & Timestamps**: `uid`, `authorId`, `createdAt`, `role`, and `email` cannot be forged on create or altered on update. `createdAt == request.time` on create; `updatedAt == request.time` on update.
4. **No Self-Assigned Privilege Escalation**: `/users/{userId}` creation enforces `role == 'member'` and forbids updating `role`.
5. **Relational Integrity**:
   - Creating a `/posts/{postId}` requires an existing `/publicProfiles/{authorId}`.
   - Creating a `/comments/{commentId}`, `/likes/{likeId}`, or `/savedPosts/{savedId}` requires an existing `/posts/{postId}`.
   - Creating a `/follows/{followId}` forbids self-follow (`followerId != followingId`) and requires an existing `/publicProfiles/{followingId}`.
6. **Atomic Counter Synchronization**:
   - Updating `posts/{postId}.likesCount` (+1 / -1) requires an atomic batch verified via `existsAfter(/likes/{postId}_{uid})`.
   - Updating `posts/{postId}.commentsCount` (+1) requires an atomic batch referencing `lastCommentId` verified via `existsAfter` and `getAfter`.
7. **Terminal State Locking**: Notifications start with `read == false` and can only transition once to `read == true` by `recipientId`.
8. **Strict Query Scoping**: No blanket `allow list: if isSignedIn();` rules exist. Every `list` rule validates `resource.data` against ownership (`userId`, `recipientId`, `followerId`/`followingId`) or explicit public visibility (`visibility == 'public'` / `isPublic == true`).

## 2. The "Dirty Dozen" Adversarial Payloads

1. **PII Cross-Read Attack**: User B attempts `get(/users/userA)` -> `PERMISSION_DENIED`.
2. **Self-Assigned Admin Escalation**: User A creates `/users/userA` with `{ "role": "admin" }` -> `PERMISSION_DENIED`.
3. **Shadow Field Injection on Profile Update**: User A updates `/users/userA` with `{ "displayName": "Nova", "isVerified": true }` -> `PERMISSION_DENIED`.
4. **Author Spoofing on Post Create**: User A creates `/posts/p1` with `{ "authorId": "userB" }` -> `PERMISSION_DENIED`.
5. **Counter Tampering Without Like**: User A updates `/posts/p1` with `{ "likesCount": 9999 }` without creating `/likes/p1_userA` -> `PERMISSION_DENIED`.
6. **Orphan Comment Injection**: User A creates `/comments/c1` referencing non-existent `postId` -> `PERMISSION_DENIED`.
7. **ID Poisoning / Resource Exhaustion**: Writing invalid doc IDs or `content` > 1000 chars -> `PERMISSION_DENIED`.
8. **XSS / Base64 Blob URL Injection**: Creating `/posts/p2` with `imageUrl: "javascript:alert(1)"` -> `PERMISSION_DENIED`.
9. **Self-Follow Inflation**: User A creates `/follows/userA_userA` with `followerId == followingId` -> `PERMISSION_DENIED`.
10. **Foreign SavedPost Scraping**: User B attempts `list(/savedPosts)` unfiltered -> `PERMISSION_DENIED`.
11. **Notification Terminal Unlock**: Reverting `read: true` -> `read: false` or editing `message` -> `PERMISSION_DENIED`.
12. **Timestamp Backdating**: Creating `/posts/p3` with a client-forged `createdAt` -> `PERMISSION_DENIED`.
