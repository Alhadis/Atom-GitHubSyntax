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
			atom.config.observe(`${pkgName}.matchFont`, value => {
				if(value !== classes.contains("match-github-font")){
					classes.toggle("match-github-font");
					for(const editor of atom.textEditors.editors)
						editor.component.didUpdateStyles();
				}
			}),
			atom.config.observe(`${pkgName}.colourMode`, value => value
				? root.colourMode = value
				: delete root.colourMode),
			atom.config.observe(`${pkgName}.theme`, value => {
				switch(value){
					case "high-contrast":
					case "colour-blind":
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
		classes.remove("match-github-font");
		delete root.colourMode;
		delete root.githubTheme;
		disposables.dispose();
	},
};
