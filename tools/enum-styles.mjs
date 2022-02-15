const plClasses = "ba bu c c1 c2 cce corl e en ent ii k kos mb mc md mdr mh mi mi1 mi2 ml ms pds pse s s1 sg smi smw sr sra sre v".split(" ");
const plClassRegex = new RegExp(String.raw `\.pl-(?:${plClasses.join("|")})(?=$|[,\s:+>~{\[])`, "g");
const wait = ms => new Promise($ => setTimeout($, ms));

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
 * @return {String}
 * @internal
 */
function scrapeStyles(){
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
			
			const value = bodyStyle.getPropertyValue(key);
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

new Promise(resolve => {
	if("complete" === document.readyState)
		return resolve();
	const fn = () => (window.removeEventListener("load", fn), resolve());
	window.addEventListener("load", fn);
}).then(async () => {
	const {dataset} = document.documentElement;
	
	// XXX: Sanity checks to ensure <html> element has a manipulatable `data-color-mode` attribute
	if(dataset && !(dataset instanceof DOMStringMap))
		throw new TypeError("Expected <html> dataset to be DOMStringMap");
	if(!Object.hasOwn(dataset, "colorMode"))
		throw new TypeError("Expected <html> dataset to define `colorMode`");
	if(!["light", "dark", "auto"].includes(dataset.colorMode))
		throw new TypeError("Expected <html data-color-mode='…'> to be `light`, `dark` or `auto`");
	
	dataset.colorMode = "light"; await wait(100); const lightMode = scrapeStyles();
	dataset.colorMode = "dark";  await wait(100); const darkMode  = scrapeStyles();
	return [
		"// Generated file; do not edit. Instead, run `tools/enum-styles.mjs`.",
		'@import "./includes/scope-map.less";\n',
		
		"/* Light mode (default) */",
		"@media not all and (prefers-color-scheme: dark){",
		lightMode.trim().replace(/^/gm, "\t"),
		"}\n",
		
		"/* Dark mode */",
		"@media (prefers-color-scheme: dark){",
		darkMode.trim().replace(/^/gm, "\t"),
		"}\n",
	].join("\n");
});
