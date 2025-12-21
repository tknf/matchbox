import type { CgiContext } from "../../../dist";

export default ({ $_GET, redirect }: CgiContext) => {
	const target = $_GET.target;

	if (target === "hello") {
		return redirect("/hello.cgi");
	}

	if (target === "info") {
		return redirect("/info.cgi");
	}

	return (
		<div>
			<h1>Redirect Example</h1>
			<p>Click a link to be redirected:</p>
			<ul>
				<li>
					<a href="/redirect-example.cgi?target=hello">Redirect to Hello</a>
				</li>
				<li>
					<a href="/redirect-example.cgi?target=info">Redirect to Info</a>
				</li>
			</ul>
		</div>
	);
};
