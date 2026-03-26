export function registerExceptionHandlers({ logger, dialog }) {
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception:", error);
    dialog.showErrorBox("Application Error", `Unhandled error occurred: ${error.message}`);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Promise rejection:", reason);
    dialog.showErrorBox(
      "Promise Error",
      `Unhandled Promise rejection: ${reason instanceof Error ? reason.message : String(reason)}`
    );
  });
}
