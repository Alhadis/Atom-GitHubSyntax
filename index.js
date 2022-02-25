"use strict";

const {CompositeDisposable} = require("atom");
const root = document.documentElement.dataset;
const inDarkMode = window.matchMedia("(prefers-color-scheme: dark)");
let disposables = null;

module.exports = {
	activate(){
		disposables?.dispose();
		disposables = new CompositeDisposable(
			atom.config.observe("atom-github-syntax.theme", value => {
				switch(value){
					case "high-contrast":
					case "colour-blind":
						root.githubTheme = value;
						break;
					case "dimmed":
						inDarkMode.matches
							? root.githubTheme = value
							: delete root.githubTheme;
						break;
					default:
						delete root.githubTheme;
				}
			}),
		);
		inDarkMode.onchange = ({matches}) => {
			const theme = atom.config.get("atom-github-syntax.theme");
			if("dimmed" === theme)
				matches ? root.githubTheme = theme : delete root.githubTheme;
		};
	},
	
	deactivate(){
		inDarkMode.onchange = null;
		disposables.dispose();
	},
};
