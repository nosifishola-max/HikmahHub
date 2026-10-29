// Release A defaults: enable only in a separately reviewed commit AFTER the
// matching migrations and connected preview acceptance tests have passed.
// These switches control presentation; database authorization remains mandatory.
export const releaseFeatures = {
  profileRepair: false,
  eventDiscussion: false,
  moderationQueue: false,
  privacyRequests: false,
  vendorReviews: false // Issue #3 explicitly defers this experiment.
};
