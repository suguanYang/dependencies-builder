import path from "path";
import pino from "pino";

const log = pino(
  {
    level: "trace",
  },
  pino.transport({
    level: "trace",
    targets: [
      // {
      //   target: path.join(import.meta.dirname, "transport.js"),
      //   level: "fatal",
      //   options: {
      //     level: "fatal",
      //     destination: path.join(import.meta.dirname, ".logs", "fatal.log"),
      //   },
      // },
      // {
      //   target: path.join(import.meta.dirname, "transport.js"),
      //   level: "error",
      //   options: {
      //     level: "error",
      //     destination: path.join(import.meta.dirname, ".logs", "error.log"),
      //   },
      // },
      // {
      //   target: path.join(import.meta.dirname, "transport.js"),
      //   level: "info",
      //   options: {
      //     level: "info",
      //     destination: path.join(import.meta.dirname, ".logs", "info.log"),
      //   },
      // },
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