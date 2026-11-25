/**
 * ONEHUB 2.0 — Firestore Security Rules Verification Suite (Phase 0 TDD)
 * Defines the 12 "Dirty Dozen" adversarial payloads mapped against the
 * security invariants enforced in firestore.rules.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload: Record<string, unknown>;
  invariantTested: string;
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'PII Cross-Read Attack',
    collection: '/users/userA',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    payload: { requesterUid: 'userB', targetUid: 'userA' },
    invariantTested: 'PII Isolation: /users/{userId} allows get only when request.auth.uid == userId',
  },
  {
    id: 2,
    name: 'Self-Assigned Admin Escalation',
    collection: '/users/userA',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { uid: 'userA', email: 'a@example.com', role: 'admin', displayName: 'A', handle: 'user_a' },
    invariantTested: 'No Self-Assigned Roles: role must strictly equal "member"',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Profile Update',
    collection: '/users/userA',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { displayName: 'Nova', isVerified: true },
    invariantTested: 'Anti-Update-Gap: affectedKeys().hasOnly() blocks unlisted shadow fields',
  },
  {
    id: 4,
    name: 'Author Spoofing on Post Create',
    collection: '/posts/post_spoof',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { authorId: 'userB', content: 'Spoofed', topic: 'Design', visibility: 'public' },
    invariantTested: 'Identity Integrity: incoming().authorId == request.auth.uid',
  },
  {
    id: 5,
    name: 'Counter Tampering Without Atomic Like',
    collection: '/posts/post_1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { likesCount: 9999 },
    invariantTested: 'Atomicity Guarantee: likesCount must change by +/-1 with existsAfter(/likes/{postId}_{uid})',
  },
  {
    id: 6,
    name: 'Orphan Comment Injection',
    collection: '/comments/comment_orphan',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { postId: 'nonexistent_post', authorId: 'userA', text: 'Orphan', visibility: 'public' },
    invariantTested: 'Global Consistency Invariant: exists(/posts/{postId}) required on create',
  },
  {
    id: 7,
    name: 'ID Poisoning & Oversized Payload',
    collection: '/posts/invalid id with spaces',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { authorId: 'userA', content: 'x'.repeat(1500), topic: 'Ideas', visibility: 'public' },
    invariantTested: 'Path Variable Hardening: isValidId() regex + content.size() <= 1000',
  },
  {
    id: 8,
    name: 'Unsafe Scheme / Base64 Image Injection',
    collection: '/posts/post_xss',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { authorId: 'userA', content: 'Check this', imageUrl: 'javascript:alert(1)', topic: 'Technology' },
    invariantTested: 'URL Validation Blueprint: only empty, https://, or bundled /src/assets/images/*.jpg allowed',
  },
  {
    id: 9,
    name: 'Self-Follow Inflation',
    collection: '/follows/userA_userA',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { followerId: 'userA', followingId: 'userA' },
    invariantTested: 'Follow Integrity: followerId != followingId enforced',
  },
  {
    id: 10,
    name: 'Foreign SavedPost List Scraping',
    collection: '/savedPosts',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    payload: { requesterUid: 'userB', unfilteredList: true },
    invariantTested: 'Query Enforcer: allow list requires resource.data.userId == request.auth.uid',
  },
  {
    id: 11,
    name: 'Notification Terminal State Unlock',
    collection: '/notifications/notif_1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { read: false, message: 'Tampered' },
    invariantTested: 'Terminal State Locking: notifications only transition from read == false to read == true',
  },
  {
    id: 12,
    name: 'Client Timestamp Backdating',
    collection: '/posts/post_backdate',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { authorId: 'userA', content: 'Backdated', createdAt: '2020-01-01T00:00:00Z' },
    invariantTested: 'Temporal Integrity: incoming().createdAt == request.time enforced on create',
  },
];
