import path from "path";
import pino from "pino";

export const LOG_INFO_FILE = path.join(import.meta.dirname, ".logs", "info.log");
export const LOG_ERROR_FILE = path.join(import.meta.dirname, ".logs", "error.log");
export const LOG_FATAL_FILE = path.join(import.meta.dirname, ".logs", "fatal.log");

const log = pino(
  {
    level: "trace",
  },
  pino.transport({
    level: "trace",
    targets: [
      {
        target: path.join(import.meta.dirname, "transport.js"),
        level: "fatal",
        options: {
          level: "fatal",
          destination: LOG_FATAL_FILE,
        },
      },
      {
        target: path.join(import.meta.dirname, "transport.js"),
        level: "error",
        options: {
          level: "error",
          destination: LOG_ERROR_FILE,
        },
      },
      {
        target: path.join(import.meta.dirname, "transport.js"),
        level: "info",
        options: {
          level: "info",
          destination: LOG_INFO_FILE,
        },
      },
      {
        level: "info",
        target: "pino-pretty",
      },
    ],
  })
);

export default log;

export const error = log.error.bind(log);
export const info = log.info.bind(log);
export const fatal = log.fatal.bind(log);
