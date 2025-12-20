import { describe, expect, it } from "vitest";
import { generateVirtualModule } from "./virtual";

describe("generateVirtualModule", () => {
	it("should generate virtual module with default publicDir", () => {
		const result = generateVirtualModule({});
		
		// Check that globs start with / not ./
		expect(result).toContain("import.meta.glob('/public/**/*.cgi.{tsx,jsx}'");
		expect(result).toContain("import.meta.glob('/public/**/.htpasswd'");
		expect(result).toContain("import.meta.glob('/public/**/.htaccess'");
		
		// Check that regex patterns properly handle the publicDir path
		expect(result).toMatch(/new RegExp\(['"]\^[\/\\]+public['"]\)/);
		
		// Check exports are present
		expect(result).toContain("export const pages");
		expect(result).toContain("export const authMap");
		expect(result).toContain("export const rewriteMap");
		expect(result).toContain("export const config");
	});

	it("should generate virtual module with custom publicDir", () => {
		const result = generateVirtualModule({ publicDir: "static" });
		
		// Check that globs use custom publicDir
		expect(result).toContain("import.meta.glob('/static/**/*.cgi.{tsx,jsx}'");
		expect(result).toContain("import.meta.glob('/static/**/.htpasswd'");
		expect(result).toContain("import.meta.glob('/static/**/.htaccess'");
		
		// Check that regex patterns use custom publicDir
		expect(result).toMatch(/new RegExp\(['"]\^[\/\\]+static['"]\)/);
	});

	it("should generate virtual module with nested publicDir path", () => {
		const result = generateVirtualModule({ publicDir: "src/public" });
		
		// Check that globs use nested path
		expect(result).toContain("import.meta.glob('/src/public/**/*.cgi.{tsx,jsx}'");
		expect(result).toContain("import.meta.glob('/src/public/**/.htpasswd'");
		
		// Check that regex patterns use nested path
		expect(result).toMatch(/new RegExp\(['"]\^[\/\\]+src\/public['"]\)/);
	});

	it("should include config in generated module", () => {
		const siteConfig = { title: "My Site", version: "1.0.0" };
		const result = generateVirtualModule({ config: siteConfig });
		
		expect(result).toContain('export const config = {"title":"My Site","version":"1.0.0"}');
	});

	it("should handle empty config", () => {
		const result = generateVirtualModule({ config: {} });
		
		expect(result).toContain("export const config = {}");
	});

	it("should generate valid JavaScript module structure", () => {
		const result = generateVirtualModule({});
		
		// Check that module has proper structure
		expect(result).toContain("const modules =");
		expect(result).toContain("const urls =");
		expect(result).toContain("const htpasswds =");
		expect(result).toContain("const htaccessFiles =");
		
		// Check map and reduce operations
		expect(result).toContain("Object.keys(modules).map");
		expect(result).toContain("Object.keys(htpasswds).reduce");
		expect(result).toContain("Object.keys(htaccessFiles).reduce");
	});

	it("should not use relative paths in globs", () => {
		const result = generateVirtualModule({});
		
		// Ensure no relative paths starting with ./
		expect(result).not.toContain("import.meta.glob('./");
		expect(result).not.toContain("import.meta.glob(\"./");
	});

	it("should properly escape special characters in regex", () => {
		const result = generateVirtualModule({ publicDir: "public" });
		
		// Check proper escaping in generated regex patterns
		expect(result).toMatch(/new RegExp\(['"]\^[\/\\]+public['"]\)/);
		expect(result).toMatch(/[\/\\]+index\\\.cgi\$/);
	});

	it("should handle publicDir with special characters", () => {
		const result = generateVirtualModule({ publicDir: "public-dir" });
		
		expect(result).toContain("import.meta.glob('/public-dir/**/*.cgi.{tsx,jsx}'");
		expect(result).toMatch(/new RegExp\(['"]\^[\/\\]+public-dir['"]\)/);
	});
});
