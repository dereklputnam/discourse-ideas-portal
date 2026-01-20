// Pre-initializer runs before any other initializers
export default {
  name: "early-api-patch",

  initialize() {
    // Set up a very early patch before any API calls happen
    window.discourseIdeasPortalSafetyPatches = {
      apiSetupPatchApplied: false,
      earlyPatchApplied: true,
      errors: []
    };

    console.log("Ideas Portal: Early pre-initializer loaded - safety patches will be applied as soon as API is available");
  }
};
