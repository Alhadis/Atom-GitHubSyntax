"use strict";

const {name: pkgName} = require("./package.json");
const {CompositeDisposable} = require("atom");
const root = document.documentElement.dataset;
const classes = document.documentElement.classList;
const inDarkMode = window.matchMedia("(prefers-color-scheme: dark)");
let disposables = null;

module.exports = {
	activate(){
		disposables?.dispose();
		disposables = new CompositeDisposable(
			atom.config.observe(`${pkgName}.matchSize`, value => this.toggle("match-github-size", value)),
			atom.config.observe(`${pkgName}.matchFont`, value => this.toggle("match-github-font", value)),
			atom.config.observe(`${pkgName}.colourMode`, value => value
				? root.colourMode = value
				: delete root.colourMode),
			atom.config.observe(`${pkgName}.theme`, value => {
				switch(value){
					case "high-contrast":
					case "colour-blind":
					case "tritanopia":
						root.githubTheme = value;
						break;
					case "dimmed":
						"dark" === root.colourMode || !root.colourMode && inDarkMode.matches
							? root.githubTheme = value
							: delete root.githubTheme;
						break;
					default:
						delete root.githubTheme;
				}
			}),
		);
		inDarkMode.onchange = ({matches}) => {
			if(root.colourMode) return;
			const theme = atom.config.get(`${pkgName}.theme`);
			if("dimmed" === theme)
				matches ? root.githubTheme = theme : delete root.githubTheme;
		};
	},
	
	deactivate(){
		inDarkMode.onchange = null;
		classes.remove("match-github-font", "match-github-size");
		delete root.colourMode;
		delete root.githubTheme;
		disposables.dispose();
	},
	
	toggle(name, value = !classes.contains(name)){
		if(value === classes.contains(name)) return;
		classes.toggle(name, value);
		this.update();
		return value;
	},
	
	updateQueued: false,
	update(){
		if(this.updateQueued) return;
		this.updateQueued = true;
		process.nextTick(() => {
			this.updateQueued = false;
			if(!classes.contains("match-github-font"))
				classes.remove("match-github-size");
			classes.length || document.documentElement.removeAttribute("class");
			for(const editor of atom.textEditors.editors)
				editor.component.didUpdateStyles();
		});
	},
};
