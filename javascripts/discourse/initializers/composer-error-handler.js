import { apiInitializer } from "discourse/lib/api";

// Use version 0.8 to load very early in the initialization process
export default apiInitializer("0.8", (api) => {
  // Create a debug log for window errors (but don't log every interception to console)
  const windowErrorLog = [];
  window.viewWindowErrorLog = function() {
    console.table(windowErrorLog);
    return windowErrorLog;
  };

  // Add a global window error handler that specifically targets the error we're seeing
  const errorHandler = function(event) {
    // Always log the error for debugging
    if (event && event.error) {
      const errorInfo = {
        timestamp: new Date().toISOString(),
        type: 'window.error',
        errorType: event.error.constructor ? event.error.constructor.name : typeof event.error,
        message: event.error.message || event.error.toString(),
        file: event.filename,
        lineNumber: event.lineno,
        columnNumber: event.colno,
        stack: event.error.stack ? event.error.stack.split('\n').slice(0, 5).join('\n') : 'no stack'
      };

      windowErrorLog.push(errorInfo);

      // Check if the error matches our pattern
      if (event.error.toString &&
          event.error.toString().includes("Cannot read properties of undefined (reading 'id')")) {

        // Silently suppress - only log if verbose mode is enabled
        if (window.ideasPortalVerboseErrors) {
          console.debug('Ideas Portal: Suppressed window error:', {
            error: event.error,
            stack: event.error.stack,
            url: window.location.href,
            source: 'window error handler'
          });
        }

        errorInfo.suppressed = true;

        // Prevent the error from appearing in console
        event.preventDefault();
        return true; // Signal that we've handled the error
      }
    }
  };

  // Add a handler for unhandled promise rejections too
  const rejectionHandler = function(event) {
    // Always log the rejection for debugging
    if (event && event.reason) {
      const rejectionInfo = {
        timestamp: new Date().toISOString(),
        type: 'unhandled.promise',
        errorType: event.reason.constructor ? event.reason.constructor.name : typeof event.reason,
        message: event.reason.message || event.reason.toString(),
        stack: event.reason.stack ? event.reason.stack.split('\n').slice(0, 5).join('\n') : 'no stack'
      };

      windowErrorLog.push(rejectionInfo);

      // Check if the rejection reason matches our pattern
      if (event.reason.toString &&
          event.reason.toString().includes("Cannot read properties of undefined (reading 'id')")) {

        // Silently suppress - only log if verbose mode is enabled
        if (window.ideasPortalVerboseErrors) {
          console.debug('Ideas Portal: Suppressed promise rejection:', {
            reason: event.reason,
            stack: event.reason.stack,
            url: window.location.href,
            source: 'unhandledrejection handler'
          });
        }

        rejectionInfo.suppressed = true;

        // Prevent the error from appearing in console
        event.preventDefault();
        return true;
      }
    }
  };

  // Add the error handlers immediately - they need to be active as early as possible
  window.addEventListener("error", errorHandler, true);
  window.addEventListener("unhandledrejection", rejectionHandler, true);

  // Provide helper function to view error stats
  window.ideasPortalErrorStats = function() {
    const stats = {
      totalErrors: windowErrorLog.length,
      suppressed: windowErrorLog.filter(e => e.suppressed).length,
      notSuppressed: windowErrorLog.filter(e => !e.suppressed).length
    };
    console.table([stats]);
    console.log("Run window.viewWindowErrorLog() to see all errors");
    console.log("Set window.ideasPortalVerboseErrors = true to see suppressed errors in console");
    return stats;
  };

  // Silent initialization - only log if there are immediate errors or verbose mode
  if (window.ideasPortalVerboseErrors) {
    console.log("Ideas Portal: Error handler initialized. Run window.ideasPortalErrorStats() for details.");
  }
});
