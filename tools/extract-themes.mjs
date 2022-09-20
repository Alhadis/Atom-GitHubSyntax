async function main(){
	const args = [...arguments], fn = args.pop() || (() => {}), template = args.shift() || "";
	const plClasses = "ba bu c c1 c2 cce corl e en ent ii k kos mb mc md mdr mh mi mi1 mi2 ml ms pds pse s s1 sg smi smw sr sra sre v".split(" ");
	const plClassRegex = new RegExp(String.raw `\.pl-(?:${plClasses.join("|")})(?=$|[,\s:+>~{\[])`, "g");

	/**
	 * Enumerate a list of stylesheets and return a flattened list of styles.
	 * @param {CSSStyleSheet[]} sheets
	 * @return {Array}
	 */
	function enumStyles(...sheets){
		const results = [];
		const addRule = (rule, media, supports) => {
			media    = null == media    ? [] : media.slice();
			supports = null == supports ? [] : supports.slice();
			switch(rule.type){
				case CSSRule.STYLE_RULE: {
					const style = Object.fromEntries([...rule.style].map(key => [key, rule.style.getPropertyValue(key)]));
					results.push({selector: rule.selectorText, style, media, supports, rule});
					break;
				}
				case CSSRule.MEDIA_RULE: {
					const childMedia = [...media, ...rule.media];
					for(const childRule of rule.cssRules)
						addRule(childRule, childMedia, supports);
					break;
				}
				case CSSRule.SUPPORTS_RULE: {
					const childSupport = [...supports, rule.conditionText];
					for(const childRule of rule.cssRules)
						addRule(childRule, media, childSupport);
					break;
				}
				default:
					const {name} = rule.constructor;
					if(rule instanceof CSSConditionRule)
						throw new TypeError(`Unrecognised conditional: ${name}`);
					else if(rule instanceof CSSGroupingRule){
						if(!rule.cssRules?.[Symbol.iterator])
							throw new TypeError(`Unrecognised grouping rule: ${name}`);
						for(const childRule of rule.cssRules)
							addRule(childRule, media, supports);
					}
			}
		};
		for(const sheet of sheets){
			const media = [...sheet.media];
			for(const rule of sheet.cssRules)
				addRule(rule, media);
		}
		return results;
	}

	/**
	 * Extract a Less stylesheet from GitHub's front-end.
	 * @param {String} colourMode - Either "dark" or "light"
	 * @param {String} 
	 * @return {Promise.<String>}
	 * @internal
	 */
	async function scrapeStyles(colourMode, theme){
		const {dataset} = document.documentElement;
		if(colourMode !== dataset.colorMode)
			dataset.colorMode = colourMode;
		
		const isDark = "dark" === colourMode || "auto" === colourMode && window.matchMedia("(prefers-color-scheme: dark)").matches;
		dataset[isDark ? "darkTheme" : "lightTheme"] = theme;
		await new Promise($ => setTimeout($, 100));
		
		const rules = [];
		const varRefs = {__proto__: null};
		const varDefs = {__proto__: null};
		for(const rule of enumStyles(...document.styleSheets)){
			// Filter out junk media queries
			rule.media = rule.media.filter(media => !/^(?:not )?(?:any|all|none)$/.test(media));
			
			// Record variable definitions
			for(const key in rule.style)
				key.startsWith("--") && (varDefs[key] ??= new Set()).add(rule);
			
			const {selector} = rule;
			switch(selector){
				case ".Header .header-search-button .pl-c1":
				case ".Header .header-search-button .pl-en":
					console.warn(`Skipping selector: ${selector}`);
					continue;
			}
			if(plClassRegex.test(selector)){
				plClassRegex.lastIndex = 0;
				
				// XXX: Safeguard against any selectors we're not prepared for
				const selectors = selector.trim().split(/\s*,\s*|\s+/).filter(Boolean);
				if(!selectors.every(str => /^\.pl-(\w+)(?:::?before|after)?$/.test(str) && plClasses.includes(RegExp.$1)))
					throw new TypeError(`Unexpected selector: ${selector}`);
				
				// Record any variable references
				for(const key in rule.style){
					for(const name of rule.style[key].match(/(?<=\bvar\()--[-\w]+(?=[,\s)])/g) || []){
						const refs = varRefs[name] ??= new Map();
						refs.has(rule) || refs.set(rule, new Set());
						refs.get(rule).add(key);
					}
				}
				rules.push(rule);
			}
		}
		
		// Resolve the computed value of any variables referenced by PrettyLights classes
		const bodyStyle = window.getComputedStyle(document.body);
		if(Object.keys(varRefs).length){
			const saneDef = /^(?!$)(?:html|:root)?(?:\[data-(?:color-mode|(?:dark|light)-theme)="[^"]*"\])*$/;
			console.group("Expanding variable references…");
			for(const key in varRefs){
				
				// XXX: Make sure variable definitions don't exist in awkward places
				for(const {selector} of varDefs[key])
					if(!selector.trim().split(/\s*,\s*/g).every(str => saneDef.test(str)))
						throw new TypeError(`Syntax variable defined in unexpected place: ${selector}`);
				
				let value = bodyStyle.getPropertyValue(key);
				if(/^#[A-Fa-f0-9]{3,}$/.test(value))
					value = value.toLowerCase();
				for(const [rule, props] of varRefs[key]){
					for(const prop of props){
						console.log(`${prop}: ${rule.style[prop]} -> ${value}`);
						rule.style[prop] = value;
					}
				}
			}
			console.groupEnd();
		}
		
		// Compile the Less stylesheet
		let result = "";
		for(let {selector, style} of rules){
			selector = selector
				.replace(plClassRegex, match => match.replace(/^\.?(.+)/, "@{$1}"))
				.replace(/\s*,\s*/g, ",\n");
			result += `${selector}{\n`;
			for(const prop in style)
				result += `\t${prop}: ${style[prop]};\n`;
			result += "}\n";
		}
		return result;
	}

	await new Promise(resolve => {
		if("complete" === document.readyState)
			return resolve();
		const fn = () => (window.removeEventListener("load", fn), resolve());
		window.addEventListener("load", fn);
	});


	// XXX: Sanity checks to ensure <html> element has a manipulatable `data-color-mode` attribute
	const {dataset} = document.documentElement;
	if(dataset && !(dataset instanceof DOMStringMap))
		throw new TypeError("Expected <html> dataset to be DOMStringMap");
	if(!Object.hasOwn(dataset, "colorMode"))
		throw new TypeError("Expected <html> dataset to define `colorMode`");
	if(!["light", "dark", "auto"].includes(dataset.colorMode))
		throw new TypeError("Expected <html data-color-mode='…'> to be `light`, `dark` or `auto`");

	// Load additional theme styles
	for(const el of document.querySelectorAll("link[rel='stylesheet'][data-href]")){
		const {href} = el.dataset;
		el.removeAttribute("data-href");
		el.setAttribute("href", href);
	}
	const themes = {
		// Load light-coloured themes
		light:             await scrapeStyles("light", "light"),
		lightHighContrast: await scrapeStyles("light", "light_high_contrast"),
		lightColourBlind:  await scrapeStyles("light", "light_colorblind"),
		lightTritanopia:   await scrapeStyles("light", "light_tritanopia"),
		
		// Dark-coloured themes
		dark:              await scrapeStyles("dark", "dark"),
		darkHighContrast:  await scrapeStyles("dark", "dark_high_contrast"),
		darkColourBlind:   await scrapeStyles("dark", "dark_colorblind"),
		darkTritanopia:    await scrapeStyles("dark", "dark_tritanopia"),
		darkDimmed:        await scrapeStyles("dark", "dark_dimmed"),
	};
	const result = template.replace(
		/^([ \t]*)(\S.*?)?%([a-z][a-zA-Z0-9]*)%/gm,
		(match, indent = "", junk = "", name = "") => {
			if(name in themes)
				return indent + junk + themes[name].trimEnd().replace(/(?<=\n)/g, indent);
			throw new ReferenceError(`Unrecognised placeholder: %${name}%`);
		});
	fn(result);
	return result;
}

if("object" === typeof window && window === globalThis)
	main(x => console.dir(x));
else(async () => {
	const {readFileSync} = await import("fs");
	console.log(JSON.stringify({
		args: [readFileSync("../styles/syntax.less.tmpl", "utf8").trimEnd()],
		script: `(async () => {${
			main.toString().trim().replace(/^.*?{|}$/gs, "")
		}})();`,
	}));
})().catch(error => {
	console.error(error);
	process.exit(1);
});
