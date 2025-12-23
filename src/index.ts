export type {
	CgiContext,
	ConfigObject,
	MatchboxOptions,
	ModuleInfo,
	Page,
	SessionCookieOptions,
	HtaccessConfig,
} from "./cgi.js";
export { createCgi } from "./with-defaults.js";

// Export htaccess utilities for advanced users
export {
	parseHtaccess,
	createRewriteMiddleware,
	createHeaderMiddleware,
	createErrorDocumentMiddleware,
	securityHeaders,
} from "./htaccess/index.js";
