#!/usr/bin/env node

import {readFileSync, writeFileSync} from "fs";
import {dirname, resolve, join} from "path";
import {fileURLToPath} from "url";
import {get} from "https";

async function fetch(url){
	return new Promise((resolve, reject) => {
		get(url, response => {
			let result = "";
			response.setEncoding("utf8");
			response.on("data", chunk => result += chunk);
			response.on("end", () => resolve(result));
			response.on("error", error => reject(error));
		}).on("error", error => {
			console.error(error);
			reject(error);
		});
	});
}

const pairings = (await fetch("https://raw.githubusercontent.com/Alhadis/language-etc/master/samples/lists/scope-previews.nanorc"))
	.split(/\r?\n|\r|\x85|\u2028|\u2029/)
	.filter(line => line.includes("░▒▓█"))
	.map(line => line
		.replace(/│|░▒▓█+/g, "")
		.trim()
		.split(/\s+/)
		.reverse())
	.sort();


const scopesList = pairings.map(entry => entry[1]).sort();
const successors = {__proto__: null};
for(const scope of scopesList)
	successors[scope] = [...new Set(scopesList.filter(x => x.startsWith(`${scope}.`)))];

const munge = scopes => {
	scopes = scopes.split(".").filter(Boolean).map(scope => `syntax--${scope}`).join(" ");
	return [`[class="${scopes}"]`, `[class^="${scopes} "]`];
};
const map = {__proto__: null};
for(let [plClass, scopes] of pairings){
	const not = successors[scopes]?.length ? successors[scopes].map(munge).flat() : [];
	scopes = munge(scopes);
	if(plClass in map){
		map[plClass].is.push(...scopes);
		map[plClass].not.push(...not);
	}
	else map[plClass] = {is: scopes, not};
}

const maxLength = Object.keys(map)
	.sort(({length: a}, {length: b}) => a < b ? -1 : a > b ? 1 : 0)
	.pop().length + 1;

let src = "";
for(const key in map){
	const pad = " ".repeat(Math.max(1, maxLength - key.length));
	let {is, not} = map[key];
	is  = `:is(${is.join(", ")})`;
	not = not.length ? not.map(x => `:not(${x})`).join("") : "";
	src += `@${key}:${pad}~'${is}${not}';\n`;
}

const dir = dirname(fileURLToPath(import.meta.url));
let path = resolve(join(dir, "..", "styles", "scope-map.less"));
writeFileSync(path, src, "utf8");

// Update list of scope-classes in `enum-styles.mjs`
let didReplace = false, didChange = false;
path = join(dir, "enum-styles.mjs");
src = readFileSync(path, "utf8").replace(
	/(?<=^\s*const\s+plClasses\s*=\s*")[^"]*(?="\s*\.\s*split\s*\(\s*" "\s*\)\s*;\s*$)/m,
	str => {
		const result = Object.keys(map).map(name => name.replace(/^pl-/, "")).join(" ");
		didChange = str !== result;
		didReplace = true;
		return result;
	},
);
if(!didReplace)
	throw new Error(`Failed to locate "const plClasses = …" in ${path}`);
didChange
	? writeFileSync(path, src, "utf8")
	: console.log(`No change to file ${path}`);
