import { apiInitializer } from "discourse/lib/api";

// Use version 0.8 to load very early in the initialization process
export default apiInitializer("0.8", (api) => {
  // Create a debug log for window errors
  const windowErrorLog = [];
  window.viewWindowErrorLog = function() {
    console.table(windowErrorLog);
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

        // Log detail for debugging
        console.debug('Intercepted window error:', {
          error: event.error,
          stack: event.error.stack,
          url: window.location.href,
          source: 'window error handler'
        });

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

        // Log detail for debugging
        console.debug('Intercepted promise rejection:', {
          reason: event.reason,
          stack: event.reason.stack,
          url: window.location.href,
          source: 'unhandledrejection handler'
        });

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

  console.log("Window error tracking initialized. Type 'window.viewWindowErrorLog()' in console to see window error details.");
});
