export default () => {
	return (
		<div>
			<h1>HTAccess + Basic Auth Example</h1>
			<p>
				This example shows how to use <code>.htaccess</code> for redirects and
				 <code>.htpasswd</code> for basic authentication.
			</p>

			<h2>Redirect + Rewrite</h2>
			<ul>
				<li>
					<a href="/new.cgi">/new.cgi</a> - Direct access
				</li>
				<li>
					<a href="/legacy">/legacy</a> - Redirects to /new.cgi via .htaccess
				</li>
				<li>
					<a href="/account">/account</a> - Redirects to /admin/account.cgi
				</li>
			</ul>

			<h2>Protected Area</h2>
			<p>
				Credentials: <strong>admin</strong> / <strong>secret</strong>
			</p>
			<ul>
				<li>
					<a href="/admin/secret.cgi">/admin/secret.cgi</a>
				</li>
				<li>
					<a href="/admin/account.cgi">/admin/account.cgi</a>
				</li>
			</ul>
		</div>
	);
};
