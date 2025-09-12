import type { DestinationStream, Level } from 'pino';
import pretty from "pino-pretty";

export default async (options: {
  destination: DestinationStream;
  level: Level;
}) => {
  return pretty({
    colorize: false,
    destination: options.destination,
    append: false,
    minimumLevel: options.level,
  });
};
