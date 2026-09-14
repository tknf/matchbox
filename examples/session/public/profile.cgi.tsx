import type { CgiContext } from "../../../dist";

export default ({ $_SESSION, redirect }: CgiContext) => {
	const user = $_SESSION.user;
	if (
		typeof user !== "object" ||
		user === null ||
		!("username" in user) ||
		typeof user.username !== "string" ||
		!("loginTime" in user) ||
		typeof user.loginTime !== "string"
	) {
		return redirect("/login.cgi");
	}

	return (
		<div>
			<h1>Profile</h1>
			<p>Welcome, {user.username}!</p>
			<p>Login time: {user.loginTime}</p>

			<h2>Session Data:</h2>
			<pre>
				<code>{JSON.stringify(user, null, 2)}</code>
			</pre>

			<p>
				<a href="/logout.cgi">Logout</a> | <a href="/">Home</a>
			</p>
		</div>
	);
};
