import { createCgiWithPages, type Page, type RewriteMap, type MatchboxOptions } from "./cgi";

declare const __MATCHBOX_CONFIG__: Record<string, any> | undefined;

const loadPagesFromPublic = () => {
	const modules = import.meta.glob("/public/**/*.cgi.{tsx,jsx}", {
		eager: true,
	});
	const htpasswds = import.meta.glob("/public/**/.htpasswd", {
		eager: true,
		query: "?raw",
		import: "default",
	});
	const htaccessFiles = import.meta.glob("/public/**/.htaccess", {
		eager: true,
		query: "?raw",
		import: "default",
	});
	
	// Note: .htdigest and .htgroup files are loaded for future implementation.
	// They are currently used only for build-time inclusion and runtime blocking.
	// We intentionally discard the result to avoid unused-variable warnings while
	// still ensuring these files are included by the bundler.
	void import.meta.glob("/public/**/.htdigest", {
		eager: true,
		query: "?raw",
		import: "default",
	});
	void import.meta.glob("/public/**/.htgroup", {
		eager: true,
		query: "?raw",
		import: "default",
	});

	const basePathRegex = /^\/public/;

	const pages: Page[] = Object.keys(modules).map((key) => {
		const urlPath = key
			.replace(basePathRegex, "")
			.replace(/.tsx$/, "")
			.replace(/.jsx$/, "");
		const isIndex = urlPath.endsWith("/index.cgi") || urlPath === "/index.cgi";
		const dirPath = isIndex ? urlPath.replace(/\/index\.cgi$/, "/") : null;
		return { urlPath, dirPath, component: (modules as any)[key].default };
	});

	const authMap = Object.keys(htpasswds).reduce(
		(acc, key) => {
			const dir =
				key.replace(basePathRegex, "").replace(/\.htpasswd$/, "") || "/";
			acc[dir] = htpasswds[key] as string;
			return acc;
		},
		{} as Record<string, string>,
	);

	const rewriteMap = Object.keys(htaccessFiles).reduce((acc, key) => {
		const dir =
			key.replace(basePathRegex, "").replace(/\.htaccess$/, "") || "/";
		const lines = (htaccessFiles[key] as string).split("\n");
		const rules = lines
			.map((line) => {
				const l = line.trim();
				if (!l || l.startsWith("#")) return null;
				const parts = l.split(/\s+/);
				if (parts[0] === "RewriteRule") {
					return {
						type: "rewrite",
						pattern: parts[1],
						target: parts[2],
						flags: parts[3] || "",
					};
				}
				if (parts[0] === "Redirect") {
					return {
						type: "redirect",
						code: parts[1],
						source: parts[2],
						target: parts[3],
					};
				}
				return null;
			})
			.filter(Boolean) as RewriteMap[string];
		acc[dir] = rules;
		return acc;
	}, {} as RewriteMap);

	return { pages, authMap, rewriteMap };
};

export const createCgi = (options?: MatchboxOptions) => {
	const resolvedConfig =
		typeof __MATCHBOX_CONFIG__ === "undefined" ? {} : __MATCHBOX_CONFIG__;
	const { pages, authMap, rewriteMap } = loadPagesFromPublic();
	return createCgiWithPages(pages, resolvedConfig, authMap, rewriteMap, options);
};
