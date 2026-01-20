import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.8", (api) => {
  // Track if we've applied our safety patch
  window.discourseIdeasPortalSafetyPatches = window.discourseIdeasPortalSafetyPatches || {
    apiSetupPatchApplied: false,
    errors: []
  };

  // Only apply once
  if (window.discourseIdeasPortalSafetyPatches.apiSetupPatchApplied) {
    return;
  }

  // Wrap the decorateCookedElement API method to add safety checks
  const originalDecorateCookedElement = api.decorateCookedElement;

  api.decorateCookedElement = function(callback, opts) {
    // Wrap the callback with error handling
    const safeCallback = function(elem, helper) {
      try {
        // Add safety check for helper.getModel()
        if (helper && helper.getModel) {
          const model = helper.getModel();
          if (!model || typeof model.id === 'undefined') {
            console.debug('Ideas Portal: Skipped decoration callback due to undefined model.id');
            return;
          }
        }

        // Call the original callback
        return callback.call(this, elem, helper);
      } catch (e) {
        // Log but don't propagate the error
        console.debug('Ideas Portal: Caught error in decorateCookedElement callback:', e);
        window.discourseIdeasPortalSafetyPatches.errors.push({
          timestamp: new Date().toISOString(),
          source: 'decorateCookedElement callback wrapper',
          error: e.toString(),
          stack: e.stack,
          callbackId: opts?.id || 'unknown'
        });
      }
    };

    // Call the original method with our safe callback
    return originalDecorateCookedElement.call(this, safeCallback, opts);
  };

  window.discourseIdeasPortalSafetyPatches.apiSetupPatchApplied = true;
  console.log("Ideas Portal: Successfully wrapped decorateCookedElement API with safety checks");

  // Try to also patch the internal service if available
  try {
    const pluginApiInstance = api.container.lookup("service:plugin-api");
    if (pluginApiInstance?.decorateCookedPlugin?._decorateCookedElement) {
      const originalInternal = pluginApiInstance.decorateCookedPlugin._decorateCookedElement;

      pluginApiInstance.decorateCookedPlugin._decorateCookedElement = function(post, helper) {
        try {
          if (!helper || !helper.getModel) {
            return;
          }

          const model = helper.getModel();
          if (!model || typeof model.id === 'undefined') {
            console.debug('Ideas Portal: Skipped internal decoration due to undefined model.id');
            return;
          }

          return originalInternal.apply(this, arguments);
        } catch (e) {
          console.debug('Ideas Portal: Caught error in internal _decorateCookedElement:', e);
          window.discourseIdeasPortalSafetyPatches.errors.push({
            timestamp: new Date().toISOString(),
            source: 'internal _decorateCookedElement',
            error: e.toString(),
            stack: e.stack
          });
        }
      };

      console.log("Ideas Portal: Successfully patched internal _decorateCookedElement");
    }
  } catch (e) {
    console.debug("Ideas Portal: Could not patch internal service (may not be available yet):", e);
  }

  // Expose a way to view any errors caught by our patch
  window.viewIdeasPortalPatchErrors = function() {
    console.table(window.discourseIdeasPortalSafetyPatches.errors);
    return window.discourseIdeasPortalSafetyPatches.errors;
  };
});
