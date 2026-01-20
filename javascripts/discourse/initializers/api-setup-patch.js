import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.14.0", (api) => {
  // Track if we've applied our safety patch
  window.discourseIdeasPortalSafetyPatches = window.discourseIdeasPortalSafetyPatches || {
    apiSetupPatchApplied: false,
    decorationCount: 0,
    skippedCount: 0,
    errors: []
  };

  // Only apply once
  if (window.discourseIdeasPortalSafetyPatches.apiSetupPatchApplied) {
    return;
  }

  // Wrap the decorateCookedElement API method to add safety checks
  const originalDecorateCookedElement = api.decorateCookedElement;

  api.decorateCookedElement = function(callback, opts) {
    window.discourseIdeasPortalSafetyPatches.decorationCount++;

    // Wrap the callback with error handling
    const safeCallback = function(elem, helper) {
      try {
        // Add safety check for helper and helper.getModel()
        // This check runs BEFORE the callback is executed
        if (helper && typeof helper.getModel === 'function') {
          try {
            const model = helper.getModel();
            // If model is undefined or doesn't have an id, skip this decoration
            if (!model || typeof model.id === 'undefined') {
              window.discourseIdeasPortalSafetyPatches.skippedCount++;
              // Only log if verbose mode is enabled
              if (window.ideasPortalVerboseErrors) {
                console.debug(`Ideas Portal: Skipped decoration callback due to undefined model or model.id (callback: ${opts?.id || 'unknown'})`);
              }
              return;
            }
          } catch (modelError) {
            // If getModel() throws an error, skip this decoration
            window.discourseIdeasPortalSafetyPatches.skippedCount++;
            if (window.ideasPortalVerboseErrors) {
              console.debug(`Ideas Portal: getModel() threw an error, skipping decoration (callback: ${opts?.id || 'unknown'}):`, modelError);
            }
            return;
          }
        } else if (!helper) {
          // Helper is completely undefined
          window.discourseIdeasPortalSafetyPatches.skippedCount++;
          if (window.ideasPortalVerboseErrors) {
            console.debug(`Ideas Portal: Helper is undefined, skipping decoration (callback: ${opts?.id || 'unknown'})`);
          }
          return;
        }

        // Call the original callback
        return callback.call(this, elem, helper);
      } catch (e) {
        // Log error to console always since this is unexpected
        console.error(`Ideas Portal: Caught unexpected error in decorateCookedElement callback (${opts?.id || 'unknown'}):`, e);
        window.discourseIdeasPortalSafetyPatches.errors.push({
          timestamp: new Date().toISOString(),
          source: 'decorateCookedElement callback wrapper',
          error: e.toString(),
          stack: e.stack,
          callbackId: opts?.id || 'unknown'
        });
        // Return undefined to prevent further issues
        return undefined;
      }
    };

    // Call the original method with our safe callback
    return originalDecorateCookedElement.call(this, safeCallback, opts);
  };

  window.discourseIdeasPortalSafetyPatches.apiSetupPatchApplied = true;

  // Silent initialization - only log if verbose mode is enabled
  if (window.ideasPortalVerboseErrors) {
    console.log("Ideas Portal: Successfully wrapped decorateCookedElement API with safety checks");
  }

  // Expose statistics
  window.viewIdeasPortalStats = function() {
    const stats = {
      totalDecorations: window.discourseIdeasPortalSafetyPatches.decorationCount,
      skippedDecorations: window.discourseIdeasPortalSafetyPatches.skippedCount,
      errors: window.discourseIdeasPortalSafetyPatches.errors.length
    };
    console.table([stats]);
    if (window.discourseIdeasPortalSafetyPatches.errors.length > 0) {
      console.log("Errors:", window.discourseIdeasPortalSafetyPatches.errors);
    }
    console.log("Set window.ideasPortalVerboseErrors = true to see detailed logs");
    return stats;
  };

  // Expose a way to view any errors caught by our patch
  window.viewIdeasPortalPatchErrors = function() {
    console.table(window.discourseIdeasPortalSafetyPatches.errors);
    return window.discourseIdeasPortalSafetyPatches.errors;
  };
});
