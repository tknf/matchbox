import type { CgiContext } from "../../../dist";

export default ({ cgiinfo }: CgiContext) => {
	return cgiinfo();
};
