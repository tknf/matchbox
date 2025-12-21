import type { CgiContext } from "../../../dist";

export default ({ $_SESSION }: CgiContext) => {
	let count = $_SESSION.visitCount || 0;
	count++;
	$_SESSION.visitCount = count;

	return (
		<div>
			<h1>Visit Counter</h1>
			<p>You have visited this page {count} time(s).</p>
			<p>
				<a href="/counter.cgi">Refresh</a> | <a href="/">Home</a>
			</p>
		</div>
	);
};
