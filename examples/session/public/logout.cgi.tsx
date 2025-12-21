import type { CgiContext } from "../../../dist";

export default ({ $_SESSION, redirect }: CgiContext) => {
	delete $_SESSION.user;
	return redirect("/");
};
