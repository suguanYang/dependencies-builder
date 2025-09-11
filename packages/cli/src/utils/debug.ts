import Debugger from "debug";

const debug = Debugger("debug");
debug.log = console.log.bind(console);

export const enable = () => Debugger.enable("debug");

export default debug;
