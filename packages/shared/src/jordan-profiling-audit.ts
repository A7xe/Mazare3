/**
 * Phase 3C.4B.2C — Jordan PDPL Profiling audit (internal).
 *
 * Profiling = automated processing used to identify a Data Subject's trends,
 * preferences, choices, or behaviour (Jordan PDPL definition).
 *
 * Verified product behaviour:
 * - Marketplace "recommended" sort ranks Properties by organic signals
 *   (bookings, reviews, media, optional session distance) — not a Data Subject
 *   behavioural profile.
 * - Favourites / search history are not used to build trend/preference profiles.
 * - No GA / Meta Pixel / similar behavioural trackers in application source.
 *
 * Conclusion: NO Jordan-defined Profiling currently occurs.
 */
export const JORDAN_PROFILING_AUDIT = {
  phase: '3C.4B.2C',
  jordanDefinedProfilingPresent: false as const,
  publicDisclosureRequired: 'STATE_NO_CURRENT_PROFILING' as const,
  notes: [
    'recommended ranking scores Properties, not Data Subject behavioural profiles',
    'favourites and search are not treated as Profiling under Jordan PDPL definition',
    'optional analytics consent exists for future use but is not active Profiling',
  ],
} as const;
