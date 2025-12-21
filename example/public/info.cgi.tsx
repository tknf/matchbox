import type { CgiContext } from "../../dist/index.d.mts";

export default ({ cgiinfo }: CgiContext) => {
	return cgiinfo();
};
