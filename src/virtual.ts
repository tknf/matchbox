export const generateVirtualModule = ({
	publicDir = "public",
	config = {},
}): string => {
	return `
		const modules = import.meta.glob('/${publicDir}/**/*.cgi.{tsx,jsx}', { eager: true });
		const urls = import.meta.glob('/${publicDir}/**/*.cgi.{tsx,jsx}', { eager: true, query: '?url', import: 'default' });
		const htpasswds = import.meta.glob('/${publicDir}/**/.htpasswd', { eager: true, query: '?raw', import: 'default' });
		const htaccessFiles = import.meta.glob('/${publicDir}/**/.htaccess', { eager: true, query: '?raw', import: 'default' });

		export const pages = Object.keys(modules).map(key => {
			const rawUrl = urls[key];
			const urlPath = rawUrl.replace(new RegExp('^\\\/${publicDir}'), '').replace(/.tsx$/, '').replace(/.jsx$/, '');
			const isIndex = urlPath.endsWith('/index.cgi') || urlPath === '/index.cgi';
			const dirPath = isIndex ? urlPath.replace(/\\/index\\.cgi$/, '/') : null;
			return { urlPath, dirPath, component: modules[key].default };
		});

		export const authMap = Object.keys(htpasswds).reduce((acc, key) => {
			const dir = key.replace(new RegExp('^\\\/${publicDir}'), '').replace(//.htpasswd$/, '') || '/';
			acc[dir] = htpasswds[key];
			return acc;
		}, {});

		export const rewriteMap = Object.keys(htaccessFiles).reduce((acc, key) => {
			const dir = key.replace(new RegExp('^\\\/${publicDir}'), '').replace(//.htaccess$/, '') || '/';
			const lines = htaccessFiles[key].split('\\n');
			const rules = lines.map(line => {
				const l = line.trim();
				if (!l || l.startsWith('#')) return null;
				const parts = l.split(/\\s+/);
				if (parts[0] === 'RewriteRule') return { type: 'rewrite', pattern: parts[1], target: parts[2], flags: parts[3] || '' };
				if (parts[0] === 'Redirect') return { type: 'redirect', code: parts[1], source: parts[2], target: parts[3] };
				return null;
			}).filter(Boolean);
			acc[dir] = rules;
			return acc;
		}, {});

		export const config = ${JSON.stringify(config)};
	`;
};
