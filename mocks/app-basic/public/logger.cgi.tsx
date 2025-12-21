import type { CgiContext } from "../../../src";

export default (context: CgiContext) => {
	context.log("Test log message");
	context.header("Content-Type", "application/json");
	return { logged: true };
};
